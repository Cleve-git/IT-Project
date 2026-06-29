from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.domain.models import Profile
from app.api.schemas import (
    ConversationResponse, ConversationCreate, MessageResponse, 
    QueryRequest, FeedbackCreate, FeedbackResponse
)
from app.infrastructure.repositories.conversation_repository import ConversationRepository
from app.infrastructure.repositories.query_log_repository import QueryLogRepository
from app.application.services.analyst_service import AnalystService
from app.domain.models import Feedback
from app.services.intent_service import IntentService

router = APIRouter(prefix="/chat", tags=["Conversational Analyst"])

@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve all conversations for the current logged-in user."""
    repo = ConversationRepository(db)
    return await repo.get_all_by_user(current_user.id)


@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    payload: ConversationCreate,
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Start a new data conversation thread."""
    repo = ConversationRepository(db)
    return await repo.create(user_id=current_user.id, title=payload.title)


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    conversation_id: str,
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetch complete chat history for a specific conversation session."""
    repo = ConversationRepository(db)
    conv = await repo.get_by_id(conversation_id)
    if not conv or conv.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Conversation not found or unauthorized")
    return await repo.get_messages(conversation_id)


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a conversation thread and all its message records."""
    repo = ConversationRepository(db)
    conv = await repo.get_by_id(conversation_id)
    if not conv or conv.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Conversation not found or unauthorized")
    
    success = await repo.delete(conversation_id)
    return {"success": success, "message": "Conversation deleted successfully"}


@router.post("/query", response_model=MessageResponse)
async def submit_query(
    payload: QueryRequest,
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Submits a natural language query, compiles it to SQL, runs security filters,
    executes it in PostgreSQL, charts the schema output, and returns the response details.
    """
    conv_repo = ConversationRepository(db)
    log_repo = QueryLogRepository(db)
    analyst_service = AnalystService(db)

    # 1. Resolve or create conversation
    conv_id = payload.conversation_id
    if not conv_id:
        conv = await conv_repo.create(user_id=current_user.id, title=payload.query_text[:40] + "...")
        conv_id = conv.conversation_id
    else:
        conv = await conv_repo.get_by_id(conv_id)
        if not conv or conv.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Conversation not found or unauthorized")

    # 2. Pull recent message logs for history context
    msgs = await conv_repo.get_messages(conv_id)
    chat_history = []
    for m in msgs:
        if m.role == "user":
            chat_history.append({"user": m.content, "analyst": ""})
        elif m.role == "assistant" and chat_history:
            chat_history[-1]["analyst"] = m.content

    # Save User message
    await conv_repo.add_message(conversation_id=conv_id, role="user", content=payload.query_text)

    # 3. Intent Detection Layer
    intent_service = IntentService()
    intent = await intent_service.detect_intent(payload.query_text)

    if intent != "DATA_QUERY":
        if intent == "GREETING":
            content = (
                "Hello! 👋\n\n"
                "I'm your Conversational Data Analyst.\n\n"
                "I can help you:\n"
                "• Analyze sales and revenue\n"
                "• Generate SQL queries\n"
                "• Create charts and reports\n"
                "• Discover customer insights\n\n"
                "Try asking:\n"
                "• What are our top selling products?\n"
                "• Show total revenue by month.\n"
                "• Who are our top customers?"
            )
        elif intent == "HELP":
            content = (
                "I can:\n"
                "• Query your business database using natural language.\n"
                "• Generate SQL automatically.\n"
                "• Create visualizations.\n"
                "• Explain your data.\n"
                "• Export results."
            )
        elif intent == "VISUALIZATION_REQUEST":
            content = (
                "To create charts or visualizations, query a business dataset (e.g. "
                "'Show total revenue by customer') and I will automatically build a "
                "Plotly chart recommendation for you."
            )
        elif intent == "EXPORT_REQUEST":
            content = (
                "To export data, query the business dataset you need, and then click the "
                "'Download CSV' button in the results grid view."
            )
        elif intent == "EXPLAIN_SQL":
            content = (
                "To explain a query, ask a business question and I will outline both the "
                "SQL structure and explain the results in plain business terms."
            )
        else: # SMALL_TALK or others
            content = (
                "I'm doing great, thank you! I'm here and ready to help you analyze your business database. "
                "What data would you like to explore today?"
            )

        # Save Assistant message
        assistant_msg = await conv_repo.add_message(
            conversation_id=conv_id,
            role="assistant",
            content=content
        )

        # Log query log activity
        await log_repo.log_query(
            user_id=current_user.id,
            query_text=payload.query_text,
            executed_sql=None,
            execution_duration_ms=0,
            status="success"
        )
        return assistant_msg

    # 4. LLM SQL Generation (Only run for DATA_QUERY)
    is_ambiguous, clarification_question, sql, reasoning = await analyst_service.generate_sql(
        payload.query_text, chat_history
    )

    if is_ambiguous:
        # Save Assistant clarification question message and log query
        assistant_msg = await conv_repo.add_message(
            conversation_id=conv_id,
            role="assistant",
            content=clarification_question or "Could you clarify your request?",
            explanation="Request is ambiguous; clarification needed."
        )
        await log_repo.log_query(
            user_id=current_user.id,
            query_text=payload.query_text,
            executed_sql=None,
            execution_duration_ms=0,
            status="failed",
            error_message="Ambiguous query prompt"
        )
        return assistant_msg

    if not sql:
        assistant_msg = await conv_repo.add_message(
            conversation_id=conv_id,
            role="assistant",
            content="I was unable to compile a SQL query for your prompt. Please check your syntax or table definitions.",
            explanation="SQL compiler failed to generate statement."
        )
        await log_repo.log_query(
            user_id=current_user.id,
            query_text=payload.query_text,
            executed_sql=None,
            execution_duration_ms=0,
            status="failed",
            error_message="SQL compiler returned empty statement"
        )
        return assistant_msg

    # 4. Safety Guardrails Check
    is_safe = await analyst_service.check_sql_safety(sql)
    if not is_safe:
        err_msg = "Safety violation: Only SELECT or WITH statements are allowed. Modifying actions blocked."
        assistant_msg = await conv_repo.add_message(
            conversation_id=conv_id,
            role="assistant",
            content=err_msg,
            generated_sql=sql,
            explanation="Execution blocked due to security guardrail trigger."
        )
        await log_repo.log_query(
            user_id=current_user.id,
            query_text=payload.query_text,
            executed_sql=sql,
            execution_duration_ms=0,
            status="failed",
            error_message=err_msg
        )
        return assistant_msg

    # 5. Database Execution
    columns, rows, duration = [], [], 0
    exec_status = "success"
    err_msg = None
    try:
        columns, rows, duration = await analyst_service.execute_sql(sql)
    except Exception as db_err:
        exec_status = "failed"
        err_msg = str(db_err)

    # 6. Explanation and Plotly Config Recommendation
    explanation = ""
    viz_config = None
    if exec_status == "success":
        explanation = await analyst_service.generate_explanation(payload.query_text, sql, rows)
        viz_config = analyst_service.generate_plotly_config(columns, rows)
        summary_content = explanation
    else:
        summary_content = f"An error occurred while running the compiled SQL query: {err_msg}"

    # 7. Log and Save response
    sql_results_payload = {"columns": columns, "rows": rows} if exec_status == "success" else None
    
    assistant_msg = await conv_repo.add_message(
        conversation_id=conv_id,
        role="assistant",
        content=summary_content,
        generated_sql=sql,
        sql_results=sql_results_payload,
        visualization_config=viz_config,
        explanation=explanation if exec_status == "success" else None
    )

    await log_repo.log_query(
        user_id=current_user.id,
        query_text=payload.query_text,
        executed_sql=sql,
        execution_duration_ms=duration,
        status=exec_status,
        error_message=err_msg
    )

    return assistant_msg


@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(
    payload: FeedbackCreate,
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Log thumbs up (5) or down (1) rating feedback for query responses."""
    feedback = Feedback(
        message_id=payload.message_id,
        user_id=current_user.id,
        rating=payload.rating,
        comment=payload.comment
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)
    return feedback
