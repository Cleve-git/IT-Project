from fastapi import APIRouter, Depends, UploadFile, File, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.domain.models import Profile
from app.api.schemas import DocumentResponse, ExtractedTableResponse
from app.infrastructure.repositories.document_repository import DocumentRepository
from app.application.services.document_service import DocumentService

router = APIRouter(prefix="/documents", tags=["Document Intelligence"])

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploads a CSV or PDF file, saves it, and schedules an asynchronous
    background parser to extract content and structure tables.
    """
    # Verify extension
    ext = file.filename.split(".")[-1].lower()
    if ext not in ["csv", "pdf"]:
        raise HTTPException(status_code=400, detail="Only CSV and PDF file formats are supported")

    content = await file.read()
    storage_dir = "./storage"

    doc_service = DocumentService(db)
    
    # Register document and write locally
    doc = await doc_service.upload_document(
        user_id=current_user.id,
        filename=file.filename,
        file_content=content,
        storage_dir=storage_dir
    )

    # Schedule background processing
    background_tasks.add_task(doc_service.process_document, doc.document_id)

    return doc


@router.get("/", response_model=List[DocumentResponse])
async def list_documents(
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve all uploaded documents for the current user."""
    repo = DocumentRepository(db)
    return await repo.get_all_by_user(current_user.id)


@router.get("/{document_id}/tables", response_model=List[ExtractedTableResponse])
async def get_document_tables(
    document_id: str,
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetch all tables extracted from a specific document."""
    repo = DocumentRepository(db)
    doc = await repo.get_by_id(document_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found or unauthorized")
        
    return await repo.get_tables_by_document(document_id)
