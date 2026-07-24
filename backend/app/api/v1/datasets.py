"""
Admin endpoints for the document-driven dataset feature:

  * analyze  — preview a CSV's inferred schema before committing
  * create   — build a NEW real table from a CSV (the agent can then query it)
  * append   — add rows to an EXISTING table (built-in business table or a
               previously-created dynamic table)
  * list / delete / targets — manage the created datasets

All routes are admin-only. Table creation happens here (trusted path); the
NL->SQL agent only ever reads these tables through its read-only guardrail.
"""
from io import BytesIO
from typing import List, Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_admin, get_current_user
from app.domain.models import Profile
from app.api.schemas import (
    DatasetPreviewResponse, DynamicDatasetResponse, AppendResultResponse,
)
from app.application.services.dynamic_table_service import DynamicTableService
from app.api.v1.business_data import (
    import_dataframe, build_core_importer, CORE_ENTITY_KEYS,
)

router = APIRouter(prefix="/admin/datasets", tags=["Dataset Management"], dependencies=[Depends(require_admin)])


def _read_csv(file: UploadFile) -> pd.DataFrame:
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext != "csv":
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
    content = file.file.read()
    try:
        df = pd.read_csv(BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {e}")
    if df.empty or len(df.columns) == 0:
        raise HTTPException(status_code=400, detail="The uploaded CSV has no columns or rows.")
    return df


@router.post("/analyze", response_model=DatasetPreviewResponse)
async def analyze_dataset(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    """Infer the schema + return a small sample so the admin can review before importing."""
    df = _read_csv(file)
    return DynamicTableService(db).preview(df)


@router.get("/targets")
async def list_append_targets(db: AsyncSession = Depends(get_db)):
    """Tables an admin can append to: the built-in business tables + dynamic tables."""
    datasets = await DynamicTableService(db).list_datasets()
    return {
        "core": CORE_ENTITY_KEYS,
        "dynamic": [{"id": d.id, "table_name": d.table_name, "display_name": d.display_name} for d in datasets],
    }


@router.get("", response_model=List[DynamicDatasetResponse])
@router.get("/", response_model=List[DynamicDatasetResponse])
async def list_datasets(db: AsyncSession = Depends(get_db)):
    """List every admin-created dynamic table."""
    return await DynamicTableService(db).list_datasets()


@router.post("/create", response_model=DynamicDatasetResponse)
async def create_dataset(
    file: UploadFile = File(...),
    display_name: str = Form(...),
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a brand-new table from the uploaded CSV and register it for the agent."""
    df = _read_csv(file)
    svc = DynamicTableService(db)
    try:
        return await svc.create_from_dataframe(
            display_name=display_name.strip() or "dataset",
            df=df,
            source_filename=file.filename,
            created_by=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create table: {e}")


@router.post("/append", response_model=AppendResultResponse)
async def append_dataset(
    file: UploadFile = File(...),
    target: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """Append CSV rows to an existing table.

    `target` is either a built-in entity name (customers/products/orders/payments)
    or the id of a previously-created dynamic dataset."""
    df = _read_csv(file)
    svc = DynamicTableService(db)

    # Built-in business table -> validated insert with FK checks.
    if target in CORE_ENTITY_KEYS:
        importer = build_core_importer(target, db)
        schema_cls, repo, fk_checks = importer
        result = await import_dataframe(df, schema_cls, repo, fk_checks)
        return AppendResultResponse(**result)

    # Otherwise treat target as a dynamic dataset id.
    dataset = await svc.get_dataset(target)
    if not dataset:
        raise HTTPException(status_code=404, detail="Target table not found.")
    try:
        result = await svc.append_to_dynamic(dataset, df)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return AppendResultResponse(**result)


@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Drop a dynamic table and remove it from the registry."""
    svc = DynamicTableService(db)
    dataset = await svc.get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    await svc.delete_dataset(dataset)
    return {"success": True}
