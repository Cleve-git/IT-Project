from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List, Optional, Dict
from app.domain.models import Profile, QueryLog, Conversation, UploadedDocument

class ProfileRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, profile_id: str) -> Optional[Profile]:
        stmt = select(Profile).filter_by(id=profile_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all(self, limit: int = 50, offset: int = 0) -> List[Profile]:
        stmt = select(Profile).order_by(Profile.created_at.desc()).limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_role(self, profile_id: str, role: str) -> Optional[Profile]:
        stmt = select(Profile).filter_by(id=profile_id)
        result = await self.db.execute(stmt)
        profile = result.scalar_one_or_none()
        if profile:
            profile.role = role
            await self.db.commit()
            await self.db.refresh(profile)
        return profile

    async def get_system_stats(self) -> Dict[str, any]:
        """Aggregate stats across profiles, conversations, queries, and documents for the admin panel."""
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
