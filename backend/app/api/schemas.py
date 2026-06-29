from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime

# --- Profile & Auth ---
class ProfileBase(BaseModel):
    email: str
    full_name: Optional[str] = None

class ProfileCreate(ProfileBase):
    id: str  # Supabase ID

class ProfileResponse(ProfileBase):
    id: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

class UpdateRoleRequest(BaseModel):
    role: str = Field(..., description="Role to assign: 'admin' or 'user'")


# --- Chat & Conversations ---
class ConversationCreate(BaseModel):
    title: Optional[str] = Field(default="New Conversation")

class ConversationResponse(BaseModel):
    conversation_id: str
    user_id: str
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MessageResponse(BaseModel):
    message_id: str
    conversation_id: str
    role: str
    content: str
    generated_sql: Optional[str] = None
    sql_results: Optional[Dict[str, Any]] = None
    visualization_config: Optional[Dict[str, Any]] = None
    explanation: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class QueryRequest(BaseModel):
    conversation_id: Optional[str] = Field(None, description="Optional conversation UUID to continue a thread")
    query_text: str = Field(..., description="Natural language question to compile to SQL")


# --- Document Processing ---
class DocumentResponse(BaseModel):
    document_id: str
    user_id: str
    filename: str
    file_type: str
    file_size: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class ExtractedTableResponse(BaseModel):
    table_id: str
    document_id: str
    table_name: str
    headers: List[str]
    rows: List[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


# --- Feedback ---
class FeedbackCreate(BaseModel):
    message_id: str
    rating: int = Field(..., ge=1, le=5, description="1 for dislike/incorrect, 5 for like/correct")
    comment: Optional[str] = None

class FeedbackResponse(BaseModel):
    feedback_id: str
    message_id: str
    user_id: str
    rating: int
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Admin & Benchmarking ---
class QueryLogResponse(BaseModel):
    log_id: str
    user_id: str
    query_text: str
    executed_sql: Optional[str] = None
    execution_duration_ms: Optional[int] = None
    status: str
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class SystemStatsResponse(BaseModel):
    total_users: int
    total_conversations: int
    total_queries: int
    total_documents: int
    query_success_rate: float

class BenchmarkResultResponse(BaseModel):
    benchmark_id: str
    nl_query: str
    expected_sql: str
    generated_sql: Optional[str] = None
    is_correct: bool
    execution_time_ms: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
