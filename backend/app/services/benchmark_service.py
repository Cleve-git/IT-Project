import time
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any, Tuple
from app.repositories.benchmark_repository import BenchmarkRepository
from app.services.sql_service import SqlService
from app.services.chat_service import ChatService
from app.schemas.benchmark import BenchmarkRunResponse, BenchmarkSummary, BenchmarkResultResponse
from app.models.benchmark_questions import BenchmarkQuestion

# Standard golden queries dataset to seed if database is blank
GOLDEN_TESTS = [
    {
        "question": "What is the total revenue we generated?",
        "gold_sql": "SELECT SUM(amount) FROM payments WHERE status = 'Success';",
        "gold_answer": "total_revenue"
    },
    {
        "question": "Find the top customer by order total.",
        "gold_sql": "SELECT c.name, SUM(o.order_total) as total FROM customers c JOIN orders o ON c.customer_id = o.customer_id GROUP BY c.name ORDER BY total DESC LIMIT 1;",
        "gold_answer": "customer_name"
    },
    {
        "question": "What are our best selling products by quantity sold?",
        "gold_sql": "SELECT p.product_name, SUM(oi.quantity) as sold FROM products p JOIN order_items oi ON p.product_id = oi.product_id GROUP BY p.product_name ORDER BY sold DESC;",
        "gold_answer": "product_name"
    },
    {
        "question": "How many customers do we have?",
        "gold_sql": "SELECT COUNT(*) FROM customers;",
        "gold_answer": "customer_count"
    },
    {
        "question": "List all products with their unit prices.",
        "gold_sql": "SELECT product_name, unit_price FROM products ORDER BY product_name;",
        "gold_answer": "product_list"
    },
    {
        "question": "What is the total number of orders?",
        "gold_sql": "SELECT COUNT(*) FROM orders;",
        "gold_answer": "order_count"
    },
    {
        "question": "Show total payments by payment method.",
        "gold_sql": "SELECT method, SUM(amount) as total FROM payments GROUP BY method ORDER BY total DESC;",
        "gold_answer": "payment_by_method"
    },
    {
        "question": "Which customers are from Jakarta?",
        "gold_sql": "SELECT name, email FROM customers WHERE city = 'Jakarta';",
        "gold_answer": "jakarta_customers"
    },
    {
        "question": "What is the average order total?",
        "gold_sql": "SELECT AVG(order_total) FROM orders;",
        "gold_answer": "average_order_total"
    },
    {
        "question": "Show monthly revenue totals.",
        "gold_sql": "SELECT DATE_TRUNC('month', payment_date) as month, SUM(amount) as revenue FROM payments WHERE status = 'Success' GROUP BY month ORDER BY month;",
        "gold_answer": "monthly_revenue"
    },
    {
        "question": "Which products are in the Electronics category?",
        "gold_sql": "SELECT product_name, unit_price FROM products WHERE category = 'Electronics' ORDER BY product_name;",
        "gold_answer": "electronics_products"
    },
    {
        "question": "Show top 5 customers by total spend.",
        "gold_sql": "SELECT c.name, SUM(p.amount) as total_spent FROM customers c JOIN orders o ON c.customer_id = o.customer_id JOIN payments p ON o.order_id = p.order_id WHERE p.status = 'Success' GROUP BY c.name ORDER BY total_spent DESC LIMIT 5;",
        "gold_answer": "top_customers"
    },
    {
        "question": "What is the total quantity sold per product?",
        "gold_sql": "SELECT p.product_name, SUM(oi.quantity) as total_qty FROM products p JOIN order_items oi ON p.product_id = oi.product_id GROUP BY p.product_name ORDER BY total_qty DESC;",
        "gold_answer": "qty_per_product"
    },
    {
        "question": "How many orders were placed this year?",
        "gold_sql": "SELECT COUNT(*) FROM orders WHERE EXTRACT(year FROM order_date) = EXTRACT(year FROM CURRENT_DATE);",
        "gold_answer": "orders_this_year"
    },
    {
        "question": "List customers with their total number of orders.",
        "gold_sql": "SELECT c.name, COUNT(o.order_id) as order_count FROM customers c LEFT JOIN orders o ON c.customer_id = o.customer_id GROUP BY c.name ORDER BY order_count DESC;",
        "gold_answer": "customer_order_counts"
    }
]

class BenchmarkService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = BenchmarkRepository(db)
        self.sql_service = SqlService()
        self.chat_service = ChatService(db)

    async def seed_questions_if_needed(self):
        questions = await self.repo.get_all_questions()
        if not questions:
            for item in GOLDEN_TESTS:
                await self.repo.create_question(
                    question=item["question"],
                    gold_sql=item["gold_sql"],
                    gold_answer=item["gold_answer"]
                )

    async def run_benchmarks(self) -> BenchmarkRunResponse:
        """Executes the test suite, evaluates generated vs expected SQL, and returns stats."""
        await self.seed_questions_if_needed()
        questions = await self.repo.get_all_questions()
        
        results_list = []
        passed_count = 0
        total_time = 0
        
        for q in questions:
            start_time = time.time()
            is_ambiguous, clarification, gen_sql, reasoning = await self.sql_service.generate_sql(q.question)
            compile_time = int((time.time() - start_time) * 1000)
            
            passed = False
            expected_answer = None
            actual_answer = None
            err_msg = None

            try:
                gold_cols, gold_rows, _ = await self.chat_service.execute_query(q.gold_sql)
                expected_answer = str(gold_rows[:2])
            except Exception as e:
                expected_answer = f"Gold execution failed: {str(e)}"

            if gen_sql and not is_ambiguous:
                try:
                    gen_cols, gen_rows, _ = await self.chat_service.execute_query(gen_sql)
                    actual_answer = str(gen_rows[:2])

                    if gen_rows and gold_rows:
                        same_row_count = len(gen_rows) == len(gold_rows)
                        same_col_set = set(gen_cols) == set(gold_cols) if gold_cols else True
                        if len(gold_rows) == 1 and len(gold_cols) == 1:
                            gold_val = list(gold_rows[0].values())[0]
                            gen_val = list(gen_rows[0].values())[0] if gen_rows else None
                            passed = str(gold_val) == str(gen_val)
                        else:
                            passed = same_row_count and same_col_set
                    elif not gen_rows and not gold_rows:
                        passed = True
                except Exception as db_err:
                    err_msg = str(db_err)
                    actual_answer = f"Execution error: {err_msg}"
            else:
                err_msg = clarification or "Query marked ambiguous or empty compilation"
                actual_answer = err_msg

            res_obj = await self.repo.create_result(
                benchmark_id=q.benchmark_id,
                generated_sql=gen_sql,
                expected_sql=q.gold_sql,
                expected_answer=expected_answer,
                actual_answer=actual_answer,
                passed=passed,
                execution_time_ms=compile_time,
                model_name="llama-3.3-70b-versatile"
            )
            
            if passed:
                passed_count += 1
            total_time += compile_time
            
            results_list.append(BenchmarkResultResponse(
                result_id=res_obj.result_id,
                benchmark_id=res_obj.benchmark_id,
                generated_sql=res_obj.generated_sql,
                expected_sql=res_obj.expected_sql,
                expected_answer=res_obj.expected_answer,
                actual_answer=res_obj.actual_answer,
                passed=res_obj.passed,
                execution_time_ms=res_obj.execution_time_ms,
                model_name=res_obj.model_name,
                created_at=res_obj.created_at
            ))

        total_tests = len(questions)
        failed_count = total_tests - passed_count
        pass_rate = (passed_count / total_tests * 100) if total_tests > 0 else 0.0
        avg_time = (total_time / total_tests) if total_tests > 0 else 0.0
        sql_accuracy = pass_rate

        summary = BenchmarkSummary(
            total_tests=total_tests,
            passed_tests=passed_count,
            failed_tests=failed_count,
            pass_rate=round(pass_rate, 2),
            average_execution_time_ms=round(avg_time, 2),
            sql_accuracy=round(sql_accuracy, 2),
            token_usage=0
        )

        return BenchmarkRunResponse(summary=summary, results=results_list)

    async def get_benchmark_results(self, limit: int = 100) -> List[BenchmarkResultResponse]:
        """Lists historical benchmark result logs."""
        results = await self.repo.get_all_results(limit=limit)
        return [
            BenchmarkResultResponse(
                result_id=r.result_id,
                benchmark_id=r.benchmark_id,
                generated_sql=r.generated_sql,
                expected_sql=r.expected_sql,
                expected_answer=r.expected_answer,
                actual_answer=r.actual_answer,
                passed=r.passed,
                execution_time_ms=r.execution_time_ms,
                model_name=r.model_name,
                created_at=r.created_at
            ) for r in results
        ]