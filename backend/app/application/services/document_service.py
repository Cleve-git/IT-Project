import os
import csv
import pandas as pd
from pypdf import PdfReader
from typing import List, Dict, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.repositories.document_repository import DocumentRepository
from app.domain.models import UploadedDocument

class DocumentService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = DocumentRepository(db)

    async def upload_document(self, user_id: str, filename: str, file_content: bytes, storage_dir: str) -> UploadedDocument:
        """Saves file to storage directory and creates file registry in DB."""
        os.makedirs(storage_dir, exist_ok=True)
        storage_path = os.path.join(storage_dir, filename)
        
        with open(storage_path, "wb") as f:
            f.write(file_content)

        file_size = len(file_content)
        file_type = filename.split(".")[-1].upper()

        doc = await self.repo.create(
            user_id=user_id,
            filename=filename,
            file_type=file_type,
            file_size=file_size,
            storage_path=storage_path,
            status="processing"
        )
        return doc

    async def process_document(self, document_id: str) -> bool:
        """Parses document according to extension and extracts content."""
        doc = await self.repo.get_by_id(document_id)
        if not doc:
            return False

        try:
            if doc.file_type == "CSV":
                await self._process_csv(doc)
            elif doc.file_type == "PDF":
                await self._process_pdf(doc)
            else:
                raise ValueError(f"Unsupported file type: {doc.file_type}")

            await self.repo.update_status(document_id, "completed")
            return True
        except Exception as e:
            print(f"Error processing document {document_id}: {str(e)}")
            await self.repo.update_status(document_id, "failed")
            return False

    async def _process_csv(self, doc: UploadedDocument):
        """Parses CSV, extracting all rows into structured table registry."""
        df = pd.read_csv(doc.storage_path)
        
        # Clean headers and rows for JSON compatibility
        headers = [str(col) for col in df.columns]
        rows = df.fillna("").to_dict(orient="records")

        # Write to extracted tables
        table_name = os.path.splitext(doc.filename)[0].lower().replace(" ", "_")
        await self.repo.add_extracted_table(
            document_id=doc.document_id,
            table_name=table_name,
            headers=headers,
            rows=rows
        )

    async def _process_pdf(self, doc: UploadedDocument):
        """Parses PDF pages, extracting text and segmenting chunks."""
        reader = PdfReader(doc.storage_path)
        chunks = []
        
        full_text = ""
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                full_text += text + "\n"
                
                # Create discrete page chunks
                chunks.append({
                    "content": text.strip(),
                    "metadata": {"page": i + 1, "filename": doc.filename},
                    "embedding": self._generate_mock_embedding(text)
                })

        # Save individual chunks
        if chunks:
            await self.repo.add_chunks(doc.document_id, chunks)

        # Detect tabular structures in text (simple heuristic) and save as extracted table
        lines = [line.strip() for line in full_text.split("\n") if line.strip()]
        table_rows = []
        headers = ["Line No", "Text Content"]
        
        for idx, line in enumerate(lines[:100]):  # Limit to first 100 rows for preview representation
            table_rows.append({"Line No": idx + 1, "Text Content": line})
            
        await self.repo.add_extracted_table(
            document_id=doc.document_id,
            table_name=f"pdf_text_{os.path.splitext(doc.filename)[0].lower()}",
            headers=headers,
            rows=table_rows
        )

    def _generate_mock_embedding(self, text: str) -> List[float]:
        """Generates simple dummy embeddings for mock vector storage capability."""
        # Returns standard 8-dimensional float representation
        seed = sum(ord(c) for c in text[:100]) if text else 0
        import random
        random.seed(seed)
        return [random.random() for _ in range(8)]
