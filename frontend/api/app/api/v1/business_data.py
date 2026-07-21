from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple, Type
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import require_admin
from app.api.schemas import (
    CustomerCreate, CustomerUpdate, CustomerResponse,
    ProductCreate, ProductUpdate, ProductResponse,
    OrderCreate, OrderUpdate, OrderResponse,
    PaymentCreate, PaymentUpdate, PaymentResponse,
    ImportResultResponse,
)
from app.infrastructure.repositories.business_repository import (
    CustomerRepository, ProductRepository, OrderRepository, PaymentRepository,
)

router = APIRouter(prefix="/admin/data", tags=["Business Data Admin"], dependencies=[Depends(require_admin)])


async def _import_csv(
    file: UploadFile,
    schema_cls: Type[BaseModel],
    repo,
    fk_checks: Optional[List[Tuple[str, Any]]] = None,
) -> Dict[str, Any]:
    """Parse an uploaded CSV and insert one row per record via `repo.create`,
    validating each row against `schema_cls` first. Bad rows are skipped and
    reported rather than aborting the whole import."""
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext != "csv":
        raise HTTPException(status_code=400, detail="Only CSV files are supported for import")

    content = await file.read()
    try:
        df = pd.read_csv(BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {e}")

    df = df.where(pd.notnull(df), None)

    inserted = 0
    errors: List[Dict[str, Any]] = []
    for idx, row in df.iterrows():
        row_num = int(idx) + 2  # +1 for header row, +1 for 0-index -> 1-index
        try:
            payload = schema_cls(**row.to_dict())
        except ValidationError as ve:
            first = ve.errors()[0] if ve.errors() else None
            errors.append({"row": row_num, "message": first["msg"] if first else str(ve)})
            continue

        fields = {k: v for k, v in payload.model_dump().items() if v is not None}

        fk_failed = None
        if fk_checks:
            for field_name, getter in fk_checks:
                value = fields.get(field_name)
                if value is not None and not await getter(value):
                    fk_failed = f"{field_name}={value} does not exist"
                    break
        if fk_failed:
            errors.append({"row": row_num, "message": fk_failed})
            continue

        try:
            await repo.create(**fields)
            inserted += 1
        except Exception as e:
            errors.append({"row": row_num, "message": str(e)})

    return {"inserted": inserted, "failed": len(errors), "errors": errors[:20]}


# --- Customers ---
@router.get("/customers", response_model=List[CustomerResponse])
async def list_customers(limit: int = 100, offset: int = 0, db: AsyncSession = Depends(get_db)):
    return await CustomerRepository(db).list(limit=limit, offset=offset)

@router.post("/customers", response_model=CustomerResponse)
async def create_customer(payload: CustomerCreate, db: AsyncSession = Depends(get_db)):
    return await CustomerRepository(db).create(**payload.model_dump())

@router.put("/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(customer_id: int, payload: CustomerUpdate, db: AsyncSession = Depends(get_db)):
    updated = await CustomerRepository(db).update(customer_id, **payload.model_dump())
    if not updated:
        raise HTTPException(status_code=404, detail="Customer not found")
    return updated

@router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: int, db: AsyncSession = Depends(get_db)):
    try:
        ok = await CustomerRepository(db).delete(customer_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not ok:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"success": True}

@router.post("/customers/import", response_model=ImportResultResponse)
async def import_customers(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    return await _import_csv(file, CustomerCreate, CustomerRepository(db))


# --- Products ---
@router.get("/products", response_model=List[ProductResponse])
async def list_products(limit: int = 100, offset: int = 0, db: AsyncSession = Depends(get_db)):
    return await ProductRepository(db).list(limit=limit, offset=offset)

@router.post("/products", response_model=ProductResponse)
async def create_product(payload: ProductCreate, db: AsyncSession = Depends(get_db)):
    return await ProductRepository(db).create(**payload.model_dump())

@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: int, payload: ProductUpdate, db: AsyncSession = Depends(get_db)):
    updated = await ProductRepository(db).update(product_id, **payload.model_dump())
    if not updated:
        raise HTTPException(status_code=404, detail="Product not found")
    return updated

@router.delete("/products/{product_id}")
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db)):
    try:
        ok = await ProductRepository(db).delete(product_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not ok:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"success": True}

@router.post("/products/import", response_model=ImportResultResponse)
async def import_products(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    return await _import_csv(file, ProductCreate, ProductRepository(db))


# --- Orders ---
@router.get("/orders", response_model=List[OrderResponse])
async def list_orders(limit: int = 100, offset: int = 0, db: AsyncSession = Depends(get_db)):
    return await OrderRepository(db).list(limit=limit, offset=offset)

@router.post("/orders", response_model=OrderResponse)
async def create_order(payload: OrderCreate, db: AsyncSession = Depends(get_db)):
    if not await CustomerRepository(db).get(payload.customer_id):
        raise HTTPException(status_code=400, detail=f"customer_id {payload.customer_id} does not exist")
    fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    return await OrderRepository(db).create(**fields)

@router.put("/orders/{order_id}", response_model=OrderResponse)
async def update_order(order_id: int, payload: OrderUpdate, db: AsyncSession = Depends(get_db)):
    if payload.customer_id is not None and not await CustomerRepository(db).get(payload.customer_id):
        raise HTTPException(status_code=400, detail=f"customer_id {payload.customer_id} does not exist")
    updated = await OrderRepository(db).update(order_id, **payload.model_dump())
    if not updated:
        raise HTTPException(status_code=404, detail="Order not found")
    return updated

@router.delete("/orders/{order_id}")
async def delete_order(order_id: int, db: AsyncSession = Depends(get_db)):
    ok = await OrderRepository(db).delete(order_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"success": True}

@router.post("/orders/import", response_model=ImportResultResponse)
async def import_orders(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    customer_repo = CustomerRepository(db)
    return await _import_csv(
        file, OrderCreate, OrderRepository(db),
        fk_checks=[("customer_id", lambda v: customer_repo.get(int(v)))],
    )


# --- Payments ---
@router.get("/payments", response_model=List[PaymentResponse])
async def list_payments(limit: int = 100, offset: int = 0, db: AsyncSession = Depends(get_db)):
    return await PaymentRepository(db).list(limit=limit, offset=offset)

@router.post("/payments", response_model=PaymentResponse)
async def create_payment(payload: PaymentCreate, db: AsyncSession = Depends(get_db)):
    if not await OrderRepository(db).get(payload.order_id):
        raise HTTPException(status_code=400, detail=f"order_id {payload.order_id} does not exist")
    fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    return await PaymentRepository(db).create(**fields)

@router.put("/payments/{payment_id}", response_model=PaymentResponse)
async def update_payment(payment_id: int, payload: PaymentUpdate, db: AsyncSession = Depends(get_db)):
    if payload.order_id is not None and not await OrderRepository(db).get(payload.order_id):
        raise HTTPException(status_code=400, detail=f"order_id {payload.order_id} does not exist")
    updated = await PaymentRepository(db).update(payment_id, **payload.model_dump())
    if not updated:
        raise HTTPException(status_code=404, detail="Payment not found")
    return updated

@router.delete("/payments/{payment_id}")
async def delete_payment(payment_id: int, db: AsyncSession = Depends(get_db)):
    ok = await PaymentRepository(db).delete(payment_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"success": True}

@router.post("/payments/import", response_model=ImportResultResponse)
async def import_payments(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    order_repo = OrderRepository(db)
    return await _import_csv(
        file, PaymentCreate, PaymentRepository(db),
        fk_checks=[("order_id", lambda v: order_repo.get(int(v)))],
    )
