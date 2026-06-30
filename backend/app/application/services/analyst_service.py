import re
import json
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from langchain_groq import ChatGroq
from langchain.schema import HumanMessage, SystemMessage
from app.core.config import settings

# PostgreSQL Core Schema Definitions for LLM Prompt context.
# IMPORTANT: column values below are the EXACT, case-sensitive enums in the
# seeded database. Filtering on any other casing/spelling returns zero rows.
DB_SCHEMA_CONTEXT = """
Database schema (PostgreSQL):

customers(
    customer_id INT,
    name TEXT,
    city TEXT,                 -- Indonesian cities, e.g. 'Jakarta', 'Surabaya', 'Bandung', 'Medan'
    tier TEXT,                 -- allowed values (case-sensitive): 'Gold', 'Silver', 'Bronze'
    created_at TIMESTAMP
)

products(
    product_id INT,
    product_name TEXT,
    category TEXT,             -- allowed: 'Beauty','Electronics','Fashion','Grocery','Home','Office','Sports','Toys'
    unit_price NUMERIC,        -- Indonesian Rupiah (IDR), typically 25,000 - 1,200,000
    cost NUMERIC
)

orders(
    order_id INT,
    customer_id INT,
    order_date DATE,           -- ranges roughly 2025-01-01 .. 2026-05-31
    status TEXT,               -- allowed values (lowercase): 'completed', 'cancelled', 'refunded'
    order_total NUMERIC
)

payments(
    payment_id INT,
    order_id INT,
    amount NUMERIC,
    method TEXT,               -- allowed: 'credit_card', 'e_wallet', 'bank_transfer', 'virtual_account'
    paid_date DATE,
    status TEXT                -- allowed values (lowercase): 'paid', 'refunded'
)

order_items(
    order_item_id INT,
    order_id INT,
    product_id INT,
    quantity INT,
    unit_price NUMERIC,
    line_total NUMERIC
)

Relationships:
customers.customer_id = orders.customer_id
orders.order_id = payments.order_id
orders.order_id = order_items.order_id
products.product_id = order_items.product_id

Business Definitions (use these EXACT literal values):
Revenue / total sales = SUM(payments.amount) WHERE payments.status = 'paid'
A "completed" / fulfilled order has orders.status = 'completed'
Profit = SUM(order_items.line_total) - SUM(order_items.quantity * products.cost)
Top Customer = customer with the highest SUM(orders.order_total)
Best Selling Product = product with the highest SUM(order_items.quantity)
For month/quarter grouping use DATE_TRUNC('month'|'quarter', order_date) (order_date is a DATE).
"""

SYSTEM_PROMPT = f"""You are a PostgreSQL data analyst.

{DB_SCHEMA_CONTEXT}

Rules:
1. Generate PostgreSQL only.
2. Generate only SELECT or WITH statements.
3. Never generate INSERT, UPDATE, DELETE, DROP, ALTER, CREATE.
4. Never hallucinate columns.
5. Never hallucinate tables.
6. Select ONLY the columns needed to answer the question, plus any aggregate the
   question asks for. Do not use SELECT * and do not add id columns unless the
   user asked for them (e.g. "list customers in Jakarta" -> SELECT name ...).
7. "price", "costs more than", "cheapest/most expensive" refer to products.unit_price
   (the selling price). products.cost is the internal cost of goods — use it ONLY
   for profit/margin/markup calculations, never as the product's price.
8. If the question is ambiguous or lacks enough information to write a valid query, ask a clarification question.
9. Return JSON only in the following schema:
{{
  "is_ambiguous": boolean,
  "clarification_question": string or null,
  "sql": string or null,
  "reasoning": string
}}
"""

class AnalystService:
    def __init__(self, db: AsyncSession):
        self.db = db
        # Initialise LLMs with fallbacks for mock runs
        if settings.GROQ_API_KEY != "mock-groq-key" and len(settings.GROQ_API_KEY) > 10:
            self.sql_llm = ChatGroq(
                model=settings.SQL_GENERATION_MODEL,
                groq_api_key=settings.GROQ_API_KEY,
                temperature=0.0
            )
            self.exp_llm = ChatGroq(
                model=settings.EXPLANATION_MODEL,
                groq_api_key=settings.GROQ_API_KEY,
                temperature=0.3
            )
            self.is_mock = False
        else:
            self.is_mock = True

    async def generate_sql(self, query_text: str, chat_history: List[dict] = []) -> Tuple[bool, Optional[str], Optional[str], str]:
        """
        Uses LLM to convert Natural Language to SQL.
        Returns: (is_ambiguous, clarification_question, sql, reasoning)
        """
        if self.is_mock:
            return self._mock_sql_generation(query_text)

        messages = [
            SystemMessage(content=SYSTEM_PROMPT)
        ]
        
        # Add conversation history context if available
        for msg in chat_history[-6:]:  # limit context to last 3 turns
            messages.append(HumanMessage(content=f"User: {msg['user']}\nAnalyst: {msg['analyst']}"))
            
        messages.append(HumanMessage(content=f"Generate SQL for this question: {query_text}"))

        try:
            response = await self.sql_llm.ainvoke(messages)
            content = response.content.strip()
            
            # Extract JSON block if surrounded by markdown code fences
            json_match = re.search(r"```json\s*(.*?)\s*```", content, re.DOTALL)
            if json_match:
                content = json_match.group(1)
            
            parsed = json.loads(content)
            return (
                parsed.get("is_ambiguous", False),
                parsed.get("clarification_question"),
                parsed.get("sql"),
                parsed.get("reasoning", "")
            )
        except Exception as e:
            # Fallback to local regex rule-based engine if Groq fails or rates are exceeded
            print(f"Groq API call failed: {str(e)}. Falling back to mock engine.")
            return self._mock_sql_generation(query_text)

    async def check_sql_safety(self, sql: str) -> bool:
        """
        Validates that the SQL runs only SELECT or WITH statements,
        preventing code injection and modifications.
        """
        clean_sql = re.sub(r'--.*$', '', sql, flags=re.MULTILINE) # remove comments
        clean_sql = re.sub(r'/\*.*?\*/', '', clean_sql, flags=re.DOTALL) # remove block comments
        
        # Tokenize and identify command keywords
        tokens = re.findall(r'\b\w+\b', clean_sql.upper())
        
        disallowed = {"INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE", "REPLACE", "UPSERT", "GRANT", "REVOKE"}
        
        for token in tokens:
            if token in disallowed:
                return False
        
        # Check that it starts with SELECT or WITH
        first_word_match = re.match(r'^\s*(\w+)', clean_sql, re.IGNORECASE)
        if not first_word_match:
            return False
            
        first_word = first_word_match.group(1).upper()
        return first_word in {"SELECT", "WITH"}

    @staticmethod
    def _prepare_sql(sql: str) -> str:
        """Strip trailing semicolons/whitespace and cap result size with a LIMIT wrapper."""
        sql = sql.strip().rstrip(";").strip()
        # Append limit if not exists to avoid pulling millions of records
        if "LIMIT" not in sql.upper():
            sql = f"SELECT * FROM ({sql}) AS subq LIMIT 100"
        return sql

    async def execute_sql(self, sql: str) -> Tuple[List[str], List[dict], int]:
        """
        Executes query and returns (columns, rows, execution_time_ms).
        """
        start_time = time.time()

        sql = self._prepare_sql(sql)

        # Execute
        result = await self.db.execute(text(sql))
        columns = list(result.keys())
        
        rows = []
        for r in result.fetchall():
            row_dict = {}
            for col in columns:
                val = getattr(r, col)
                if isinstance(val, (Decimal, float)):
                    row_dict[col] = float(val)
                elif isinstance(val, datetime):
                    row_dict[col] = val.isoformat()
                else:
                    row_dict[col] = val
            rows.append(row_dict)

        duration = int((time.time() - start_time) * 1000)
        return columns, rows, duration

    @staticmethod
    def _normalize_cell(val) -> str:
        """Normalize a single value so equivalent results compare equal (float noise, None, etc.)."""
        if val is None:
            return ""
        if isinstance(val, bool):
            return str(val)
        if isinstance(val, (int, float, Decimal)):
            # Round to 2 dp and drop trailing zeros so 1500 == 1500.00 == 1500.0
            return f"{round(float(val), 2):.2f}".rstrip("0").rstrip(".")
        return str(val).strip()

    @classmethod
    def compare_result_sets(cls, gold_rows: List[dict], gen_rows: List[dict]) -> bool:
        """
        Execution-accuracy check: do two result sets carry the same data?

        Comparison is order-insensitive on both rows and columns (so column
        aliases and ORDER BY differences don't cause false negatives), and
        treats each result as a multiset of normalized rows.
        """
        def signature(rows: List[dict]):
            bag = {}
            for row in rows:
                # Sort the normalized values within a row so column order/alias is irrelevant
                key = tuple(sorted(cls._normalize_cell(v) for v in row.values()))
                bag[key] = bag.get(key, 0) + 1
            return bag

        return signature(gold_rows) == signature(gen_rows)

    @staticmethod
    def _describe_results(query: str, rows: List[dict]) -> str:
        """
        Build a meaningful business summary from the result rows WITHOUT an LLM.
        Used as the offline/rate-limited fallback so the user still gets a real
        answer sentence (e.g. "Your total revenue is 14,970,759,000") instead of
        a generic "found N rows" message.
        """
        if not rows:
            return "No matching records were found for your question."

        def fmt(v):
            if isinstance(v, bool):
                return str(v)
            if isinstance(v, (int, float, Decimal)):
                f = float(v)
                return f"{f:,.0f}" if f.is_integer() else f"{f:,.2f}"
            return str(v)

        cols = list(rows[0].keys())

        # Single scalar answer (e.g. a total, a count, an average).
        if len(rows) == 1 and len(cols) == 1:
            col = cols[0]
            return f"{query.strip().rstrip('?')}: {fmt(rows[0][col])} ({col.replace('_', ' ')})."

        # Single row with a few fields.
        if len(rows) == 1:
            parts = ", ".join(f"{c.replace('_', ' ')} {fmt(rows[0][c])}" for c in cols)
            return f"Here is the result — {parts}."

        # Multiple rows: report the count and describe the top (first) entry.
        top = ", ".join(f"{c.replace('_', ' ')} {fmt(rows[0][c])}" for c in cols)
        return f"Found {len(rows)} results. The top entry is {top}."

    async def generate_explanation(self, query: str, sql: str, rows: List[dict]) -> str:
        """Generates natural language explanation of the dataset results."""
        if self.is_mock:
            return self._describe_results(query, rows)

        prompt = f"""Explain the following query results to a business user:
Question: {query}
SQL Executed: {sql}
Results (First 5 rows): {json.dumps(rows[:5])}

Write a clean, professional, action-oriented business summary under 4 sentences. Keep the tone helpful.
"""
        messages = [
            SystemMessage(content="You are a data interpretation assistant."),
            HumanMessage(content=prompt)
        ]
        try:
            res = await self.exp_llm.ainvoke(messages)
            return res.content.strip()
        except Exception:
            # Rate-limited / offline: fall back to a deterministic business summary.
            return self._describe_results(query, rows)

    def generate_plotly_config(self, columns: List[str], rows: List[dict]) -> Optional[dict]:
        """Recommends a chart layout for Plotly.js in the frontend based on output columns."""
        # A chart needs at least two data points to be meaningful; a single-row
        # answer (e.g. a total or a single "top" result) is better left as text + grid.
        if not rows or len(rows) < 2 or len(columns) < 2:
            return None

        # Look for quantitative vs qualitative columns
        num_cols = []
        date_cols = []
        str_cols = []

        # Guess datatypes from first row
        first_row = rows[0]
        for col in columns:
            val = first_row.get(col)
            if isinstance(val, (int, float)):
                num_cols.append(col)
            elif isinstance(val, str):
                # Check if matches datetime string
                if re.match(r'^\d{4}-\d{2}-\d{2}', val):
                    date_cols.append(col)
                else:
                    str_cols.append(col)

        # Plotly configuration payload
        if (date_cols or str_cols) and num_cols:
            x_col = date_cols[0] if date_cols else str_cols[0]
            y_col = num_cols[0]
            
            chart_type = "line" if date_cols else "bar"
            
            # Simple bar or scatter plot
            return {
                "type": chart_type,
                "data": [
                    {
                        "x": [r.get(x_col) for r in rows],
                        "y": [r.get(y_col) for r in rows],
                        "type": chart_type,
                        "marker": {"color": "#6366f1"}
                    }
                ],
                "layout": {
                    "title": f"{y_col} by {x_col}",
                    "xaxis": {"title": x_col},
                    "yaxis": {"title": y_col},
                    "margin": {"t": 40, "b": 40, "l": 40, "r": 40},
                    "paper_bgcolor": "rgba(0,0,0,0)",
                    "plot_bgcolor": "rgba(0,0,0,0)",
                    "font": {"color": "#94a3b8"}
                }
            }
        
        return None

    def _mock_sql_generation(self, query_text: str) -> Tuple[bool, Optional[str], Optional[str], str]:
        """Mock SQL Generator for offline, testing, or development fallbacks."""
        qt = query_text.lower()
        
        # Check for ambiguity
        if "order" in qt and "revenue" in qt and "which" in qt:
            return (True, "Would you like to calculate revenue for completed orders only, or include cancelled and refunded orders too?", None, "Ambiguous criteria detected.")

        if "customer" in qt and "revenue" in qt:
            sql = """
            SELECT c.name, SUM(p.amount) as revenue
            FROM customers c
            JOIN orders o ON c.customer_id = o.customer_id
            JOIN payments p ON o.order_id = p.order_id
            WHERE p.status = 'paid'
            GROUP BY c.name
            ORDER BY revenue DESC
            LIMIT 5;
            """
            return (False, None, sql, "Joining customers, orders, and payments to find total success payments per customer.")
            
        elif "product" in qt or "selling" in qt:
            sql = """
            SELECT p.product_name, SUM(oi.quantity) as total_sold, SUM(oi.line_total) as total_revenue
            FROM products p
            JOIN order_items oi ON p.product_id = oi.product_id
            GROUP BY p.product_name
            ORDER BY total_sold DESC
            LIMIT 5;
            """
            return (False, None, sql, "Grouping order_items by product to identify best sellers by unit count.")
            
        elif "revenue" in qt or "sales" in qt:
            # Only break revenue down by month when the user explicitly asks for a trend.
            if any(k in qt for k in ("month", "monthly", "trend", "over time", "by month")):
                sql = """
                SELECT DATE_TRUNC('month', order_date) as month, SUM(order_total) as monthly_revenue
                FROM orders
                WHERE status = 'completed'
                GROUP BY month
                ORDER BY month ASC;
                """
                return (False, None, sql, "Summing order totals over time grouped by month.")
            # Default: a single total revenue figure from successful payments.
            sql = "SELECT SUM(amount) AS total_revenue FROM payments WHERE status = 'paid';"
            return (False, None, sql, "Summing all successful payment amounts for total revenue.")
            
        else:
            # Catch-all basic select
            sql = "SELECT * FROM customers LIMIT 10;"
            return (False, None, sql, "Default fallback database inspection query.")
