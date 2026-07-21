"""
Golden benchmark dataset for evaluating the Natural-Language -> SQL agent.

Each entry pairs a natural-language question with a hand-written "gold" SQL
statement that returns the correct answer for the seeded retail schema
(customers, products, orders, order_items, payments).

The evaluation in `app/api/v1/admin.py` measures **execution accuracy**: the
generated SQL and the gold SQL are both executed against the live database and
their result sets are compared. This is robust to harmless phrasing differences
(column aliases, row ordering, equivalent join paths) while still catching
queries that compute the wrong thing.

Gold statements intentionally carry NO trailing semicolon so they can be safely
wrapped by the read-only executor.
"""

from typing import List, Dict

# category, nl_query, gold_sql
BENCHMARK_SUITE: List[Dict[str, str]] = [
    # ---------------------------------------------------------------- aggregation
    {
        "category": "aggregation",
        "nl_query": "What is our total revenue from successful payments?",
        "gold_sql": "SELECT SUM(amount) AS revenue FROM payments WHERE status = 'paid'",
    },
    {
        "category": "aggregation",
        "nl_query": "How many customers do we have in total?",
        "gold_sql": "SELECT COUNT(*) AS total_customers FROM customers",
    },
    {
        "category": "aggregation",
        "nl_query": "How many orders have been placed?",
        "gold_sql": "SELECT COUNT(*) AS total_orders FROM orders",
    },
    {
        "category": "aggregation",
        "nl_query": "What is the average order total across all orders?",
        "gold_sql": "SELECT AVG(order_total) AS avg_order_total FROM orders",
    },
    {
        "category": "aggregation",
        "nl_query": "What is the total quantity of items sold?",
        "gold_sql": "SELECT SUM(quantity) AS total_quantity FROM order_items",
    },
    {
        "category": "aggregation",
        "nl_query": "How many products are in the catalog?",
        "gold_sql": "SELECT COUNT(*) AS total_products FROM products",
    },
    {
        "category": "aggregation",
        "nl_query": "What is the highest single order total?",
        "gold_sql": "SELECT MAX(order_total) AS max_order_total FROM orders",
    },
    {
        "category": "aggregation",
        "nl_query": "What is the cheapest product price?",
        "gold_sql": "SELECT MIN(unit_price) AS min_price FROM products",
    },
    {
        "category": "aggregation",
        "nl_query": "What is the total value of all order line items?",
        "gold_sql": "SELECT SUM(line_total) AS total_line_value FROM order_items",
    },
    {
        "category": "aggregation",
        "nl_query": "How many payments were recorded in total?",
        "gold_sql": "SELECT COUNT(*) AS total_payments FROM payments",
    },

    # ----------------------------------------------------------------- filtering
    {
        "category": "filtering",
        "nl_query": "How many orders were completed?",
        "gold_sql": "SELECT COUNT(*) AS completed_orders FROM orders WHERE status = 'completed'",
    },
    {
        "category": "filtering",
        "nl_query": "How many orders were refunded?",
        "gold_sql": "SELECT COUNT(*) AS refunded_orders FROM orders WHERE status = 'refunded'",
    },
    {
        "category": "filtering",
        "nl_query": "How many orders were cancelled?",
        "gold_sql": "SELECT COUNT(*) AS cancelled_orders FROM orders WHERE status = 'cancelled'",
    },
    {
        "category": "filtering",
        "nl_query": "List all Gold tier customers.",
        "gold_sql": "SELECT name FROM customers WHERE tier = 'Gold'",
    },
    {
        "category": "filtering",
        "nl_query": "How many customers are on the Silver tier?",
        "gold_sql": "SELECT COUNT(*) AS silver_customers FROM customers WHERE tier = 'Silver'",
    },
    {
        "category": "filtering",
        "nl_query": "Which customers are located in Jakarta?",
        "gold_sql": "SELECT name FROM customers WHERE city = 'Jakarta'",
    },
    {
        "category": "filtering",
        "nl_query": "How many payments were refunded?",
        "gold_sql": "SELECT COUNT(*) AS refunded_payments FROM payments WHERE status = 'refunded'",
    },
    {
        "category": "filtering",
        "nl_query": "List all products in the Electronics category.",
        "gold_sql": "SELECT product_name FROM products WHERE category = 'Electronics'",
    },
    {
        "category": "filtering",
        "nl_query": "How many payments were made by credit card?",
        "gold_sql": "SELECT COUNT(*) AS credit_card_payments FROM payments WHERE method = 'credit_card'",
    },
    {
        "category": "filtering",
        "nl_query": "Which products cost more than 500,000?",
        "gold_sql": "SELECT product_name FROM products WHERE unit_price > 500000",
    },

    # ------------------------------------------------------------------ grouping
    {
        "category": "grouping",
        "nl_query": "How many customers are in each tier?",
        "gold_sql": "SELECT tier, COUNT(*) AS num_customers FROM customers GROUP BY tier",
    },
    {
        "category": "grouping",
        "nl_query": "How many orders are there per status?",
        "gold_sql": "SELECT status, COUNT(*) AS num_orders FROM orders GROUP BY status",
    },
    {
        "category": "grouping",
        "nl_query": "How many products are in each category?",
        "gold_sql": "SELECT category, COUNT(*) AS num_products FROM products GROUP BY category",
    },
    {
        "category": "grouping",
        "nl_query": "What is the total payment amount grouped by payment method?",
        "gold_sql": "SELECT method, SUM(amount) AS total_amount FROM payments GROUP BY method",
    },
    {
        "category": "grouping",
        "nl_query": "How many customers are in each city?",
        "gold_sql": "SELECT city, COUNT(*) AS num_customers FROM customers GROUP BY city",
    },
    {
        "category": "grouping",
        "nl_query": "What is the average unit price per product category?",
        "gold_sql": "SELECT category, AVG(unit_price) AS avg_price FROM products GROUP BY category",
    },
    {
        "category": "grouping",
        "nl_query": "How many payments are there for each payment status?",
        "gold_sql": "SELECT status, COUNT(*) AS num_payments FROM payments GROUP BY status",
    },
    {
        "category": "grouping",
        "nl_query": "What is the total order value per order status?",
        "gold_sql": "SELECT status, SUM(order_total) AS total_value FROM orders GROUP BY status",
    },

    # --------------------------------------------------------------------- joins
    {
        "category": "joins",
        "nl_query": "What is the total revenue generated by each customer from successful payments?",
        "gold_sql": (
            "SELECT c.name, SUM(p.amount) AS revenue "
            "FROM customers c "
            "JOIN orders o ON c.customer_id = o.customer_id "
            "JOIN payments p ON o.order_id = p.order_id "
            "WHERE p.status = 'paid' "
            "GROUP BY c.name"
        ),
    },
    {
        "category": "joins",
        "nl_query": "How many orders has each customer placed?",
        "gold_sql": (
            "SELECT c.name, COUNT(o.order_id) AS num_orders "
            "FROM customers c "
            "JOIN orders o ON c.customer_id = o.customer_id "
            "GROUP BY c.name"
        ),
    },
    {
        "category": "joins",
        "nl_query": "What is the total quantity sold for each product?",
        "gold_sql": (
            "SELECT p.product_name, SUM(oi.quantity) AS total_sold "
            "FROM products p "
            "JOIN order_items oi ON p.product_id = oi.product_id "
            "GROUP BY p.product_name"
        ),
    },
    {
        "category": "joins",
        "nl_query": "What is the total line revenue for each product?",
        "gold_sql": (
            "SELECT p.product_name, SUM(oi.line_total) AS revenue "
            "FROM products p "
            "JOIN order_items oi ON p.product_id = oi.product_id "
            "GROUP BY p.product_name"
        ),
    },
    {
        "category": "joins",
        "nl_query": "What is the total revenue per product category from line items?",
        "gold_sql": (
            "SELECT p.category, SUM(oi.line_total) AS revenue "
            "FROM products p "
            "JOIN order_items oi ON p.product_id = oi.product_id "
            "GROUP BY p.category"
        ),
    },
    {
        "category": "joins",
        "nl_query": "How much has each customer tier spent in total order value?",
        "gold_sql": (
            "SELECT c.tier, SUM(o.order_total) AS total_spent "
            "FROM customers c "
            "JOIN orders o ON c.customer_id = o.customer_id "
            "GROUP BY c.tier"
        ),
    },
    {
        "category": "joins",
        "nl_query": "How many distinct products has each customer ordered?",
        "gold_sql": (
            "SELECT c.name, COUNT(DISTINCT oi.product_id) AS distinct_products "
            "FROM customers c "
            "JOIN orders o ON c.customer_id = o.customer_id "
            "JOIN order_items oi ON o.order_id = oi.order_id "
            "GROUP BY c.name"
        ),
    },

    # --------------------------------------------------------------- ranking/top-n
    {
        "category": "ranking",
        "nl_query": "Who is our single top customer by total order value?",
        "gold_sql": (
            "SELECT c.name, SUM(o.order_total) AS total "
            "FROM customers c "
            "JOIN orders o ON c.customer_id = o.customer_id "
            "GROUP BY c.name ORDER BY total DESC LIMIT 1"
        ),
    },
    {
        "category": "ranking",
        "nl_query": "What are the top 3 best selling products by quantity sold?",
        "gold_sql": (
            "SELECT p.product_name, SUM(oi.quantity) AS total_sold "
            "FROM products p "
            "JOIN order_items oi ON p.product_id = oi.product_id "
            "GROUP BY p.product_name ORDER BY total_sold DESC LIMIT 3"
        ),
    },
    {
        "category": "ranking",
        "nl_query": "Which product has the highest unit price?",
        "gold_sql": "SELECT product_name FROM products ORDER BY unit_price DESC LIMIT 1",
    },
    {
        "category": "ranking",
        "nl_query": "What are the 5 most expensive products?",
        "gold_sql": "SELECT product_name, unit_price FROM products ORDER BY unit_price DESC LIMIT 5",
    },
    {
        "category": "ranking",
        "nl_query": "Which 3 customers placed the most orders?",
        "gold_sql": (
            "SELECT c.name, COUNT(o.order_id) AS num_orders "
            "FROM customers c "
            "JOIN orders o ON c.customer_id = o.customer_id "
            "GROUP BY c.name ORDER BY num_orders DESC LIMIT 3"
        ),
    },
    {
        "category": "ranking",
        "nl_query": "What is the top product by total line revenue?",
        "gold_sql": (
            "SELECT p.product_name, SUM(oi.line_total) AS revenue "
            "FROM products p "
            "JOIN order_items oi ON p.product_id = oi.product_id "
            "GROUP BY p.product_name ORDER BY revenue DESC LIMIT 1"
        ),
    },
    {
        "category": "ranking",
        "nl_query": "Which payment method brought in the most money from successful payments?",
        "gold_sql": (
            "SELECT method, SUM(amount) AS total "
            "FROM payments WHERE status = 'paid' "
            "GROUP BY method ORDER BY total DESC LIMIT 1"
        ),
    },

    # ------------------------------------------------------------------ time-based
    {
        "category": "time",
        "nl_query": "What is our monthly revenue trend from completed orders?",
        "gold_sql": (
            "SELECT DATE_TRUNC('month', order_date) AS month, SUM(order_total) AS revenue "
            "FROM orders WHERE status = 'completed' "
            "GROUP BY month ORDER BY month"
        ),
    },
    {
        "category": "time",
        "nl_query": "How many orders were placed in 2026?",
        "gold_sql": "SELECT COUNT(*) AS orders_2026 FROM orders WHERE EXTRACT(YEAR FROM order_date) = 2026",
    },
    {
        "category": "time",
        "nl_query": "How many orders did we get per month?",
        "gold_sql": (
            "SELECT DATE_TRUNC('month', order_date) AS month, COUNT(*) AS num_orders "
            "FROM orders GROUP BY month ORDER BY month"
        ),
    },
    {
        "category": "time",
        "nl_query": "What is the total successful payment amount collected per month?",
        "gold_sql": (
            "SELECT DATE_TRUNC('month', paid_date) AS month, SUM(amount) AS collected "
            "FROM payments WHERE status = 'paid' "
            "GROUP BY month ORDER BY month"
        ),
    },
    {
        "category": "time",
        "nl_query": "What was the date of the most recent order?",
        "gold_sql": "SELECT MAX(order_date) AS latest_order FROM orders",
    },

    # ------------------------------------------------------------------ profit/calc
    {
        "category": "calculation",
        "nl_query": "What is the total gross profit across all sold items?",
        "gold_sql": (
            "SELECT SUM(oi.line_total - (oi.quantity * p.cost)) AS gross_profit "
            "FROM order_items oi "
            "JOIN products p ON oi.product_id = p.product_id"
        ),
    },
    {
        "category": "calculation",
        "nl_query": "What is the profit margin amount per product?",
        "gold_sql": (
            "SELECT p.product_name, SUM(oi.line_total - (oi.quantity * p.cost)) AS profit "
            "FROM products p "
            "JOIN order_items oi ON p.product_id = oi.product_id "
            "GROUP BY p.product_name"
        ),
    },
    {
        "category": "calculation",
        "nl_query": "What is the average quantity per order line item?",
        "gold_sql": "SELECT AVG(quantity) AS avg_quantity FROM order_items",
    },
    {
        "category": "calculation",
        "nl_query": "What is the markup (price minus cost) for each product?",
        "gold_sql": "SELECT product_name, unit_price - cost AS markup FROM products",
    },
    {
        "category": "calculation",
        "nl_query": "What is the total revenue minus total product cost on sold items?",
        "gold_sql": (
            "SELECT SUM(oi.line_total) - SUM(oi.quantity * p.cost) AS net "
            "FROM order_items oi "
            "JOIN products p ON oi.product_id = p.product_id"
        ),
    },
]


def get_suite(category: str | None = None, sample: int | None = None) -> List[Dict[str, str]]:
    """Return the benchmark suite, optionally filtered by category and/or capped to `sample` items."""
    items = BENCHMARK_SUITE
    if category:
        items = [q for q in items if q["category"] == category.lower()]
    if sample is not None and sample > 0:
        items = items[:sample]
    return items
