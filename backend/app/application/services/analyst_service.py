import re
import json
import time
from typing import Dict, List, Optional, Tuple
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from langchain_groq import ChatGroq
from langchain.schema import HumanMessage, SystemMessage
from app.core.config import settings

# PostgreSQL Core Schema Definitions for LLM Prompt context
DB_SCHEMA_CONTEXT = """
Database schema:

customers(
    customer_id,
    name,
    city,
    tier,
    created_at
)

products(
    product_id,
    product_name,
    category,
    unit_price,
    cost
)

orders(
    order_id,
    customer_id,
    order_date,
    status,
    order_total
)

payments(
    payment_id,
    order_id,
    amount,
    method,
    paid_date,
    status
)

order_items(
    order_item_id,
    order_id,
    product_id,
    quantity,
    unit_price,
    line_total
)

Relationships:
customers.customer_id = orders.customer_id
orders.order_id = payments.order_id
orders.order_id = order_items.order_id
products.product_id = order_items.product_id

Business Definitions:
Revenue = SUM(payments.amount) WHERE payment status is Success/Completed/Paid (or sum payments.amount directly)
Profit = SUM(order_items.line_total) - SUM(order_items.quantity * products.cost)
Top Customer = customer with the highest SUM(orders.order_total)
Best Selling Product = product with the highest SUM(order_items.quantity)
"""

SYSTEM_PROMPT = f"""You are a PostgreSQL data analyst.

{DB_SCHEMA_CONTEXT}

Rules:
1. Generate PostgreSQL only.
2. Generate only SELECT or WITH statements.
3. Never generate INSERT, UPDATE, DELETE, DROP, ALTER, CREATE.
4. Never hallucinate columns.
5. Never hallucinate tables.
6. If the question is ambiguous or lacks enough information to write a valid query, ask a clarification question.
7. Return JSON only in the following schema:
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

    async def execute_sql(self, sql: str) -> Tuple[List[str], List[dict], int]:
        """
        Executes query and returns (columns, rows, execution_time_ms).
        """
        start_time = time.time()
        
        # Append limit if not exists to avoid pulling millions of records
        if "LIMIT" not in sql.upper():
            sql = f"SELECT * FROM ({sql}) AS subq LIMIT 100"

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

    async def generate_explanation(self, query: str, sql: str, rows: List[dict]) -> str:
        """Generates natural language explanation of the dataset results."""
        if self.is_mock:
            return f"Based on the query, here are the results for: '{query}'. The system queried the database and identified the relevant entries matching your parameters."

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
            return f"Found {len(rows)} entries matching the query parameters."

    def generate_plotly_config(self, columns: List[str], rows: List[dict]) -> Optional[dict]:
        """Recommends a chart layout for Plotly.js in the frontend based on output columns."""
        if not rows or len(columns) < 2:
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
            return (True, "Would you like to calculate revenue for Completed orders only, or include Cancelled and Pending orders too?", None, "Ambiguous criteria detected.")

        if "customer" in qt and "revenue" in qt:
            sql = """
            SELECT c.name, SUM(p.amount) as revenue
            FROM customers c
            JOIN orders o ON c.customer_id = o.customer_id
            JOIN payments p ON o.order_id = p.order_id
            WHERE p.status = 'Success'
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
            sql = """
            SELECT DATE_TRUNC('month', order_date) as month, SUM(order_total) as monthly_revenue
            FROM orders
            WHERE status = 'Completed'
            GROUP BY month
            ORDER BY month ASC;
            """
            return (False, None, sql, "Summing order totals over time grouped by month.")
            
        else:
            # Catch-all basic select
            sql = "SELECT * FROM customers LIMIT 10;"
            return (False, None, sql, "Default fallback database inspection query.")
