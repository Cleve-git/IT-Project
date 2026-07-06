import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Column, String, ForeignKey, DateTime, Text, Integer
from sqlalchemy.orm import relationship
from app.core.database import Base

class QueryLog(Base):
    __tablename__ = "query_logs"

    log_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("profiles.id"), nullable=False)
    question = Column(Text, nullable=False)
    generated_sql = Column(Text, nullable=True)
    execution_time_ms = Column(Integer, nullable=True)
    rows_returned = Column(Integer, nullable=True)
    status = Column(String(50), nullable=False)  # success, failed
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("Profile", back_populates="query_logs")

    @property
    def user_email(self) -> Optional[str]:
        return self.user.email if self.user else None

    @property
    def user_full_name(self) -> Optional[str]:
        return self.user.full_name if self.user else None
