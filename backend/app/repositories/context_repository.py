from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime
from typing import Optional
from app.domain.models import ConversationContext


class ConversationContextRepository:
    """Stores/clears the one outstanding clarification per conversation."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_pending(self, conversation_id: str) -> Optional[ConversationContext]:
        stmt = select(ConversationContext).filter_by(conversation_id=conversation_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def set_pending(self, conversation_id: str, pending_intent: str, clarification: str) -> None:
        """Record (or overwrite) the pending clarification for a conversation."""
        existing = await self.get_pending(conversation_id)
        if existing:
            existing.pending_intent = pending_intent
            existing.missing_fields = {"clarification": clarification}
            existing.updated_at = datetime.utcnow()
        else:
            self.db.add(ConversationContext(
                conversation_id=conversation_id,
                pending_intent=pending_intent,
                missing_fields={"clarification": clarification},
                collected_data={},
            ))
        await self.db.commit()

    async def clear(self, conversation_id: str) -> None:
        existing = await self.get_pending(conversation_id)
        if existing:
            await self.db.delete(existing)
            await self.db.commit()
