from pydantic import BaseModel, Field, model_validator
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

    # New API fields for intent-based UI rendering
    type: str = "conversation"
    message: Optional[str] = None
    sql: Optional[str] = None
    results: Optional[List[Dict[str, Any]]] = None
    visualization: Optional[Dict[str, Any]] = None

    @model_validator(mode="before")
    @classmethod
    def populate_response_fields(cls, data: Any) -> Any:
        if hasattr(data, "generated_sql"):
            generated_sql = getattr(data, "generated_sql")
            content = getattr(data, "content")
            sql_results = getattr(data, "sql_results")
            visualization_config = getattr(data, "visualization_config")
        else:
            generated_sql = data.get("generated_sql") if isinstance(data, dict) else None
            content = data.get("content") if isinstance(data, dict) else ""
            sql_results = data.get("sql_results") if isinstance(data, dict) else None
            visualization_config = data.get("visualization_config") if isinstance(data, dict) else None

        if not isinstance(data, dict):
            # Parse SQLAlchemy ORM model to dictionary
            res_dict = {
                "message_id": getattr(data, "message_id"),
                "conversation_id": getattr(data, "conversation_id"),
                "role": getattr(data, "role"),
                "content": getattr(data, "content"),
                "generated_sql": getattr(data, "generated_sql"),
                "sql_results": getattr(data, "sql_results"),
                "visualization_config": getattr(data, "visualization_config"),
                "explanation": getattr(data, "explanation"),
                "created_at": getattr(data, "created_at"),
            }
        else:
            res_dict = data.copy()

        if generated_sql:
            res_dict["type"] = "query_result"
            res_dict["sql"] = generated_sql
            res_dict["results"] = sql_results.get("rows", []) if (sql_results and isinstance(sql_results, dict)) else []
            res_dict["visualization"] = visualization_config
            res_dict["message"] = None
        else:
            res_dict["type"] = "conversation"
            res_dict["message"] = content
            res_dict["sql"] = None
            res_dict["results"] = None
            res_dict["visualization"] = None

        return res_dict

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
