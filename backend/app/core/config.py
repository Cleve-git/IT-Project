from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:password@localhost:5432/conversational_analyst",
        description="Async database connection URL"
    )
    DATABASE_SYNC_URL: str = Field(
        default="postgresql://postgres:password@localhost:5432/conversational_analyst",
        description="Sync database connection URL for migrations and seeding"
    )
    GROQ_API_KEY: str = Field(..., description="API Key for Groq service")
    SUPABASE_URL: str = Field(..., description="Supabase API endpoint URL")
    SUPABASE_ANON_KEY: str = Field(..., description="Supabase anonymous client key")
    SUPABASE_JWT_SECRET: str = Field(..., description="JWT Secret to verify Supabase Auth tokens locally")
    ENVIRONMENT: str = Field(default="development", description="Current environment (development, production, testing)")
    
    SQL_GENERATION_MODEL: str = Field(default="llama-3.3-70b-versatile", description="Groq model to generate SQL")
    EXPLANATION_MODEL: str = Field(default="llama-3-8b-8192", description="Groq model to generate explanations")
    
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "https://conversational-data-analyst.vercel.app"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()