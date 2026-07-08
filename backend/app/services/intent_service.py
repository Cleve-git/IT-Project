import re
from typing import Optional
from langchain.schema import HumanMessage, SystemMessage
from app.core.config import settings
from app.services.llm_service import LlmService

INTENT_SYSTEM_PROMPT = """You are an Intent Classification Engine for a Conversational Data Analyst application.

Your job is to classify the user's message into exactly ONE of the following labels:
- GREETING
- SMALL_TALK
- HELP
- DATA_QUERY
- EXPLAIN_SQL
- VISUALIZATION_REQUEST
- EXPORT_REQUEST
- OUT_OF_SCOPE

Definitions:

OUT_OF_SCOPE:
Questions that are NOT about the company's business data and are NOT greetings,
small talk, or help — e.g. general/world knowledge, facts, math, coding help,
or anything unrelated to customers, products, orders, payments.
Examples: "what is the capital of France?", "who won the world cup?", "write me a poem", "what is 2+2?"

GREETING:
Greetings and salutations.
Examples: "hi", "hello", "hey", "good morning"

SMALL_TALK:
General conversation that is not related to business data.
Examples: "how are you?", "who are you?", "thank you", "nice to meet you"

HELP:
Questions about system capabilities.
Examples: "what can you do?", "help", "how do I use this?", "give me examples"

DATA_QUERY:
Questions that require querying business data.
Examples: "top customers", "revenue this month", "total orders", "best selling products", "show customers from Jakarta"

EXPLAIN_SQL:
Questions asking to explain SQL.
Examples: "explain this query", "what does this SQL do?"

VISUALIZATION_REQUEST:
Requests to create charts or visualizations.
Examples: "show as bar chart", "create a pie chart", "visualize sales trend"

EXPORT_REQUEST:
Requests to export data.
Examples: "export to csv", "download excel", "save as pdf"

Rules:
1. Return ONLY the label word (e.g. DATA_QUERY).
2. Return no explanation.
3. Return no JSON.
4. Return no punctuation.
"""

# Keywords lists for fallback checks
DATA_QUERY_KEYWORDS = {
    # Schema words (singular and plural)
    "customer", "customers", "product", "products", "order", "orders", 
    "payment", "payments", "order_item", "order_items", "customer_id", 
    "name", "city", "tier", "product_name", "category", "order_total", 
    "order_date", "status", "amount", "method", "quantity", "line_total",
    "cost", "unit_price", "price",
    # Data keywords
    "show", "list", "count", "total", "average", "sum", "top", 
    "best", "highest", "lowest", "revenue", "sales", "profit", 
    "compare", "trend", "growth", "report", "statistics", "analytics", 
    "dashboard", "monthly", "yearly", "selling",
    # Cities
    "surabaya", "jakarta", "new york", "chicago", "los angeles", 
    "houston", "san francisco", "ny", "la", "boston", "seattle"
}

DATA_QUERY_PHRASES = ["how many", "group by", "average order value", "order total", "order date"]

GREETING_KEYWORDS = {"hello", "hi", "hey", "good morning", "good afternoon", "good evening", "halo"}
SMALL_TALK_KEYWORDS = {"how are you", "thank you", "thanks", "who are you", "nice to meet you", "howdy", "apa kabar"}
HELP_KEYWORDS = {"help", "what can you do", "how to use", "capabilities", "guide", "bantuan"}

class IntentService:
    def __init__(self):
        self.llm = LlmService()

    async def detect_intent(self, message: str, provider: Optional[str] = None, model: Optional[str] = None) -> str:
        """Classifies the user message into one of the supported categories:
        GREETING, SMALL_TALK, HELP, DATA_QUERY, EXPLAIN_SQL, VISUALIZATION_REQUEST, EXPORT_REQUEST, OUT_OF_SCOPE.
        """
        if not message or not message.strip():
            return "SMALL_TALK"

        msg_clean = re.sub(r'[^\w\s]', '', message.lower()).strip()
        tokens = set(msg_clean.split())

        # Check analytical keywords first to capture data queries
        for token in tokens:
            if token in DATA_QUERY_KEYWORDS:
                return "DATA_QUERY"
        for phrase in DATA_QUERY_PHRASES:
            if phrase in msg_clean:
                return "DATA_QUERY"

        # Check exact phrases
        for phrase in GREETING_KEYWORDS:
            if phrase in msg_clean:
                return "GREETING"
        for phrase in SMALL_TALK_KEYWORDS:
            if phrase in msg_clean:
                return "SMALL_TALK"
        for phrase in HELP_KEYWORDS:
            if phrase in msg_clean:
                return "HELP"

        # Check token sets
        if tokens.intersection(GREETING_KEYWORDS):
            return "GREETING"
        if tokens.intersection(HELP_KEYWORDS):
            return "HELP"
        if tokens.intersection(SMALL_TALK_KEYWORDS):
            return "SMALL_TALK"

        # LLM fallback
        if self.llm.is_mock:
            return "UNSUPPORTED"

        messages = [
            SystemMessage(content=INTENT_SYSTEM_PROMPT),
            HumanMessage(content=f"Classify this message: {message}")
        ]

        try:
            raw = await self.llm.invoke(messages, model=model or "llama-3-8b-8192", temperature=0.0, provider=provider)
            label = re.sub(r'[^\w_]', '', raw.strip().upper())
            
            valid_labels = {
                "GREETING", "SMALL_TALK", "HELP", "DATA_QUERY",
                "EXPLAIN_SQL", "VISUALIZATION_REQUEST", "EXPORT_REQUEST", "OUT_OF_SCOPE"
            }
            
            if label in valid_labels:
                return label
            return "UNSUPPORTED"
        except Exception:
            return "UNSUPPORTED"

    async def is_data_query(self, message: str, provider: Optional[str] = None, model: Optional[str] = None) -> bool:
        """Determines if the intent requires generating SQL."""
        intent = await self.detect_intent(message, provider=provider, model=model)
        return intent == "DATA_QUERY"
