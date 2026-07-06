from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.core.database import get_db
from app.core.security import require_admin
from app.schemas.chat import SystemStatsResponse, QueryLogResponse, ProfileResponse, UpdateRoleRequest
from app.schemas.benchmark import BenchmarkResultResponse
from app.repositories.query_repository import QueryRepository
from app.services.benchmark_service import BenchmarkService

router = APIRouter(prefix="/admin", tags=["Admin Operations"], dependencies=[Depends(require_admin)])

# --- Finalized Specification Endpoints ---

@router.get("/query-logs", response_model=List[QueryLogResponse])
async def get_query_logs_final(
    limit: int = 100,
    offset: int = 0,
    user: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve audit log history of all compiled SQL statements across the platform."""
    repo = QueryRepository(db)
    return await repo.get_all_logs(
        limit=limit, offset=offset, user=user, status=status, date_from=date_from, date_to=date_to
    )


@router.get("/analytics", response_model=SystemStatsResponse)
async def get_system_analytics(db: AsyncSession = Depends(get_db)):
    """Aggregate stats across profiles, conversations, queries, and documents for the admin panel."""
    repo = QueryRepository(db)
    stats = await repo.get_system_stats()
    return stats


# --- Frontend Compatibility Endpoints ---

@router.get("/stats", response_model=SystemStatsResponse)
async def get_system_stats_compat(db: AsyncSession = Depends(get_db)):
    """Get system stats alias for frontend."""
    repo = QueryRepository(db)
    return await repo.get_system_stats()


@router.get("/logs", response_model=List[QueryLogResponse])
async def get_query_logs_compat(
    limit: int = 100,
    offset: int = 0,
    user: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve audit query log history alias for frontend."""
    repo = QueryRepository(db)
    return await repo.get_all_logs(
        limit=limit, offset=offset, user=user, status=status, date_from=date_from, date_to=date_to
    )


@router.get("/users", response_model=List[ProfileResponse])
async def list_users(limit: int = 50, offset: int = 0, db: AsyncSession = Depends(get_db)):
    """List all registered system users."""
    repo = QueryRepository(db)
    return await repo.get_all_profiles(limit=limit, offset=offset)


@router.put("/users/{profile_id}/role", response_model=ProfileResponse)
async def update_user_role(
    profile_id: str,
    payload: UpdateRoleRequest,
    db: AsyncSession = Depends(get_db)
):
    """Modify role configuration for a profile."""
    if payload.role not in ["admin", "user"]:
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'user'")
        
    repo = QueryRepository(db)
    updated = await repo.update_profile_role(profile_id, payload.role)
    if not updated:
        raise HTTPException(status_code=404, detail="User profile not found")
    return updated


@router.post("/benchmarks/run", response_model=List[BenchmarkResultResponse])
async def run_benchmarks_compat(db: AsyncSession = Depends(get_db)):
    """Triggers compile testing alias for frontend."""
    service = BenchmarkService(db)
    try:
        res = await service.run_benchmarks()
        return res.results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
