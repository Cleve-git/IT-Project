import re
from typing import Optional
from langchain.schema import HumanMessage, SystemMessage
from app.core.config import settings

INTENT_SYSTEM_PROMPT = """You are an Intent Classification Engine for a Conversational Data Analyst application.

Your job is to classify the user's message into exactly ONE of the following labels:
- GREETING
- SMALL_TALK
- HELP
- DATA_QUERY
- EXPLAIN_SQL
- VISUALIZATION_REQUEST
- EXPORT_REQUEST

Definitions:

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
ANALYTICAL_KEYWORDS = {
    "show", "list", "count", "total", "revenue", "sales", "average", "top",
    "customer", "order", "product", "profit", "payment", "selling", "revenue", "cost"
}

GREETING_KEYWORDS = {"hello", "hi", "hey", "good morning", "good afternoon", "good evening", "halo"}
SMALL_TALK_KEYWORDS = {"how are you", "thank you", "thanks", "who are you", "nice to meet you", "howdy", "apa kabar"}
HELP_KEYWORDS = {"help", "what can you do", "how to use", "capabilities", "guide", "bantuan"}

class IntentService:
    def __init__(self):
        # Use llama-3-8b-8192 for fast lightweight classification
        if settings.GROQ_API_KEY != "mock-groq-key" and len(settings.GROQ_API_KEY) > 10:
            self.llm = ChatGroq(
                model="llama-3-8b-8192",
                groq_api_key=settings.GROQ_API_KEY,
                temperature=0.0
            )
            self.is_mock = False
        else:
            self.is_mock = True

    def detect_intent_fallback(self, message: str) -> str:
        """Local rule-based heuristic classification when Groq is offline or mock."""
        msg_clean = re.sub(r'[^\w\s]', '', message.lower()).strip()
        tokens = set(msg_clean.split())

        # Check analytical keywords first to capture data queries
        for token in tokens:
            if token in ANALYTICAL_KEYWORDS:
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
        if self.looks_like_help(message):
            return "HELP"
        if self.looks_like_small_talk(message):
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
                "EXPLAIN_SQL", "VISUALIZATION_REQUEST", "EXPORT_REQUEST"
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
