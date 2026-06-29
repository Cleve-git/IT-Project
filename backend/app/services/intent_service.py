import re
from typing import List
from langchain_groq import ChatGroq
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
        if tokens.intersection(SMALL_TALK_KEYWORDS):
            return "SMALL_TALK"
        if tokens.intersection(HELP_KEYWORDS):
            return "HELP"

        # Default fallback
        return "SMALL_TALK"

    async def detect_intent(self, message: str) -> str:
        """Classifies the user's message into one of the supported intents."""
        if not message.strip():
            return "SMALL_TALK"

        if self.is_mock:
            return self.detect_intent_fallback(message)

        messages = [
            SystemMessage(content=INTENT_SYSTEM_PROMPT),
            HumanMessage(content=f"Classify this message: {message}")
        ]

        try:
            response = await self.llm.ainvoke(messages)
            label = response.content.strip().upper()
            
            # Clean up the output in case the LLM returned punctuation or trailing comments
            label = re.sub(r'[^\w_]', '', label)
            
            valid_labels = {
                "GREETING", "SMALL_TALK", "HELP", "DATA_QUERY", 
                "EXPLAIN_SQL", "VISUALIZATION_REQUEST", "EXPORT_REQUEST"
            }
            
            if label in valid_labels:
                return label
            else:
                return self.detect_intent_fallback(message)
        except Exception as e:
            print(f"Intent classification API call failed: {str(e)}. Using fallback.")
            return self.detect_intent_fallback(message)

    async def is_data_query(self, message: str) -> bool:
        """Determines if the intent requires generating SQL."""
        intent = await self.detect_intent(message)
        return intent == "DATA_QUERY"
