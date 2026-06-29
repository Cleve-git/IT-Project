from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.core.database import get_db
from app.core.security import require_admin
from app.domain.models import Profile, BenchmarkResult
from app.api.schemas import (
    SystemStatsResponse, QueryLogResponse, ProfileResponse, 
    UpdateRoleRequest, BenchmarkResultResponse
)
from app.infrastructure.repositories.profile_repository import ProfileRepository
from app.infrastructure.repositories.query_log_repository import QueryLogRepository
from app.application.services.analyst_service import AnalystService

router = APIRouter(prefix="/admin", tags=["Admin Operations"], dependencies=[Depends(require_admin)])

# Predefined standard test suite for SQL Compiler benchmarking
BENCHMARK_SUITE = [
    {
        "nl_query": "What is the total revenue we generated?",
        "expected_sql": "SELECT SUM(amount) FROM payments WHERE status = 'Success';"
    },
    {
        "nl_query": "Find the top customer by order total.",
        "expected_sql": "SELECT c.name, SUM(o.order_total) as total FROM customers c JOIN orders o ON c.customer_id = o.customer_id GROUP BY c.name ORDER BY total DESC LIMIT 1;"
    },
    {
        "nl_query": "What are our best selling products by quantity sold?",
        "expected_sql": "SELECT p.product_name, SUM(oi.quantity) as sold FROM products p JOIN order_items oi ON p.product_id = oi.product_id GROUP BY p.product_name ORDER BY sold DESC;"
    }
]

@router.get("/stats", response_model=SystemStatsResponse)
async def get_system_stats(db: AsyncSession = Depends(get_db)):
    """Fetch high-level system usage statistics, counts, and query health rates."""
    repo = ProfileRepository(db)
    stats = await repo.get_system_stats()
    return stats


@router.get("/logs", response_model=List[QueryLogResponse])
async def get_query_logs(limit: int = 100, db: AsyncSession = Depends(get_db)):
    """Retrieve audit log history of all compiled SQL statements across the platform."""
    repo = QueryLogRepository(db)
    return await repo.get_all(limit=limit)


@router.get("/users", response_model=List[ProfileResponse])
async def list_users(limit: int = 50, offset: int = 0, db: AsyncSession = Depends(get_db)):
    """List all registered system users and profiles."""
    repo = ProfileRepository(db)
    return await repo.get_all(limit=limit, offset=offset)


@router.put("/users/{profile_id}/role", response_model=ProfileResponse)
async def update_user_role(
    profile_id: str,
    payload: UpdateRoleRequest,
    db: AsyncSession = Depends(get_db)
):
    """Modify role configurations (escalate to admin, demote to user)."""
    if payload.role not in ["admin", "user"]:
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'user'")
        
    repo = ProfileRepository(db)
    updated = await repo.update_role(profile_id, payload.role)
    if not updated:
        raise HTTPException(status_code=404, detail="User profile not found")
    return updated


@router.post("/benchmarks/run", response_model=List[BenchmarkResultResponse])
async def run_benchmarks(db: AsyncSession = Depends(get_db)):
    """
    Triggers an automated compile test on a golden dataset of questions.
    Validates SQL generation, execution success, and measures compiler latencies.
    """
    analyst_service = AnalystService(db)
    results = []

    for test in BENCHMARK_SUITE:
        nl = test["nl_query"]
        expected = test["expected_sql"]
        
        # Track compilation performance
        import time
        start_time = time.time()
        
        is_ambiguous, clarification, sql, reasoning = await analyst_service.generate_sql(nl)
        duration = int((time.time() - start_time) * 1000)

        is_correct = False
        error_msg = None

        if not is_ambiguous and sql:
            # Simple heuristic matching: can verify query syntax by executing it
            try:
                is_safe = await analyst_service.check_sql_safety(sql)
                if is_safe:
                    await analyst_service.execute_sql(sql)
                    is_correct = True  # SQL ran successfully without error
                else:
                    error_msg = "Safety validation failed"
            except Exception as e:
                error_msg = str(e)
        else:
            error_msg = clarification or "Compiled query was marked ambiguous or empty"

        benchmark = BenchmarkResult(
            nl_query=nl,
            expected_sql=expected,
            generated_sql=sql,
            is_correct=is_correct,
            execution_time_ms=duration,
            error_message=error_msg
        )
        db.add(benchmark)
        results.append(benchmark)

    await db.commit()
    # Refresh all objects
    for r in results:
        await db.refresh(r)
        
    return results
