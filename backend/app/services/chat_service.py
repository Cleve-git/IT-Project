import time
import json
from decimal import Decimal
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Tuple, List, Dict, Optional, Any

from app.repositories.conversation_repository import ConversationRepository
from app.repositories.query_repository import QueryRepository
from app.services.intent_service import IntentService
from app.services.context_service import ContextService
from app.services.clarification_service import ClarificationService
from app.services.sql_service import SqlService
from app.services.visualization_service import VisualizationService
from app.services.groq_service import GroqService
from app.services.response_formatter import ResponseFormatter
from app.utils.serializer import serialize_rows, serialize_row
from app.utils.sql_validator import validate_sql_safety

from langchain.schema import HumanMessage, SystemMessage

class ChatService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.conv_repo = ConversationRepository(db)
        self.query_repo = QueryRepository(db)
        self.intent_service = IntentService()
        self.context_service = ContextService(db)
        self.clarification_service = ClarificationService()
        self.sql_service = SqlService()
        self.viz_service = VisualizationService()
        self.groq = GroqService()
        self.formatter = ResponseFormatter()

    async def execute_query(self, sql: str) -> Tuple[List[str], List[Dict[str, Any]], int]:
        """Executes SQL query and returns (columns, rows, duration_ms)"""
        start = time.time()
        if "LIMIT" not in sql.upper():
            sql = f"SELECT * FROM ({sql}) AS subq LIMIT 100"
            
        res = await self.db.execute(text(sql))
        columns = list(res.keys())
        
        rows = []
        for r in res.fetchall():
            row_dict = {}
            for col in columns:
                val = getattr(r, col)
                if isinstance(val, (Decimal, float)):
                    row_dict[col] = float(val)
                elif isinstance(val, datetime):
                    row_dict[col] = val.isoformat()
                else:
                    row_dict[col] = val
            rows.append(row_dict)
            
        duration = int((time.time() - start) * 1000)
        return columns, rows, duration

    async def generate_explanation(self, query: str, sql: str, rows: List[dict]) -> str:
        if self.groq.is_mock:
            return f"Based on the query, here are the results for: '{query}'."

        prompt = f"""Explain the following query results to a business user:
Question: {query}
SQL Executed: {sql}
Results (First 5 rows): {json.dumps(rows[:5])}

Write a clean, professional, action-oriented business summary under 4 sentences. Keep the tone helpful.
"""
        messages = [
            SystemMessage(content="You are a data interpretation assistant."),
            HumanMessage(content=prompt)
        ]
        try:
            return await self.groq.invoke(messages, model="llama-3-8b-8192", temperature=0.3)
        except Exception:
            return f"Found {len(rows)} entries matching the query parameters."

    async def handle_message(self, user_id: str, query_text: str, conversation_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Main pipeline logic: Intent detection, context check, query compiling & execution.
        Returns a dictionary response compliant with either specified JSON shapes or full Message model.
        """
        # 1. Resolve conversation session
        if not conversation_id:
            conv = await self.conv_repo.create(user_id=user_id, title=query_text[:40] + "...")
            conversation_id = conv.conversation_id
        else:
            conv = await self.conv_repo.get_by_id(conversation_id)
            if not conv:
                raise ValueError("Conversation session not found")

        # Save User Message to database
        await self.conv_repo.add_message(conversation_id=conversation_id, role="user", content=query_text)

        # 2. If the last assistant message was a clarification question, bypass intent detection
        #    and go straight to SQL generation with the conversation history as context.
        if conv.awaiting_clarification:
            chat_history = []
            messages_list = await self.conv_repo.get_messages(conversation_id)
            for m in messages_list[-8:]:
                chat_history.append({"role": m.sender, "content": m.content})

            is_amb_llm, clar_llm, sql, reasoning = await self.sql_service.generate_sql(query_text, chat_history)

            if is_amb_llm and clar_llm:
                db_msg = await self.conv_repo.add_message(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=clar_llm
                )
                return {
                    "type": "clarification",
                    "message": clar_llm,
                    "missing_fields": ["clarification"],
                    "db_message": db_msg
                }

            if sql:
                conv.awaiting_clarification = False
                await self.db.commit()
            else:
                err = "I was unable to compile a SQL query for your response. Could you rephrase?"
                db_msg = await self.conv_repo.add_message(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=err
                )
                return {"type": "conversation", "message": err, "db_message": db_msg}

            exec_status = "success"
            err_msg = None
            columns, rows, duration = [], [], 0
            try:
                columns, rows, duration = await self.execute_query(sql)
            except Exception as db_err:
                exec_status = "failed"
                err_msg = str(db_err)

            if exec_status == "failed":
                content = f"An error occurred while running the compiled SQL query: {err_msg}"
                db_msg = await self.conv_repo.add_message(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=content,
                    generated_sql=sql
                )
                return {"type": "conversation", "message": content, "db_message": db_msg}

            explanation = await self.formatter.generate_natural_response(query_text, columns, rows)
            viz_config = self.viz_service.generate_plotly_config(columns, rows)
            sql_payload = {"columns": columns, "rows": rows}
            db_msg = await self.conv_repo.add_message(
                conversation_id=conversation_id,
                role="assistant",
                content=explanation,
                generated_sql=sql,
                sql_results=sql_payload,
                visualization_config=viz_config,
                explanation=explanation
            )
            await self.query_repo.log_query(
                user_id=user_id,
                question=query_text,
                generated_sql=sql,
                execution_time_ms=duration,
                rows_returned=len(rows),
                status="success"
            )
            return {
                "type": "query_result",
                "question": query_text,
                "sql": sql,
                "data": rows,
                "chart": viz_config,
                "db_message": db_msg
            }

        # 3. Standard Intent Detection
        intent = await self.intent_service.detect_intent(query_text)

        if intent != "DATA_QUERY":
            if intent == "GREETING":
                content = (
                    "Hello! 👋\n\n"
                    "I'm your Conversational Data Analyst.\n\n"
                    "I can help you:\n\n"
                    "• Analyze sales and revenue\n"
                    "• Generate SQL queries\n"
                    "• Create charts and reports\n"
                    "• Discover customer insights\n\n"
                    "Try asking:\n\n"
                    "• How many customers are in Surabaya?\n"
                    "• What are our top products?\n"
                    "• Show total revenue this month.\n"
                    "• Who are our best customers?"
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
            elif intent == "SMALL_TALK":
                content = "I'm doing great, thank you! I'm ready to help analyze your business data."
            elif intent == "UNSUPPORTED":
                content = "I'm designed to analyze your business data and answer questions about your databases. Please ask a question related to your business information."
            else:
                content = "I'm doing great, thank you! I'm ready to help analyze your business data."

            db_msg = await self.conv_repo.add_message(
                conversation_id=conversation_id,
                role="assistant",
                content=content
            )
            await self.query_repo.log_query(
                user_id=user_id,
                question=query_text,
                generated_sql=None,
                execution_time_ms=0,
                rows_returned=0,
                status="success"
            )
            return {
                "type": "conversation",
                "message": content,
                "db_message": db_msg
            }

        # 4. DATA_QUERY Intent: check ambiguity
        is_ambiguous, pending_intent, missing_fields, clarifying_question = self.clarification_service.check_ambiguity(query_text)
        if is_ambiguous:
            await self.context_service.update_context(
                conversation_id=conversation_id,
                pending_intent=pending_intent,
                missing_fields=missing_fields,
                collected_data={}
            )

            conv.awaiting_clarification = True
            await self.db.commit()

            db_msg = await self.conv_repo.add_message(
                conversation_id=conversation_id,
                role="assistant",
                content=clarifying_question
            )

            await self.query_repo.log_query(
                user_id=user_id,
                question=query_text,
                generated_sql=None,
                execution_time_ms=0,
                rows_returned=0,
                status="failed",
                error_message="Ambiguous query prompt"
            )
            return {
                "type": "clarification",
                "message": clarifying_question,
                "missing_fields": missing_fields,
                "db_message": db_msg
            }

        # 5. Pipeline Run: SQL compile & execute
        chat_history = []
        messages_list = await self.conv_repo.get_messages(conversation_id)
        for m in messages_list[-6:]:
            chat_history.append({"role": m.sender, "content": m.content})

        is_amb_llm, clar_llm, sql, reasoning = await self.sql_service.generate_sql(query_text, chat_history)

        if is_amb_llm and clar_llm:
            await self.context_service.update_context(
                conversation_id=conversation_id,
                pending_intent="llm_ambiguity",
                missing_fields=["clarification"],
                collected_data={"original_query": query_text}
            )
            conv.awaiting_clarification = True
            await self.db.commit()
            db_msg = await self.conv_repo.add_message(
                conversation_id=conversation_id,
                role="assistant",
                content=clar_llm
            )
            return {
                "type": "clarification",
                "message": clar_llm,
                "missing_fields": ["clarification"],
                "db_message": db_msg
            }

        if not sql:
            err = "I was unable to compile a SQL query for your prompt. Please try again."
            db_msg = await self.conv_repo.add_message(
                conversation_id=conversation_id,
                role="assistant",
                content=err
            )
            await self.query_repo.log_query(
                user_id=user_id,
                question=query_text,
                generated_sql=None,
                execution_time_ms=0,
                rows_returned=0,
                status="failed",
                error_message="SQL compiler returned empty"
            )
            return {
                "type": "conversation",
                "message": err,
                "db_message": db_msg
            }

        # SQL Safe Execution
        exec_status = "success"
        err_msg = None
        columns, rows, duration = [], [], 0

        try:
            columns, rows, duration = await self.execute_query(sql)
        except Exception as db_err:
            exec_status = "failed"
            err_msg = str(db_err)

        if exec_status == "failed":
            content = f"An error occurred while running the compiled SQL query: {err_msg}"
            db_msg = await self.conv_repo.add_message(
                conversation_id=conversation_id,
                role="assistant",
                content=content,
                generated_sql=sql
            )
            await self.query_repo.log_query(
                user_id=user_id,
                question=query_text,
                generated_sql=sql,
                execution_time_ms=duration,
                rows_returned=0,
                status="failed",
                error_message=err_msg
            )
            return {
                "type": "conversation",
                "message": content,
                "db_message": db_msg
            }

        # Success flow: explanations & viz
        conv.awaiting_clarification = False
        await self.db.commit()

        explanation = await self.formatter.generate_natural_response(query_text, columns, rows)
        viz_config = self.viz_service.generate_plotly_config(columns, rows)

        sql_payload = {"columns": columns, "rows": rows}
        db_msg = await self.conv_repo.add_message(
            conversation_id=conversation_id,
            role="assistant",
            content=explanation,
            generated_sql=sql,
            sql_results=sql_payload,
            visualization_config=viz_config,
            explanation=explanation
        )

        await self.query_repo.log_query(
            user_id=user_id,
            question=query_text,
            generated_sql=sql,
            execution_time_ms=duration,
            rows_returned=len(rows),
            status="success"
        )

        return {
            "type": "query_result",
            "question": query_text,
            "sql": sql,
            "data": rows,
            "chart": viz_config,
            "db_message": db_msg
        }