from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from app.domain.models import UploadedDocument, ExtractedTable, DocumentChunk

class DocumentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        user_id: str,
        filename: str,
        file_type: str,
        file_size: int,
        storage_path: str,
        status: str = "processing"
    ) -> UploadedDocument:
        doc = UploadedDocument(
            user_id=user_id,
            filename=filename,
            file_type=file_type,
            file_size=file_size,
            storage_path=storage_path,
            status=status
        )
        self.db.add(doc)
        await self.db.commit()
        await self.db.refresh(doc)
        return doc

    async def get_by_id(self, document_id: str) -> Optional[UploadedDocument]:
        stmt = select(UploadedDocument).filter_by(document_id=document_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all_by_user(self, user_id: str) -> List[UploadedDocument]:
        stmt = select(UploadedDocument).filter_by(user_id=user_id).order_by(UploadedDocument.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_status(self, document_id: str, status: str) -> Optional[UploadedDocument]:
        doc = await self.get_by_id(document_id)
        if doc:
            doc.status = status
            await self.db.commit()
            await self.db.refresh(doc)
        return doc

    async def add_extracted_table(
        self,
        document_id: str,
        table_name: str,
        headers: List[str],
        rows: List[dict]
    ) -> ExtractedTable:
        table = ExtractedTable(
            document_id=document_id,
            table_name=table_name,
            headers=headers,
            rows=rows
        )
        self.db.add(table)
        await self.db.commit()
        await self.db.refresh(table)
        return table

    async def get_tables_by_document(self, document_id: str) -> List[ExtractedTable]:
        stmt = select(ExtractedTable).filter_by(document_id=document_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def add_chunks(self, document_id: str, chunks_data: List[dict]) -> List[DocumentChunk]:
        chunks = []
        for c in chunks_data:
            chunk = DocumentChunk(
                document_id=document_id,
                content=c["content"],
                metadata_json=c.get("metadata", {}),
                embedding=c.get("embedding")
            )
            chunks.append(chunk)
        self.db.add_all(chunks)
        await self.db.commit()
        return chunks
