from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any
from app.models.query_logs import QueryLog
from app.models.profiles import Profile
from app.models.conversations import Conversation
from app.models.uploaded_documents import UploadedDocument

class QueryRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # --- Query Logging ---
    async def log_query(
        self,
        user_id: str,
        question: str,
        generated_sql: Optional[str],
        execution_time_ms: Optional[int],
        rows_returned: Optional[int],
        status: str,
        error_message: Optional[str] = None
    ) -> QueryLog:
        log = QueryLog(
            user_id=user_id,
            question=question,
            generated_sql=generated_sql,
            execution_time_ms=execution_time_ms,
            rows_returned=rows_returned,
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

    async def get_all_logs(
        self,
        limit: int = 100,
        offset: int = 0,
        user: Optional[str] = None,
        status: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> List[QueryLog]:
        stmt = select(QueryLog).options(selectinload(QueryLog.user))
        if user:
            stmt = stmt.join(Profile, QueryLog.user_id == Profile.id).filter(
                or_(Profile.email.ilike(f"%{user}%"), Profile.full_name.ilike(f"%{user}%"))
            )
        if status:
            stmt = stmt.filter(QueryLog.status == status)
        if date_from:
            stmt = stmt.filter(QueryLog.created_at >= date_from)
        if date_to:
            stmt = stmt.filter(QueryLog.created_at <= date_to)
        stmt = stmt.order_by(QueryLog.created_at.desc()).limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # --- Profile / User Sync (Mapped for compatibility) ---
    async def get_profile_by_id(self, profile_id: str) -> Optional[Profile]:
        stmt = select(Profile).filter_by(id=profile_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all_profiles(self, limit: int = 50, offset: int = 0) -> List[Profile]:
        stmt = select(Profile).order_by(Profile.created_at.desc()).limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_profile_role(self, profile_id: str, role: str) -> Optional[Profile]:
        stmt = select(Profile).filter_by(id=profile_id)
        result = await self.db.execute(stmt)
        profile = result.scalar_one_or_none()
        if profile:
            profile.role = role
            await self.db.commit()
            await self.db.refresh(profile)
        return profile

    # --- System Analytics & Stats ---
    async def get_system_stats(self) -> Dict[str, Any]:
        user_count_stmt = select(func.count(Profile.id))
        conv_count_stmt = select(func.count(Conversation.conversation_id))
        query_count_stmt = select(func.count(QueryLog.log_id))
        doc_count_stmt = select(func.count(UploadedDocument.document_id))

        success_count_stmt = select(func.count(QueryLog.log_id)).filter_by(status="success")

        user_count = (await self.db.execute(user_count_stmt)).scalar() or 0
        conv_count = (await self.db.execute(conv_count_stmt)).scalar() or 0
        query_count = (await self.db.execute(query_count_stmt)).scalar() or 0
        doc_count = (await self.db.execute(doc_count_stmt)).scalar() or 0
        success_count = (await self.db.execute(success_count_stmt)).scalar() or 0

        success_rate = (success_count / query_count * 100) if query_count > 0 else 100.0

        return {
            "total_users": user_count,
            "total_conversations": conv_count,
            "total_queries": query_count,
            "total_documents": doc_count,
            "query_success_rate": round(success_rate, 2)
        }
