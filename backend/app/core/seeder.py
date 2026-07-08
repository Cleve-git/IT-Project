import random
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Customer, Product, Order, OrderItem, Profile

# Mock data definitions
MOCK_PROFILES = [
    {
        "id": "admin-user-uuid-12345678",
        "email": "admin@cda.com",
        "full_name": "System Administrator",
        "role": "admin"
    },
    {
        "id": "regular-user-uuid-87654321",
        "email": "user@cda.com",
        "full_name": "Business Analyst",
        "role": "user"
    }
]

# Mock values mirror the real dataset's enums (tier: Gold/Silver/Bronze,
# Indonesian cities, real product categories) so an offline/local seed behaves
# like production. Keep these in sync with DB_SCHEMA_CONTEXT in analyst_service.
MOCK_CUSTOMERS = [
    {"name": "Acme Corporation", "city": "Jakarta", "tier": "Gold"},
    {"name": "Starlight Industries", "city": "Surabaya", "tier": "Gold"},
    {"name": "Nova Retail", "city": "Bandung", "tier": "Silver"},
    {"name": "Apex Consulting", "city": "Medan", "tier": "Bronze"},
    {"name": "Zenith Ventures", "city": "Semarang", "tier": "Silver"}
]

MOCK_PRODUCTS = [
    {"product_name": "Cloud Data Platform", "category": "Software", "unit_price": Decimal("1500.00"), "cost": Decimal("300.00")},
    {"product_name": "Enterprise Analytics Suite", "category": "Software", "unit_price": Decimal("2500.00"), "cost": Decimal("500.00")},
    {"product_name": "Data Integration Pipeline", "category": "Software", "unit_price": Decimal("800.00"), "cost": Decimal("150.00")},
    {"product_name": "Premium Support Contract", "category": "Support", "unit_price": Decimal("500.00"), "cost": Decimal("200.00")},
    {"product_name": "ML Model Deployment Package", "category": "Consulting", "unit_price": Decimal("5000.00"), "cost": Decimal("1500.00")}
]

async def seed_database(db: AsyncSession):
    """Seed database with mock admin/users and core business data if they don't already exist."""
    
    # 1. Seed Profiles
    for prof_data in MOCK_PROFILES:
        q = await db.execute(select(Profile).filter_by(id=prof_data["id"]))
        if not q.scalar_one_or_none():
            profile = Profile(**prof_data)
            db.add(profile)
            print(f"Seeding profile: {prof_data['email']}")

    # 2. Seed Customers
    customer_check = await db.execute(select(Customer).limit(1))
    if not customer_check.scalar_one_or_none():
        customers = [Customer(**c) for c in MOCK_CUSTOMERS]
        db.add_all(customers)
        await db.flush()
        print("Seeding customers...")
    else:
        # Fetch existing customers if already seeded
        customers_q = await db.execute(select(Customer))
        customers = list(customers_q.scalars().all())

    # 3. Seed Products
    product_check = await db.execute(select(Product).limit(1))
    if not product_check.scalar_one_or_none():
        products = [Product(**p) for p in MOCK_PRODUCTS]
        db.add_all(products)
        await db.flush()
        print("Seeding products...")
    else:
        # Fetch existing products if already seeded
        products_q = await db.execute(select(Product))
        products = list(products_q.scalars().all())

    # 4. Seed Orders, OrderItems
    order_check = await db.execute(select(Order).limit(1))
    if not order_check.scalar_one_or_none() and customers and products:
        print("Seeding orders and order items...")
        base_date = datetime.utcnow() - timedelta(days=90)
        
        for i in range(30):  # Generate 30 orders
            customer = random.choice(customers)
            order_date = base_date + timedelta(days=random.randint(1, 88), hours=random.randint(0, 23))
            
            # Select random products for this order
            chosen_products = random.sample(products, k=random.randint(1, 3))
            
            order = Order(
                customer=customer,
                order_date=order_date,
                status=random.choice(["Completed", "Completed", "Completed", "Pending", "Cancelled"]),
                order_total=Decimal("0.00")  # placeholder, calculate below
            )
            db.add(order)
            await db.flush()  # get order.order_id

            order_items = []
            for prod in chosen_products:
                qty = random.randint(1, 5)
                
                item = OrderItem(
                    order_id=order.order_id,
                    product_id=prod.product_id,
                    quantity=qty,
                    price_at_purchase=prod.price
                )
                order_items.append(item)
            
            db.add_all(order_items)

            # Create payment if completed or pending (some payments might fail)
            if order.status == "Completed":
                pay = Payment(
                    order_id=order.order_id,
                    amount=order_total,
                    method=random.choice(["Credit Card", "PayPal", "Bank Transfer"]),
                    paid_date=order_date + timedelta(minutes=random.randint(5, 120)),
                    status="Success"
                )
                db.add(pay)
            elif order.status == "Pending" and random.random() > 0.3:
                pay = Payment(
                    order_id=order.order_id,
                    amount=order_total,
                    method=random.choice(["Credit Card", "PayPal"]),
                    paid_date=order_date,
                    status="Pending"
                )
                db.add(pay)
            elif order.status == "Cancelled":
                pay = Payment(
                    order_id=order.order_id,
                    amount=order_total,
                    method="Credit Card",
                    paid_date=order_date,
                    status="Failed"
                )
                db.add(pay)
                
        await db.commit()
        print("Database seeding completed successfully.")
    else:
        print("Database already has orders; seeding skipped.")
        await db.commit()
