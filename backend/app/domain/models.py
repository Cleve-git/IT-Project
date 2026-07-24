import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, Boolean, Text, JSON, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base

class Profile(Base):
    __tablename__ = "profiles"

    id = Column(String, primary_key=True, index=True)  # Links to Supabase auth.users UUID
    email = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=True)
    role = Column(String, default="user", nullable=False)  # admin, user
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    query_logs = relationship("QueryLog", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("UploadedDocument", back_populates="user", cascade="all, delete-orphan")
    feedbacks = relationship("Feedback", back_populates="user", cascade="all, delete-orphan")


class Customer(Base):
    __tablename__ = "customers"

    customer_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    city = Column(String(100), nullable=False)
    tier = Column(String(20), nullable=False)  # Premium, Standard, Basic
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    orders = relationship("Order", back_populates="customer")


class Product(Base):
    __tablename__ = "products"

    product_id = Column(Integer, primary_key=True, autoincrement=True)
    product_name = Column(String(150), nullable=False)
    category = Column(String(100), nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    cost = Column(Numeric(10, 2), nullable=False)

    order_items = relationship("OrderItem", back_populates="product")


class Order(Base):
    __tablename__ = "orders"

    order_id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=False)
    order_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(50), nullable=False)  # Completed, Pending, Cancelled
    order_total = Column(Numeric(12, 2), nullable=False)

    customer = relationship("Customer", back_populates="orders")
    payments = relationship("Payment", back_populates="order", cascade="all, delete-orphan")
    order_items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class Payment(Base):
    __tablename__ = "payments"

    payment_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    method = Column(String(50), nullable=False)  # Credit Card, PayPal, Bank Transfer
    paid_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(50), nullable=False)  # Success, Failed, Pending

    order = relationship("Order", back_populates="payments")


class OrderItem(Base):
    __tablename__ = "order_items"

    order_item_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    line_total = Column(Numeric(12, 2), nullable=False)

    order = relationship("Order", back_populates="order_items")
    product = relationship("Product", back_populates="order_items")


class Conversation(Base):
    __tablename__ = "conversations"

    conversation_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("profiles.id"), nullable=False)
    title = Column(String(200), nullable=False, default="New Conversation")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("Profile", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")


class Message(Base):
    __tablename__ = "messages"

    message_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("conversations.conversation_id"), nullable=False)
    role = Column(String(20), nullable=False)  # user, assistant
    content = Column(Text, nullable=False)
    generated_sql = Column(Text, nullable=True)
    sql_results = Column(JSON, nullable=True)
    visualization_config = Column(JSON, nullable=True)
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    conversation = relationship("Conversation", back_populates="messages")
    feedbacks = relationship("Feedback", back_populates="message", cascade="all, delete-orphan")


class QueryLog(Base):
    __tablename__ = "query_logs"

    log_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("profiles.id"), nullable=False)
    query_text = Column(Text, nullable=False)
    executed_sql = Column(Text, nullable=True)
    execution_duration_ms = Column(Integer, nullable=True)
    status = Column(String(50), nullable=False)  # success, failed
    error_message = Column(Text, nullable=True)
    llm_latency_ms = Column(Float, nullable=True)
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("Profile", back_populates="query_logs")


class BenchmarkResult(Base):
    __tablename__ = "benchmark_results"

    benchmark_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    nl_query = Column(Text, nullable=False)
    expected_sql = Column(Text, nullable=False)
    generated_sql = Column(Text, nullable=True)
    is_correct = Column(Boolean, nullable=False)
    execution_time_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ConversationContext(Base):
    """
    Tracks an outstanding clarification for a conversation so a follow-up answer
    can be merged with the original question (multi-turn disambiguation).
    Matches the pre-existing `conversation_context` table (uuid / jsonb columns).
    One pending row per conversation at a time.
    """
    __tablename__ = "conversation_context"

    context_id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(UUID(as_uuid=False), nullable=False, index=True)
    pending_intent = Column(String, nullable=True)   # the original natural-language question
    missing_fields = Column(JSONB, nullable=True)    # {"clarification": "..."} we asked the user
    collected_data = Column(JSONB, nullable=True)     # reserved for future slot-filling
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class DynamicDataset(Base):
    """
    Registry of admin-created tables built from uploaded CSV documents.

    Each row records one REAL PostgreSQL table (created at runtime via a trusted
    admin path, never by the NL->SQL agent) so the analyst can discover and query
    it. `columns` stores the inferred schema as [{"name": ..., "type": ...}] and
    is injected into the agent's schema context at query time.
    """
    __tablename__ = "dynamic_datasets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    table_name = Column(String(63), unique=True, nullable=False, index=True)  # actual pg table name (sanitized, dyn_*)
    display_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    columns = Column(JSON, nullable=False)          # [{"name": str, "type": str}]
    row_count = Column(Integer, default=0, nullable=False)
    source_filename = Column(String(255), nullable=True)
    created_by = Column(String, nullable=True)      # profile id (no hard FK: dataset survives user changes)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Feedback(Base):
    __tablename__ = "feedback"

    feedback_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id = Column(String, ForeignKey("messages.message_id"), nullable=False)
    user_id = Column(String, ForeignKey("profiles.id"), nullable=False)
    rating = Column(Integer, nullable=False)  # e.g., 1 (dislike/thumbs down) or 5 (like/thumbs up)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    message = relationship("Message", back_populates="feedbacks")
    user = relationship("Profile", back_populates="feedbacks")


class UploadedDocument(Base):
    __tablename__ = "uploaded_documents"

    document_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("profiles.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # PDF, CSV
    file_size = Column(Integer, nullable=False)
    storage_path = Column(String(500), nullable=False)
    status = Column(String(50), default="processing", nullable=False)  # processing, completed, failed
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("Profile", back_populates="documents")
    extracted_tables = relationship("ExtractedTable", back_populates="document", cascade="all, delete-orphan")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class ExtractedTable(Base):
    __tablename__ = "extracted_tables"

    table_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, ForeignKey("uploaded_documents.document_id"), nullable=False)
    table_name = Column(String(100), nullable=False)
    headers = Column(JSON, nullable=False)  # List of string headers
    rows = Column(JSON, nullable=False)  # List of lists/dicts representing row data
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    document = relationship("UploadedDocument", back_populates="extracted_tables")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    chunk_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, ForeignKey("uploaded_documents.document_id"), nullable=False)
    content = Column(Text, nullable=False)
    metadata_json = Column(JSON, nullable=True)
    embedding = Column(JSON, nullable=True)  # Fallback vector representation (JSON float list) for compatibility
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    document = relationship("UploadedDocument", back_populates="chunks")
