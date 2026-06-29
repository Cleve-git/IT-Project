from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import engine, Base, AsyncSessionLocal
from app.core.seeder import seed_database
from app.api.v1 import auth, chat, documents, admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI Lifespan events handler.
    Performs database table sync and initial mock seeding on app startup.
    """
    print("Starting up Conversational Data Analyst Backend...")
    
    # 1. Run migrations / create tables
    async with engine.begin() as conn:
        print("Synchronising database tables schema...")
        await conn.run_sync(Base.metadata.create_all)
        print("Database schema synchronization complete.")

    # 2. Run Database Seeder
    async with AsyncSessionLocal() as session:
        print("Checking/Seeding initial database records...")
        try:
            await seed_database(session)
        except Exception as e:
            print(f"Error seeding database: {str(e)}")

    yield
    
    print("Shutting down Conversational Data Analyst Backend...")
    await engine.dispose()

app = FastAPI(
    title="Conversational Data Analyst API",
    description="Backend API powering natural language queries, document intelligence parsing, and business report charting.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Request Exception Logging
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Unhandled Exception occurred: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred.", "error": str(exc)}
    )

# Mount API Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")

@app.get("/")
def read_root():
    """Health check endpoint."""
    return {
        "app": "Conversational Data Analyst Backend",
        "status": "online",
        "environment": settings.ENVIRONMENT,
        "models": {
            "sql_generator": settings.SQL_GENERATION_MODEL,
            "explanation_engine": settings.EXPLANATION_MODEL
        }
    }
