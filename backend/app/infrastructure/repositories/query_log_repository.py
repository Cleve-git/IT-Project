from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload
from sqlalchemy import or_, and_
from datetime import datetime
from typing import List, Optional
from app.domain.models import QueryLog, Profile

class QueryLogRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log_query(
        self,
        user_id: str,
        query_text: str,
        executed_sql: Optional[str],
        execution_duration_ms: Optional[int],
        status: str,
        error_message: Optional[str] = None
    ) -> QueryLog:
        log = QueryLog(
            user_id=user_id,
            query_text=query_text,
            executed_sql=executed_sql,
            execution_duration_ms=execution_duration_ms,
            status=status,
            error_message=error_message
        )
        self.db.add(log)
        await self.db.commit()
        await self.db.refresh(log)
        return log

    async def get_by_user(self, user_id: str, limit: int = 50) -> List[QueryLog]:
        stmt = select(QueryLog).filter_by(user_id=user_id).order_by(QueryLog.created_at.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_all(self, limit: int = 100) -> List[QueryLog]:
        return await self.get_filtered(limit=limit)

    async def get_filtered(
        self,
        status: Optional[str] = None,
        user_query: Optional[str] = None,
        search: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 200,
    ) -> List[QueryLog]:
        """Query logs filtered by status, user (id/email), free-text query search and a date range."""
        stmt = select(QueryLog).options(joinedload(QueryLog.user))
        conds = []

        if status and status.lower() != "all":
            conds.append(QueryLog.status == status.lower())
        if search:
            conds.append(QueryLog.query_text.ilike(f"%{search}%"))
        if start_date:
            conds.append(QueryLog.created_at >= start_date)
        if end_date:
            conds.append(QueryLog.created_at <= end_date)
        if user_query:
            stmt = stmt.join(Profile, QueryLog.user_id == Profile.id)
            conds.append(or_(
                Profile.email.ilike(f"%{user_query}%"),
                QueryLog.user_id.ilike(f"%{user_query}%"),
            ))

        if conds:
            stmt = stmt.where(and_(*conds))
        stmt = stmt.order_by(QueryLog.created_at.desc()).limit(limit)

        result = await self.db.execute(stmt)
        logs = list(result.scalars().unique().all())
        # Expose the user's email for display/filtering (transient attribute)
        for log in logs:
            log.user_email = log.user.email if getattr(log, "user", None) else None
        return logs
