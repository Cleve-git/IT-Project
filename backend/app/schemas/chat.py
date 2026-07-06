from pydantic import BaseModel, Field, model_validator
from typing import List, Dict, Optional, Any
from datetime import datetime

# --- Profile & Auth (commonly shared or imported) ---
class ProfileBase(BaseModel):
    email: str
    full_name: Optional[str] = None

class ProfileCreate(ProfileBase):
    id: str

class ProfileResponse(ProfileBase):
    id: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

class UpdateRoleRequest(BaseModel):
    role: str = Field(..., description="Role to assign: 'admin' or 'user'")


# --- Query Request ---
class QueryRequest(BaseModel):
    conversation_id: Optional[str] = Field(None, description="Optional conversation UUID to continue a thread")
    query_text: str = Field(..., description="Natural language question to compile to SQL")


# --- Response Schemas (Finalized Specifications) ---
class ChatResponseConversation(BaseModel):
    type: str = "conversation"
    message: str

class ChatResponseClarification(BaseModel):
    type: str = "clarification"
    message: str
    missing_fields: Optional[List[str]] = None

class ChatResponseQueryResult(BaseModel):
    type: str = "query_result"
    question: str
    sql: str
    data: List[Dict[str, Any]]
    chart: Optional[Dict[str, Any]] = None


# --- Compatibility Message Response (For Frontend Integration) ---
class MessageResponse(BaseModel):
    message_id: str
    conversation_id: str
    role: str  # maps to database message.sender
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
        if not isinstance(data, dict):
            # SQLAlchemy model or custom object
            generated_sql = getattr(data, "generated_sql", None)
            content = getattr(data, "content", "")
            sql_results = getattr(data, "sql_results", None)
            visualization_config = getattr(data, "visualization_config", None)
            sender = getattr(data, "sender", None)
            role = getattr(data, "role", sender or "assistant")
            
            res_dict = {
                "message_id": getattr(data, "message_id"),
                "conversation_id": getattr(data, "conversation_id"),
                "role": role,
                "content": content,
                "generated_sql": generated_sql,
                "sql_results": sql_results,
                "visualization_config": visualization_config,
                "explanation": getattr(data, "explanation", None),
                "created_at": getattr(data, "created_at"),
            }
        else:
            res_dict = data.copy()
            role = res_dict.get("role") or res_dict.get("sender") or "assistant"
            res_dict["role"] = role
            generated_sql = res_dict.get("generated_sql")
            content = res_dict.get("content", "")
            sql_results = res_dict.get("sql_results")
            visualization_config = res_dict.get("visualization_config")

        if generated_sql:
            res_dict["type"] = "query_result"
            res_dict["sql"] = generated_sql
            res_dict["results"] = sql_results.get("rows", []) if (sql_results and isinstance(sql_results, dict)) else []
            res_dict["visualization"] = visualization_config
            res_dict["message"] = content or res_dict.get("explanation")
        else:
            res_dict["type"] = "conversation"
            res_dict["message"] = content
            res_dict["sql"] = None
            res_dict["results"] = None
            res_dict["visualization"] = None

        return res_dict

    class Config:
        from_attributes = True


# --- Feedback ---
class FeedbackCreate(BaseModel):
    message_id: Optional[str] = Field(None, description="Optional message ID rating")
    conversation_id: Optional[str] = Field(None, description="Conversation session UUID")
    rating: int = Field(..., ge=1, le=5, description="1 for dislike, 5 for like")
    comment: Optional[str] = None

class FeedbackResponse(BaseModel):
    feedback_id: str
    message_id: Optional[str] = None
    conversation_id: str
    user_id: str
    rating: int
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Document Upload & Tables ---
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


# --- Admin Query Logs & System Stats ---
class QueryLogResponse(BaseModel):
    log_id: str
    user_id: str
    user_email: Optional[str] = None
    user_full_name: Optional[str] = None
    question: str
    generated_sql: Optional[str] = None
    execution_time_ms: Optional[int] = None
    rows_returned: Optional[int] = None
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
