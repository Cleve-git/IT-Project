import pytest
from app.services.intent_service import IntentService

@pytest.mark.asyncio
async def test_intent_detection_greetings():
    service = IntentService()
    
    # Greetings
    assert await service.detect_intent("hello") == "GREETING"
    assert await service.detect_intent("hi") == "GREETING"
    assert not await service.is_data_query("hello")
    assert not await service.is_data_query("hi")

@pytest.mark.asyncio
async def test_intent_detection_small_talk():
    service = IntentService()
    
    # Small Talk
    assert await service.detect_intent("how are you") == "SMALL_TALK"
    assert await service.detect_intent("thank you") == "SMALL_TALK"
    assert not await service.is_data_query("how are you")
    assert not await service.is_data_query("thank you")

@pytest.mark.asyncio
async def test_intent_detection_help():
    service = IntentService()
    
    # Help Instructions
    assert await service.detect_intent("what can you do") == "HELP"
    assert not await service.is_data_query("what can you do")

@pytest.mark.asyncio
async def test_intent_detection_data_queries():
    service = IntentService()
    
    # Analytical requests that execute SQL queries
    assert await service.detect_intent("show top customers") == "DATA_QUERY"
    assert await service.detect_intent("total revenue by month") == "DATA_QUERY"
    assert await service.is_data_query("show top customers")
    assert await service.is_data_query("total revenue by month")
