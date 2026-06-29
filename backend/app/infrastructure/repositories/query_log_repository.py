from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from app.domain.models import QueryLog

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
        stmt = select(QueryLog).order_by(QueryLog.created_at.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
