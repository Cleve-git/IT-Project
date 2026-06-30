from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from typing import List, Optional
from app.domain.models import Conversation, Message, Feedback, ConversationContext

class ConversationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: str, title: str) -> Conversation:
        conversation = Conversation(user_id=user_id, title=title)
        self.db.add(conversation)
        await self.db.commit()
        await self.db.refresh(conversation)
        return conversation

    async def get_by_id(self, conversation_id: str) -> Optional[Conversation]:
        stmt = select(Conversation).filter_by(conversation_id=conversation_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all_by_user(self, user_id: str) -> List[Conversation]:
        stmt = select(Conversation).filter_by(user_id=user_id).order_by(Conversation.updated_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def delete(self, conversation_id: str) -> bool:
        """
        Delete a conversation and all rows that reference it, in FK-safe order
        (feedback -> messages -> context -> conversation). The ORM relationship
        cascade does not fire for Core bulk deletes, so we remove children
        explicitly to avoid a foreign-key violation.
        """
        msg_ids = (
            await self.db.execute(
                select(Message.message_id).filter_by(conversation_id=conversation_id)
            )
        ).scalars().all()

        if msg_ids:
            await self.db.execute(delete(Feedback).where(Feedback.message_id.in_(msg_ids)))
        await self.db.execute(delete(Message).filter_by(conversation_id=conversation_id))
        await self.db.execute(delete(ConversationContext).filter_by(conversation_id=conversation_id))
        result = await self.db.execute(delete(Conversation).filter_by(conversation_id=conversation_id))
        await self.db.commit()
        return (result.rowcount or 0) > 0

    async def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        generated_sql: Optional[str] = None,
        sql_results: Optional[dict] = None,
        visualization_config: Optional[dict] = None,
        explanation: Optional[str] = None
    ) -> Message:
        message = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
            generated_sql=generated_sql,
            sql_results=sql_results,
            visualization_config=visualization_config,
            explanation=explanation
        )
        self.db.add(message)
        
        # Touch conversation updated_at
        stmt = select(Conversation).filter_by(conversation_id=conversation_id)
        res = await self.db.execute(stmt)
        conv = res.scalar_one_or_none()
        if conv:
            from datetime import datetime
            conv.updated_at = datetime.utcnow()
            
        await self.db.commit()
        await self.db.refresh(message)
        return message

    async def get_messages(self, conversation_id: str) -> List[Message]:
        stmt = select(Message).filter_by(conversation_id=conversation_id).order_by(Message.created_at.asc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
