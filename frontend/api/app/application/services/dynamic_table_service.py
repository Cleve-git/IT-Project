"""
Service for building REAL PostgreSQL tables from uploaded CSV documents so the
NL->SQL agent can query them alongside the built-in business tables.

Security model:
  * Table/column names are strictly whitelisted to ``[a-z_][a-z0-9_]*`` — the only
    place identifiers reach the DDL. They are additionally double-quoted.
  * Every ROW VALUE is passed as a bound parameter (never string-concatenated),
    so uploaded data can never inject SQL.
  * Table creation runs only through this admin-authorized service, never through
    the agent (whose guardrail still blocks all writes/DDL).
"""
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.domain.models import DynamicDataset

# Identifiers that would be mis-tokenised by the read-only guardrail or clash with
# SQL syntax. A column sanitised to one of these gets a ``_col`` suffix so a query
# selecting it is never falsely blocked or rejected by Postgres.
_RESERVED = {
    "select", "from", "where", "table", "insert", "update", "delete", "drop",
    "alter", "create", "truncate", "replace", "grant", "revoke", "order", "group",
    "by", "join", "union", "having", "limit", "offset", "into", "values", "set",
    "and", "or", "not", "null", "as", "on", "in", "is", "case", "when", "then",
    "else", "end", "user", "default", "primary", "foreign", "key", "index",
}

_TABLE_PREFIX = "dyn_"
_MAX_IDENT = 55  # leave headroom under Postgres' 63-char limit for suffixes


def _slug(name: str, fallback: str = "col") -> str:
    """Lowercase, collapse non-alphanumerics to underscores, ensure a safe start."""
    s = re.sub(r"[^a-z0-9]+", "_", str(name).strip().lower())
    s = re.sub(r"_+", "_", s).strip("_")
    if not s:
        s = fallback
    if not re.match(r"[a-z_]", s[0]):
        s = f"c_{s}"
    return s[:_MAX_IDENT]


def _infer_pg_type(series: pd.Series) -> str:
    """Infer a Postgres column type conservatively (defaults to TEXT)."""
    s = series.dropna()
    if s.empty:
        return "TEXT"
    if pd.api.types.is_bool_dtype(s):
        return "BOOLEAN"
    if pd.api.types.is_integer_dtype(s):
        return "BIGINT"
    if pd.api.types.is_float_dtype(s):
        return "DOUBLE PRECISION"

    # Object dtype: try numeric, then (guardedly) datetime, else text.
    conv = pd.to_numeric(s, errors="coerce")
    if conv.notna().all():
        return "BIGINT" if (conv.dropna() % 1 == 0).all() else "DOUBLE PRECISION"

    # Only attempt datetime when values actually look date-like, to avoid
    # mis-typing plain strings/numbers as timestamps.
    sample = s.astype(str).head(50)
    if sample.str.contains(r"\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}").mean() > 0.8:
        dt = pd.to_datetime(s, errors="coerce")
        if dt.notna().mean() > 0.9:
            return "TIMESTAMP"
    return "TEXT"


def _coerce_value(value: Any, pg_type: str) -> Any:
    """Convert a pandas cell to a Python value asyncpg accepts for ``pg_type``."""
    if value is None or (isinstance(value, float) and pd.isna(value)) or pd.isna(value):
        return None
    try:
        if pg_type == "BIGINT":
            return int(value)
        if pg_type == "DOUBLE PRECISION":
            return float(value)
        if pg_type == "BOOLEAN":
            if isinstance(value, str):
                return value.strip().lower() in {"true", "t", "1", "yes", "y"}
            return bool(value)
        if pg_type == "TIMESTAMP":
            ts = pd.to_datetime(value, errors="coerce")
            return None if pd.isna(ts) else ts.to_pydatetime()
        return str(value)
    except (ValueError, TypeError):
        return None


class DynamicTableService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ---------------------------------------------------------------- helpers
    async def _table_exists(self, table_name: str) -> bool:
        row = await self.db.execute(
            text("SELECT to_regclass(:qualified)"),
            {"qualified": f"public.{table_name}"},
        )
        return row.scalar() is not None

    async def _unique_table_name(self, base: str) -> str:
        """Return a dyn_* table name that is not already taken."""
        candidate = f"{_TABLE_PREFIX}{base}"[:63]
        i = 2
        while await self._table_exists(candidate) or await self._registry_has(candidate):
            candidate = f"{_TABLE_PREFIX}{base}_{i}"[:63]
            i += 1
        return candidate

    async def _registry_has(self, table_name: str) -> bool:
        row = await self.db.execute(
            select(DynamicDataset).where(DynamicDataset.table_name == table_name)
        )
        return row.scalar_one_or_none() is not None

    @staticmethod
    def _build_columns(df: pd.DataFrame) -> List[Dict[str, str]]:
        """Map each dataframe column to a unique sanitised name + inferred type."""
        cols: List[Dict[str, str]] = []
        seen: set = set()
        for original in df.columns:
            name = _slug(original)
            if name in _RESERVED:
                name = f"{name}_col"
            base = name
            n = 2
            while name in seen:
                name = f"{base}_{n}"[:_MAX_IDENT]
                n += 1
            seen.add(name)
            cols.append({"name": name, "type": _infer_pg_type(df[original]), "source": str(original)})
        return cols

    # ------------------------------------------------------------- public API
    def preview(self, df: pd.DataFrame, sample_rows: int = 5) -> Dict[str, Any]:
        """Infer schema + sample rows without touching the database (for the UI)."""
        cols = self._build_columns(df)
        sample = df.head(sample_rows).fillna("").astype(str).to_dict(orient="records")
        return {
            "columns": [{"name": c["name"], "type": c["type"], "source": c["source"]} for c in cols],
            "sample_rows": sample,
            "total_rows": int(len(df)),
        }

    async def create_from_dataframe(
        self, display_name: str, df: pd.DataFrame, source_filename: Optional[str], created_by: Optional[str]
    ) -> DynamicDataset:
        """Create a real table from ``df``, insert its rows, and register it."""
        if df.empty or len(df.columns) == 0:
            raise ValueError("The uploaded file has no columns/rows to import.")

        cols = self._build_columns(df)
        table_name = await self._unique_table_name(_slug(display_name, fallback="dataset"))

        # 1. CREATE TABLE — identifiers are whitelisted (_slug) and quoted.
        col_defs = ", ".join(f'"{c["name"]}" {c["type"]}' for c in cols)
        await self.db.execute(text(f'CREATE TABLE "{table_name}" ({col_defs})'))

        # 2. INSERT rows via bound parameters (values never touch the SQL string).
        colnames = [c["name"] for c in cols]
        placeholders = ", ".join(f":{c}" for c in colnames)
        quoted_cols = ", ".join(f'"{c}"' for c in colnames)
        insert_sql = text(f'INSERT INTO "{table_name}" ({quoted_cols}) VALUES ({placeholders})')

        type_by_name = {c["name"]: c["type"] for c in cols}
        params: List[Dict[str, Any]] = []
        for _, row in df.iterrows():
            record = {}
            for c in cols:
                record[c["name"]] = _coerce_value(row[c["source"]], type_by_name[c["name"]])
            params.append(record)

        # executemany in chunks
        for i in range(0, len(params), 500):
            await self.db.execute(insert_sql, params[i:i + 500])

        # 3. Register in the discovery table so the agent can see it.
        dataset = DynamicDataset(
            table_name=table_name,
            display_name=display_name,
            columns=[{"name": c["name"], "type": c["type"]} for c in cols],
            row_count=len(params),
            source_filename=source_filename,
            created_by=created_by,
        )
        self.db.add(dataset)
        await self.db.commit()
        await self.db.refresh(dataset)
        return dataset

    async def append_to_dynamic(self, dataset: DynamicDataset, df: pd.DataFrame) -> Dict[str, Any]:
        """Append rows from ``df`` into an existing dynamic table, matching by column name."""
        target_cols = {c["name"]: c["type"] for c in dataset.columns}

        # Map incoming headers -> existing columns by sanitised name.
        incoming = {}
        for original in df.columns:
            name = _slug(original)
            if name in _RESERVED:
                name = f"{name}_col"
            if name in target_cols:
                incoming[name] = original

        if not incoming:
            raise ValueError(
                f"None of the uploaded columns match '{dataset.display_name}'. "
                f"Expected columns: {', '.join(target_cols)}"
            )

        colnames = list(incoming.keys())
        placeholders = ", ".join(f":{c}" for c in colnames)
        quoted_cols = ", ".join(f'"{c}"' for c in colnames)
        insert_sql = text(f'INSERT INTO "{dataset.table_name}" ({quoted_cols}) VALUES ({placeholders})')

        params = []
        for _, row in df.iterrows():
            params.append({c: _coerce_value(row[incoming[c]], target_cols[c]) for c in colnames})

        for i in range(0, len(params), 500):
            await self.db.execute(insert_sql, params[i:i + 500])

        dataset.row_count = (dataset.row_count or 0) + len(params)
        await self.db.commit()
        return {"inserted": len(params), "failed": 0, "errors": [],
                "matched_columns": colnames, "ignored_columns": [c for c in df.columns if _slug(c) not in target_cols]}

    async def list_datasets(self) -> List[DynamicDataset]:
        result = await self.db.execute(select(DynamicDataset).order_by(DynamicDataset.created_at.desc()))
        return list(result.scalars().all())

    async def get_dataset(self, dataset_id: str) -> Optional[DynamicDataset]:
        result = await self.db.execute(select(DynamicDataset).where(DynamicDataset.id == dataset_id))
        return result.scalar_one_or_none()

    async def delete_dataset(self, dataset: DynamicDataset) -> None:
        """Drop the physical table and remove its registry row."""
        # table_name is whitelisted at creation; safe to interpolate quoted.
        await self.db.execute(text(f'DROP TABLE IF EXISTS "{dataset.table_name}"'))
        await self.db.delete(dataset)
        await self.db.commit()

    @staticmethod
    async def schema_context(db: AsyncSession) -> str:
        """Format all registered dynamic tables for injection into the agent prompt."""
        result = await db.execute(select(DynamicDataset).order_by(DynamicDataset.created_at))
        datasets = list(result.scalars().all())
        if not datasets:
            return ""
        lines = [
            "",
            "Additional admin-uploaded tables (real, queryable, READ-ONLY — treat them",
            "like the business tables above; the user may ask questions about them):",
        ]
        for d in datasets:
            cols = ", ".join(f'{c["name"]} {c["type"]}' for c in d.columns)
            label = f'  {d.table_name}({cols})'
            if d.display_name and d.display_name.lower() != d.table_name:
                label += f'   -- "{d.display_name}"'
            lines.append(label)
        return "\n".join(lines)
