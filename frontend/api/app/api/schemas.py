import re
from pydantic import BaseModel, Field, model_validator
from typing import List, Dict, Optional, Any
from datetime import datetime

# --- Data provenance (reference) helper ---
_TABLE_RE = re.compile(r"\b(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)", re.IGNORECASE)
_TABLE_DESCRIPTIONS = {
    "customers": "Customer records",
    "products": "Product catalog",
    "orders": "Order headers",
    "order_items": "Order line items",
    "payments": "Payment transactions",
}

def _extract_references(sql: Optional[str], rows: Optional[list]) -> Dict[str, Any]:
    """Derive where an answer came from: the source tables the SQL read and how
    many rows backed the result. Used to show a citation under each answer."""
    tables: List[Dict[str, str]] = []
    seen = set()
    for name in _TABLE_RE.findall(sql or ""):
        t = name.lower()
        if t in _TABLE_DESCRIPTIONS and t not in seen:
            seen.add(t)
            tables.append({"table": t, "description": _TABLE_DESCRIPTIONS[t]})
    return {
        "tables": tables,
        "row_count": len(rows or []),
        "source": "Live company database (PostgreSQL)",
    }

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
    token: Optional[str] = None

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
    references: Optional[Dict[str, Any]] = None  # data provenance: source tables + row count

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
            rows = sql_results.get("rows", []) if (sql_results and isinstance(sql_results, dict)) else []
            res_dict["type"] = "query_result"
            res_dict["sql"] = generated_sql
            res_dict["results"] = rows
            res_dict["visualization"] = visualization_config
            res_dict["message"] = None
            res_dict["references"] = _extract_references(generated_sql, rows)
        else:
            res_dict["type"] = "conversation"
            res_dict["message"] = content
            res_dict["sql"] = None
            res_dict["results"] = None
            res_dict["visualization"] = None
            res_dict["references"] = None

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
    user_email: Optional[str] = None
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

# --- Business Data Admin (CRUD + CSV import for customers/products/orders/payments) ---
# Allowed values as actually seeded/queried against the live database (see
# DB_SCHEMA_CONTEXT in analyst_service.py) — not the stale examples in domain/models.py.
CUSTOMER_TIERS = {"Gold", "Silver", "Bronze"}
PRODUCT_CATEGORIES = {"Beauty", "Electronics", "Fashion", "Grocery", "Home", "Office", "Sports", "Toys"}
ORDER_STATUSES = {"completed", "cancelled", "refunded"}
PAYMENT_METHODS = {"credit_card", "e_wallet", "bank_transfer", "virtual_account"}
PAYMENT_STATUSES = {"paid", "refunded"}


def _check_choice(value: Optional[str], allowed: set, field: str) -> Optional[str]:
    if value is not None and value not in allowed:
        raise ValueError(f"{field} must be one of {sorted(allowed)}, got {value!r}")
    return value


class CustomerCreate(BaseModel):
    name: str
    city: str
    tier: str

    @model_validator(mode="after")
    def _validate(self):
        _check_choice(self.tier, CUSTOMER_TIERS, "tier")
        return self

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    tier: Optional[str] = None

    @model_validator(mode="after")
    def _validate(self):
        _check_choice(self.tier, CUSTOMER_TIERS, "tier")
        return self

class CustomerResponse(BaseModel):
    customer_id: int
    name: str
    city: str
    tier: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    product_name: str
    category: str
    unit_price: float
    cost: float

    @model_validator(mode="after")
    def _validate(self):
        _check_choice(self.category, PRODUCT_CATEGORIES, "category")
        return self

class ProductUpdate(BaseModel):
    product_name: Optional[str] = None
    category: Optional[str] = None
    unit_price: Optional[float] = None
    cost: Optional[float] = None

    @model_validator(mode="after")
    def _validate(self):
        _check_choice(self.category, PRODUCT_CATEGORIES, "category")
        return self

class ProductResponse(BaseModel):
    product_id: int
    product_name: str
    category: str
    unit_price: float
    cost: float

    class Config:
        from_attributes = True


class OrderCreate(BaseModel):
    customer_id: int
    order_date: Optional[datetime] = None
    status: str
    order_total: float

    @model_validator(mode="after")
    def _validate(self):
        _check_choice(self.status, ORDER_STATUSES, "status")
        return self

class OrderUpdate(BaseModel):
    customer_id: Optional[int] = None
    order_date: Optional[datetime] = None
    status: Optional[str] = None
    order_total: Optional[float] = None

    @model_validator(mode="after")
    def _validate(self):
        _check_choice(self.status, ORDER_STATUSES, "status")
        return self

class OrderResponse(BaseModel):
    order_id: int
    customer_id: int
    order_date: datetime
    status: str
    order_total: float

    class Config:
        from_attributes = True


class PaymentCreate(BaseModel):
    order_id: int
    amount: float
    method: str
    paid_date: Optional[datetime] = None
    status: str

    @model_validator(mode="after")
    def _validate(self):
        _check_choice(self.method, PAYMENT_METHODS, "method")
        _check_choice(self.status, PAYMENT_STATUSES, "status")
        return self

class PaymentUpdate(BaseModel):
    order_id: Optional[int] = None
    amount: Optional[float] = None
    method: Optional[str] = None
    paid_date: Optional[datetime] = None
    status: Optional[str] = None

    @model_validator(mode="after")
    def _validate(self):
        _check_choice(self.method, PAYMENT_METHODS, "method")
        _check_choice(self.status, PAYMENT_STATUSES, "status")
        return self

class PaymentResponse(BaseModel):
    payment_id: int
    order_id: int
    amount: float
    method: str
    paid_date: datetime
    status: str

    class Config:
        from_attributes = True


class ImportErrorItem(BaseModel):
    row: int
    message: str

class ImportResultResponse(BaseModel):
    inserted: int
    failed: int
    errors: List[ImportErrorItem]


class DatasetColumn(BaseModel):
    name: str
    type: str
    source: Optional[str] = None


class DatasetPreviewResponse(BaseModel):
    columns: List[DatasetColumn]
    sample_rows: List[dict]
    total_rows: int


class DynamicDatasetResponse(BaseModel):
    id: str
    table_name: str
    display_name: str
    description: Optional[str] = None
    columns: List[DatasetColumn]
    row_count: int
    source_filename: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AppendResultResponse(BaseModel):
    inserted: int
    failed: int
    errors: List[ImportErrorItem]
    matched_columns: Optional[List[str]] = None
    ignored_columns: Optional[List[str]] = None


class BenchmarkResultResponse(BaseModel):
    benchmark_id: str
    nl_query: str
    expected_sql: str
    generated_sql: Optional[str] = None
    is_correct: bool
    outcome: str = "mismatch"  # "correct" | "clarification" | "mismatch" — transient, not persisted
    execution_time_ms: Optional[int] = None
    error_message: Optional[str] = None
    category: Optional[str] = None  # transient grouping label, not persisted
    created_at: datetime

    class Config:
        from_attributes = True


class EvaluationMetricsResponse(BaseModel):
    sql_syntax_success_rate: float
    data_matching_rate: float
    average_latency_seconds: float
    total_input_tokens: int
    total_output_tokens: int
    total_tokens: int
    total_queries: int
    valid_data_count: int
    empty_dataset_count: int
    out_of_scope_count: int
    failed_other_count: int
    recent_logs: List[Dict[str, Any]]


class TestSuiteCaseResult(BaseModel):
    nl_query: str
    category: str
    expected_output: str
    model_output: Optional[str] = None
    status: str  # "Pass" | "Fail"
    latency_ms: int
    error_message: Optional[str] = None


class TestSuiteResponse(BaseModel):
    test_results: List[TestSuiteCaseResult]
    metrics: Dict[str, Any]

