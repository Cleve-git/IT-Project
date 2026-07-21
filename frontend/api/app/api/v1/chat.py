import random
import time
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
from app.infrastructure.repositories.context_repository import ConversationContextRepository
from app.application.services.analyst_service import AnalystService
from app.domain.models import Feedback
from app.services.intent_service import IntentService

router = APIRouter(prefix="/chat", tags=["Conversational Analyst"])

# Varied replies for out-of-scope questions so the agent doesn't repeat the
# exact same canned line every time (still points the user back to what it can do).
OUT_OF_SCOPE_RESPONSES = [
    "I'm a data analyst for your business database — I can only answer "
    "questions about your customers, products, orders, and payments. "
    "I can't help with that topic. Try asking something like "
    "\"What is our total revenue?\" or \"Who are our top customers?\"",

    "That's outside what I can help with — I'm built to analyze your "
    "business data (customers, products, orders, payments), not general "
    "topics. Maybe try \"What are our best selling products?\" instead.",

    "I don't have an answer for that — my job is analyzing your company's "
    "data, not general knowledge. Ask me something like \"Show total "
    "revenue by month\" or \"List our Gold tier customers.\"",

    "Not something I can look into, I'm afraid — I only work with your "
    "business database. Try a question like \"How many orders were placed "
    "last month?\" or \"What's our average order value?\"",

    "I'll have to pass on that one — I'm scoped to your customers, "
    "products, orders, and payments data. Something like \"Who are our top "
    "customers?\" is more my speed.",

    "That's beyond my scope — I can only dig into your business data. "
    "Try asking about revenue, top products, or customer trends instead.",
]

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

    # 2. Pull recent message logs for history context (include the SQL each
    #    prior turn ran, so follow-up questions can adapt the previous query)
    msgs = await conv_repo.get_messages(conv_id)
    chat_history = []
    for m in msgs:
        if m.role == "user":
            chat_history.append({"user": m.content, "analyst": "", "sql": ""})
        elif m.role == "assistant" and chat_history:
            chat_history[-1]["analyst"] = m.content
            if getattr(m, "generated_sql", None):
                chat_history[-1]["sql"] = m.generated_sql

    # Save User message
    await conv_repo.add_message(conversation_id=conv_id, role="user", content=payload.query_text)

    ctx_repo = ConversationContextRepository(db)
    pending = await ctx_repo.get_pending(conv_id)
    original_intent = pending.pending_intent if pending else payload.query_text

    # 3. Intent Detection Layer — only classify a fresh message. If we are waiting
    # on the user's answer to a clarification, skip straight to SQL resolution.
    total_latency_ms = 0.0
    total_input_tokens = 0
    total_output_tokens = 0

    intent = "DATA_QUERY"
    if not pending:
        intent_service = IntentService()
        start_intent_time = time.time()
        intent = await intent_service.detect_intent(payload.query_text)
        intent_latency_ms = (time.time() - start_intent_time) * 1000
        total_latency_ms += intent_latency_ms
        # Estimate intent detection token usage (approx. 250 input tokens for system prompt + user msg, 5 output tokens)
        total_input_tokens += len(payload.query_text) // 4 + 250
        total_output_tokens += 5

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
        elif intent == "OUT_OF_SCOPE":
            content = random.choice(OUT_OF_SCOPE_RESPONSES)
        else: # SMALL_TALK or others
            content = (
                "I'm here to help you analyze your business database. "
                "What data would you like to explore today?"
            )

        # Save Assistant message
        assistant_msg = await conv_repo.add_message(
            conversation_id=conv_id,
            role="assistant",
            content=content
        )

        # Off-topic questions we can't answer from the data are logged as failed;
        # greetings/help/etc. are handled successfully.
        await log_repo.log_query(
            user_id=current_user.id,
            query_text=payload.query_text,
            executed_sql=None,
            execution_duration_ms=0,
            status="failed" if intent == "OUT_OF_SCOPE" else "success",
            error_message="Out of scope — not answerable from the business data." if intent == "OUT_OF_SCOPE" else None,
            llm_latency_ms=total_latency_ms,
            input_tokens=total_input_tokens,
            output_tokens=total_output_tokens
        )
        return assistant_msg

    # 4. LLM SQL Generation. When resolving a pending clarification, merge the
    # original question with the user's answer so the agent has full context.
    if pending:
        prior_clar = (pending.missing_fields or {}).get("clarification", "")
        gen_input = (
            f'The user originally asked: "{pending.pending_intent}". '
            f'You asked for clarification: "{prior_clar}". '
            f'The user has now answered: "{payload.query_text}". '
            f'Use that answer to write the final SQL for the original question.'
        )
        await ctx_repo.clear(conv_id)
    else:
        gen_input = payload.query_text

    is_ambiguous, clarification_question, sql, reasoning, sql_llm_meta = await analyst_service.generate_sql(
        gen_input, chat_history
    )
    total_latency_ms += sql_llm_meta.get("latency_ms", 0.0)
    total_input_tokens += sql_llm_meta.get("input_tokens", 0)
    total_output_tokens += sql_llm_meta.get("output_tokens", 0)

    if is_ambiguous:
        # Remember the question so the user's next message resolves it (multi-turn).
        await ctx_repo.set_pending(
            conv_id, original_intent, clarification_question or "Could you clarify your request?"
        )
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
            error_message="Ambiguous query prompt",
            llm_latency_ms=total_latency_ms,
            input_tokens=total_input_tokens,
            output_tokens=total_output_tokens
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
            error_message="SQL compiler returned empty statement",
            llm_latency_ms=total_latency_ms,
            input_tokens=total_input_tokens,
            output_tokens=total_output_tokens
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
            error_message=err_msg,
            llm_latency_ms=total_latency_ms,
            input_tokens=total_input_tokens,
            output_tokens=total_output_tokens
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

    # Outcome for the audit log: a query that errors OR returns no data at all is a
    # FAILURE, even though the assistant still produces a message. Aggregates
    # (COUNT/SUM/AVG) always return one row, so they are never falsely flagged.
    log_status = exec_status
    if exec_status == "success" and len(rows) == 0:
        log_status = "failed"
        err_msg = "Query executed but returned no data (not found / inaccessible)."

    # 6. Explanation and Plotly Config Recommendation
    explanation = ""
    viz_config = None
    if exec_status == "success":
        explanation, exp_llm_meta = await analyst_service.generate_explanation(payload.query_text, sql, rows)
        total_latency_ms += exp_llm_meta.get("latency_ms", 0.0)
        total_input_tokens += exp_llm_meta.get("input_tokens", 0)
        total_output_tokens += exp_llm_meta.get("output_tokens", 0)
        
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
        status=log_status,
        error_message=err_msg,
        llm_latency_ms=total_latency_ms,
        input_tokens=total_input_tokens,
        output_tokens=total_output_tokens
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
