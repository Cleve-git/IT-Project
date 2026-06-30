import time
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
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
from app.application.benchmarks.benchmark_suite import get_suite

router = APIRouter(prefix="/admin", tags=["Admin Operations"], dependencies=[Depends(require_admin)])

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
async def run_benchmarks(
    category: Optional[str] = None,
    sample: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Evaluates the NL->SQL agent against the golden benchmark dataset and measures
    **execution accuracy**: for each question both the generated SQL and the gold
    SQL are executed against the live database and their result sets are compared.
    A case is correct only when the generated query returns the same data as the
    gold answer (order- and alias-insensitive) — not merely when it runs.

    Optional `category` (e.g. aggregation, joins, ranking) and `sample` (cap the
    number of questions) filters keep runs fast and avoid LLM rate limits.
    """
    analyst_service = AnalystService(db)
    suite = get_suite(category=category, sample=sample)

    async def safe_exec(sql: str):
        """Execute a read query, recovering the session if Postgres aborts the transaction."""
        try:
            _, rows, _ = await analyst_service.execute_sql(sql)
            return rows, None
        except Exception as err:
            # A failed statement poisons the current transaction; roll back so the
            # next benchmark case can still run. No writes are pending yet (results
            # are persisted only after the loop), so nothing is lost.
            await db.rollback()
            return None, str(err)

    # Evaluate everything first, persist afterwards, so a single bad generated query
    # cannot abort the transaction that stores the results.
    scored: List[dict] = []

    for test in suite:
        nl = test["nl_query"]
        gold_sql = test["gold_sql"]

        start_time = time.time()  # measure end-to-end compile + execution
        is_ambiguous, clarification, gen_sql, reasoning = await analyst_service.generate_sql(nl)

        is_correct = False
        error_msg: Optional[str] = None

        if is_ambiguous or not gen_sql:
            error_msg = clarification or "Agent marked the question ambiguous or produced no SQL"
        elif not await analyst_service.check_sql_safety(gen_sql):
            error_msg = "Guardrail blocked generated SQL (not read-only)"
        else:
            # Gold answer is trusted/static; a failure here means the benchmark entry is broken.
            gold_rows, gold_err = await safe_exec(gold_sql)
            if gold_err:
                error_msg = f"Gold query failed to execute: {gold_err}"
            else:
                gen_rows, gen_err = await safe_exec(gen_sql)
                if gen_err:
                    error_msg = f"Generated SQL failed to execute: {gen_err}"
                else:
                    is_correct = analyst_service.compare_result_sets(gold_rows, gen_rows)
                    if not is_correct:
                        error_msg = "Result set did not match the gold answer"

        scored.append({
            "nl_query": nl,
            "expected_sql": gold_sql,
            "generated_sql": gen_sql,
            "is_correct": is_correct,
            "execution_time_ms": int((time.time() - start_time) * 1000),
            "error_message": error_msg,
            "category": test["category"],
        })

    # Return the computed evaluation directly. The pre-provisioned
    # `benchmark_results` table ships with a different, normalized schema
    # (result_id / passed / actual_answer / model_name, with the question stored
    # separately in `benchmark_questions`), so we don't force these rows into it
    # via the ORM — the result is returned to the client for display.
    import uuid as _uuid
    from datetime import datetime as _dt
    return [
        BenchmarkResultResponse(
            benchmark_id=str(_uuid.uuid4()),
            nl_query=s["nl_query"],
            expected_sql=s["expected_sql"],
            generated_sql=s["generated_sql"],
            is_correct=s["is_correct"],
            execution_time_ms=s["execution_time_ms"],
            error_message=s["error_message"],
            category=s["category"],
            created_at=_dt.utcnow(),
        )
        for s in scored
    ]
