import time
import io
import csv
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.core.database import get_db
from app.core.security import require_admin
from app.domain.models import Profile, BenchmarkResult
from app.api.schemas import (
    SystemStatsResponse, QueryLogResponse, ProfileResponse,
    UpdateRoleRequest, BenchmarkResultResponse
)
from app.infrastructure.repositories.profile_repository import ProfileRepository
from app.infrastructure.repositories.query_log_repository import QueryLogRepository
from app.application.services.analyst_service import AnalystService
from app.application.benchmarks.benchmark_suite import get_suite

router = APIRouter(prefix="/admin", tags=["Admin Operations"], dependencies=[Depends(require_admin)])


def _parse_date(value: Optional[str], end: bool = False) -> Optional[datetime]:
    """Parse a YYYY-MM-DD (or ISO) date string; for `end` push to the end of the day."""
    if not value:
        return None
    try:
        v = value.strip()
        if len(v) == 10:  # date only
            dt = datetime.strptime(v, "%Y-%m-%d")
            return dt.replace(hour=23, minute=59, second=59) if end else dt
        return datetime.fromisoformat(v.replace("Z", ""))
    except Exception:
        return None

@router.get("/stats", response_model=SystemStatsResponse)
async def get_system_stats(db: AsyncSession = Depends(get_db)):
    """Fetch high-level system usage statistics, counts, and query health rates."""
    repo = ProfileRepository(db)
    stats = await repo.get_system_stats()
    return stats


@router.get("/logs", response_model=List[QueryLogResponse])
async def get_query_logs(
    status: Optional[str] = Query(None, description="Filter by status: success | failed"),
    user: Optional[str] = Query(None, description="Filter by user email or id (substring)"),
    search: Optional[str] = Query(None, description="Search within the natural-language query text"),
    start: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
):
    """Audit log history, filterable by status, user, query text and date range."""
    repo = QueryLogRepository(db)
    return await repo.get_filtered(
        status=status, user_query=user, search=search,
        start_date=_parse_date(start), end_date=_parse_date(end, end=True), limit=limit,
    )


@router.get("/logs/export/csv")
async def export_logs_csv(
    status: Optional[str] = None, user: Optional[str] = None, search: Optional[str] = None,
    start: Optional[str] = None, end: Optional[str] = None, db: AsyncSession = Depends(get_db),
):
    """Export the (filtered) query logs as a CSV file."""
    repo = QueryLogRepository(db)
    logs = await repo.get_filtered(
        status=status, user_query=user, search=search,
        start_date=_parse_date(start), end_date=_parse_date(end, end=True), limit=5000,
    )
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Timestamp (UTC)", "User", "Status", "Duration (ms)", "Query", "Executed SQL", "Error"])
    for l in logs:
        w.writerow([
            l.created_at.strftime("%Y-%m-%d %H:%M:%S") if l.created_at else "",
            getattr(l, "user_email", None) or l.user_id,
            l.status, l.execution_duration_ms if l.execution_duration_ms is not None else "",
            l.query_text or "", (l.executed_sql or "").replace("\n", " "), l.error_message or "",
        ])
    buf.seek(0)
    fname = f"query-logs-{datetime.utcnow().strftime('%Y%m%d-%H%M')}.csv"
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={fname}"})


@router.get("/logs/export/pdf")
async def export_logs_pdf(
    status: Optional[str] = None, user: Optional[str] = None, search: Optional[str] = None,
    start: Optional[str] = None, end: Optional[str] = None, db: AsyncSession = Depends(get_db),
):
    """Export the (filtered) query logs as a formatted PDF report."""
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    repo = QueryLogRepository(db)
    logs = await repo.get_filtered(
        status=status, user_query=user, search=search,
        start_date=_parse_date(start), end_date=_parse_date(end, end=True), limit=2000,
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=1.2*cm, rightMargin=1.2*cm,
                            topMargin=1.2*cm, bottomMargin=1.2*cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("t", parent=styles["Title"], fontSize=17, textColor=colors.HexColor("#1e293b"))
    small = ParagraphStyle("s", parent=styles["Normal"], fontSize=7.5, leading=9)
    cell = ParagraphStyle("c", parent=styles["Normal"], fontSize=7.5, leading=9)

    total = len(logs)
    ok = sum(1 for l in logs if l.status == "success")
    fail = total - ok
    filt = []
    if status and status != "all": filt.append(f"status={status}")
    if user: filt.append(f"user~{user}")
    if search: filt.append(f"search~{search}")
    if start: filt.append(f"from {start}")
    if end: filt.append(f"to {end}")

    elems = [
        Paragraph("Conda AI — Query Execution Report", title_style),
        Paragraph(f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} &nbsp;·&nbsp; "
                  f"{total} records &nbsp;·&nbsp; {ok} success / {fail} failed"
                  + (f" &nbsp;·&nbsp; filters: {', '.join(filt)}" if filt else ""), small),
        Spacer(1, 0.4*cm),
    ]

    header = ["Timestamp (UTC)", "User", "Status", "ms", "Query", "SQL"]
    data = [header]
    for l in logs:
        data.append([
            Paragraph(l.created_at.strftime("%Y-%m-%d %H:%M:%S") if l.created_at else "", cell),
            Paragraph((getattr(l, "user_email", None) or l.user_id or "")[:26], cell),
            Paragraph(l.status, cell),
            Paragraph(str(l.execution_duration_ms if l.execution_duration_ms is not None else ""), cell),
            Paragraph((l.query_text or "")[:90], cell),
            Paragraph((l.executed_sql or l.error_message or "")[:120], cell),
        ])
    tbl = Table(data, repeatRows=1, colWidths=[3.0*cm, 3.6*cm, 1.6*cm, 1.1*cm, 7.5*cm, 9.0*cm])
    tstyle = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 8), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ])
    for i, l in enumerate(logs, start=1):
        tstyle.add("TEXTCOLOR", (2, i), (2, i),
                   colors.HexColor("#16a34a") if l.status == "success" else colors.HexColor("#dc2626"))
    tbl.setStyle(tstyle)
    elems.append(tbl)
    doc.build(elems)
    buf.seek(0)
    fname = f"query-logs-{datetime.utcnow().strftime('%Y%m%d-%H%M')}.pdf"
    return Response(content=buf.getvalue(), media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename={fname}"})


@router.get("/users", response_model=List[ProfileResponse])
async def list_users(limit: int = 50, offset: int = 0, db: AsyncSession = Depends(get_db)):
    """List all registered system users and profiles."""
    repo = ProfileRepository(db)
    return await repo.get_all(limit=limit, offset=offset)


@router.put("/users/{profile_id}/role", response_model=ProfileResponse)
async def update_user_role(
    profile_id: str,
    payload: UpdateRoleRequest,
    db: AsyncSession = Depends(get_db)
):
    """Modify role configurations (escalate to admin, demote to user)."""
    if payload.role not in ["admin", "user"]:
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'user'")
        
    repo = ProfileRepository(db)
    updated = await repo.update_role(profile_id, payload.role)
    if not updated:
        raise HTTPException(status_code=404, detail="User profile not found")
    return updated


@router.post("/benchmarks/run", response_model=List[BenchmarkResultResponse])
async def run_benchmarks(
    category: Optional[str] = None,
    sample: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Evaluates the NL->SQL agent against the golden benchmark dataset and measures
    **execution accuracy**: for each question both the generated SQL and the gold
    SQL are executed against the live database and their result sets are compared.
    A case is correct only when the generated query returns the same data as the
    gold answer (order- and alias-insensitive) — not merely when it runs.

    Optional `category` (e.g. aggregation, joins, ranking) and `sample` (cap the
    number of questions) filters keep runs fast and avoid LLM rate limits.
    """
    analyst_service = AnalystService(db)
    suite = get_suite(category=category, sample=sample)

    async def safe_exec(sql: str):
        """Execute a read query, recovering the session if Postgres aborts the transaction."""
        try:
            _, rows, _ = await analyst_service.execute_sql(sql)
            return rows, None
        except Exception as err:
            # A failed statement poisons the current transaction; roll back so the
            # next benchmark case can still run. No writes are pending yet (results
            # are persisted only after the loop), so nothing is lost.
            await db.rollback()
            return None, str(err)

    # Evaluate everything first, persist afterwards, so a single bad generated query
    # cannot abort the transaction that stores the results.
    scored: List[dict] = []

    for test in suite:
        nl = test["nl_query"]
        gold_sql = test["gold_sql"]

        start_time = time.time()  # measure end-to-end compile + execution
        is_ambiguous, clarification, gen_sql, reasoning = await analyst_service.generate_sql(nl)

        is_correct = False
        error_msg: Optional[str] = None

        if is_ambiguous or not gen_sql:
            error_msg = clarification or "Agent marked the question ambiguous or produced no SQL"
        elif not await analyst_service.check_sql_safety(gen_sql):
            error_msg = "Guardrail blocked generated SQL (not read-only)"
        else:
            # Gold answer is trusted/static; a failure here means the benchmark entry is broken.
            gold_rows, gold_err = await safe_exec(gold_sql)
            if gold_err:
                error_msg = f"Gold query failed to execute: {gold_err}"
            else:
                gen_rows, gen_err = await safe_exec(gen_sql)
                if gen_err:
                    error_msg = f"Generated SQL failed to execute: {gen_err}"
                else:
                    is_correct = analyst_service.compare_result_sets(gold_rows, gen_rows)
                    if not is_correct:
                        error_msg = "Result set did not match the gold answer"

        scored.append({
            "nl_query": nl,
            "expected_sql": gold_sql,
            "generated_sql": gen_sql,
            "is_correct": is_correct,
            "execution_time_ms": int((time.time() - start_time) * 1000),
            "error_message": error_msg,
            "category": test["category"],
        })

    # Return the computed evaluation directly. The pre-provisioned
    # `benchmark_results` table ships with a different, normalized schema
    # (result_id / passed / actual_answer / model_name, with the question stored
    # separately in `benchmark_questions`), so we don't force these rows into it
    # via the ORM — the result is returned to the client for display.
    import uuid as _uuid
    from datetime import datetime as _dt
    return [
        BenchmarkResultResponse(
            benchmark_id=str(_uuid.uuid4()),
            nl_query=s["nl_query"],
            expected_sql=s["expected_sql"],
            generated_sql=s["generated_sql"],
            is_correct=s["is_correct"],
            execution_time_ms=s["execution_time_ms"],
            error_message=s["error_message"],
            category=s["category"],
            created_at=_dt.utcnow(),
        )
        for s in scored
    ]
