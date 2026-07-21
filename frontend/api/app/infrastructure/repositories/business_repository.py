from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete, func
from typing import Any, Generic, List, Optional, Type, TypeVar
from app.domain.models import Customer, Product, Order, Payment, OrderItem

ModelT = TypeVar("ModelT")


class _CrudRepository(Generic[ModelT]):
    """Shared list/get/create/update for the flat business tables — delete is
    entity-specific (FK relationships differ) and defined on each subclass."""

    model: Type[ModelT]
    pk_attr: str

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, limit: int = 100, offset: int = 0) -> List[ModelT]:
        stmt = (
            select(self.model)
            .order_by(getattr(self.model, self.pk_attr).desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get(self, id_: int) -> Optional[ModelT]:
        stmt = select(self.model).filter_by(**{self.pk_attr: id_})
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, **fields: Any) -> ModelT:
        # These tables predate the ORM models and were provisioned without a
        # sequence/identity default on their integer PK, so we can't rely on
        # Postgres to assign one — compute the next id ourselves.
        pk_col = getattr(self.model, self.pk_attr)
        next_id = (await self.db.execute(select(func.coalesce(func.max(pk_col), 0) + 1))).scalar()

        obj = self.model(**{self.pk_attr: next_id}, **fields)
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def update(self, id_: int, **fields: Any) -> Optional[ModelT]:
        obj = await self.get(id_)
        if not obj:
            return None
        for key, value in fields.items():
            if value is not None:
                setattr(obj, key, value)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj


class CustomerRepository(_CrudRepository[Customer]):
    model = Customer
    pk_attr = "customer_id"

    async def delete(self, customer_id: int) -> bool:
        """Refuse to delete a customer that still has orders — that would
        silently erase order history rather than just the customer record."""
        order_count = (
            await self.db.execute(
                select(func.count(Order.order_id)).filter_by(customer_id=customer_id)
            )
        ).scalar() or 0
        if order_count > 0:
            raise ValueError(f"Customer has {order_count} existing order(s); delete those first")

        result = await self.db.execute(delete(Customer).filter_by(customer_id=customer_id))
        await self.db.commit()
        return (result.rowcount or 0) > 0


class ProductRepository(_CrudRepository[Product]):
    model = Product
    pk_attr = "product_id"

    async def delete(self, product_id: int) -> bool:
        item_count = (
            await self.db.execute(
                select(func.count(OrderItem.order_item_id)).filter_by(product_id=product_id)
            )
        ).scalar() or 0
        if item_count > 0:
            raise ValueError(f"Product appears in {item_count} order line item(s); delete those first")

        result = await self.db.execute(delete(Product).filter_by(product_id=product_id))
        await self.db.commit()
        return (result.rowcount or 0) > 0


class OrderRepository(_CrudRepository[Order]):
    model = Order
    pk_attr = "order_id"

    async def delete(self, order_id: int) -> bool:
        """FK-safe delete: remove payments and order_items before the order
        itself (Core bulk deletes don't trigger ORM cascade)."""
        await self.db.execute(delete(Payment).filter_by(order_id=order_id))
        await self.db.execute(delete(OrderItem).filter_by(order_id=order_id))
        result = await self.db.execute(delete(Order).filter_by(order_id=order_id))
        await self.db.commit()
        return (result.rowcount or 0) > 0


class PaymentRepository(_CrudRepository[Payment]):
    model = Payment
    pk_attr = "payment_id"

    async def delete(self, payment_id: int) -> bool:
        result = await self.db.execute(delete(Payment).filter_by(payment_id=payment_id))
        await self.db.commit()
        return (result.rowcount or 0) > 0
