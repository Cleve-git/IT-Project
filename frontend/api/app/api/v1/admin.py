import time
import io
import csv
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.core.database import get_db
from sqlalchemy import select, func, or_
from app.core.security import require_admin
from app.domain.models import Profile, BenchmarkResult, QueryLog
from app.services.intent_service import IntentService
from app.api.schemas import (
    SystemStatsResponse, QueryLogResponse, ProfileResponse,
    UpdateRoleRequest, BenchmarkResultResponse, EvaluationMetricsResponse,
    TestSuiteResponse
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
        is_ambiguous, clarification, gen_sql, reasoning, _ = await analyst_service.generate_sql(nl)

        is_correct = False
        # "clarification" means the agent correctly recognized an ambiguous
        # question and asked for more info — that's not a wrong answer, so it
        # must not be scored the same as a genuine "mismatch" (wrong/failed SQL).
        outcome = "mismatch"
        error_msg: Optional[str] = None

        if is_ambiguous or not gen_sql:
            outcome = "clarification"
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
                    if is_correct:
                        outcome = "correct"
                    else:
                        error_msg = "Result set did not match the gold answer"

        scored.append({
            "nl_query": nl,
            "expected_sql": gold_sql,
            "generated_sql": gen_sql,
            "is_correct": is_correct,
            "outcome": outcome,
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
            outcome=s["outcome"],
            execution_time_ms=s["execution_time_ms"],
            error_message=s["error_message"],
            category=s["category"],
            created_at=_dt.utcnow(),
        )
        for s in scored
    ]


@router.get("/evaluation/metrics", response_model=EvaluationMetricsResponse)
async def get_evaluation_metrics(db: AsyncSession = Depends(get_db)):
    """
    Returns aggregated metrics from execution logs.
    """
    # 1. SQL Syntax Success Rate
    stmt_generated_sql_count = select(func.count(QueryLog.log_id)).where(QueryLog.executed_sql.isnot(None), QueryLog.executed_sql != '')
    generated_sql_count = await db.scalar(stmt_generated_sql_count) or 0
    
    stmt_syntax_success_count = select(func.count(QueryLog.log_id)).where(
        QueryLog.executed_sql.isnot(None),
        QueryLog.executed_sql != '',
        or_(
            QueryLog.status == "success",
            QueryLog.error_message == "Query executed but returned no data (not found / inaccessible).",
            QueryLog.error_message == "Execution blocked due to security guardrail trigger."
        )
    )
    syntax_success_count = await db.scalar(stmt_syntax_success_count) or 0
    sql_syntax_success_rate = (syntax_success_count / generated_sql_count * 100.0) if generated_sql_count > 0 else 100.0

    # 2. Data Matching Rate
    stmt_total_queries = select(func.count(QueryLog.log_id))
    total_queries = await db.scalar(stmt_total_queries) or 0
    
    stmt_valid_data = select(func.count(QueryLog.log_id)).where(QueryLog.status == "success")
    valid_data_count = await db.scalar(stmt_valid_data) or 0
    
    stmt_empty_dataset = select(func.count(QueryLog.log_id)).where(
        QueryLog.status == "failed",
        QueryLog.error_message == "Query executed but returned no data (not found / inaccessible)."
    )
    empty_dataset_count = await db.scalar(stmt_empty_dataset) or 0

    stmt_out_of_scope = select(func.count(QueryLog.log_id)).where(
        QueryLog.status == "failed",
        or_(
            QueryLog.error_message == "Out of scope — not answerable from the business data.",
            QueryLog.error_message == "Ambiguous query prompt"
        )
    )
    out_of_scope_count = await db.scalar(stmt_out_of_scope) or 0
    
    failed_other_count = total_queries - (valid_data_count + empty_dataset_count + out_of_scope_count)
    if failed_other_count < 0:
        failed_other_count = 0
        
    data_matching_rate = (valid_data_count / total_queries * 100.0) if total_queries > 0 else 100.0

    # 3. Average Latency
    stmt_avg_latency = select(func.avg(QueryLog.llm_latency_ms)).where(QueryLog.llm_latency_ms.isnot(None))
    avg_latency_ms = await db.scalar(stmt_avg_latency)
    average_latency_seconds = (avg_latency_ms / 1000.0) if avg_latency_ms else 0.0

    # 4. Token Consumption Tracker
    stmt_total_tokens = select(
        func.sum(QueryLog.input_tokens),
        func.sum(QueryLog.output_tokens)
    )
    res_tokens = await db.execute(stmt_total_tokens)
    token_row = res_tokens.fetchone()
    total_input_tokens = 0
    total_output_tokens = 0
    if token_row:
        total_input_tokens = token_row[0] or 0
        total_output_tokens = token_row[1] or 0
    total_tokens = total_input_tokens + total_output_tokens

    # Recent logs for trend lines (limit 100)
    stmt_recent = select(QueryLog).order_by(QueryLog.created_at.desc()).limit(100)
    result_recent = await db.execute(stmt_recent)
    recent_logs_objs = result_recent.scalars().all()
    recent_logs = []
    for log in recent_logs_objs:
        recent_logs.append({
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "status": log.status,
            "llm_latency_ms": log.llm_latency_ms or 0.0,
            "input_tokens": log.input_tokens or 0,
            "output_tokens": log.output_tokens or 0,
            "query_text": log.query_text
        })

    return EvaluationMetricsResponse(
        sql_syntax_success_rate=round(sql_syntax_success_rate, 2),
        data_matching_rate=round(data_matching_rate, 2),
        average_latency_seconds=round(average_latency_seconds, 3),
        total_input_tokens=total_input_tokens,
        total_output_tokens=total_output_tokens,
        total_tokens=total_tokens,
        total_queries=total_queries,
        valid_data_count=valid_data_count,
        empty_dataset_count=empty_dataset_count,
        out_of_scope_count=out_of_scope_count,
        failed_other_count=failed_other_count,
        recent_logs=recent_logs
    )


TEST_SUITE_QUESTIONS = [
    # Aggregation
    {"category": "aggregation", "nl_query": "What is our total revenue from successful payments?", "gold_sql": "SELECT SUM(amount) AS revenue FROM payments WHERE status = 'paid'"},
    {"category": "aggregation", "nl_query": "How many customers do we have in total?", "gold_sql": "SELECT COUNT(*) AS total_customers FROM customers"},
    {"category": "aggregation", "nl_query": "How many products are in the catalog?", "gold_sql": "SELECT COUNT(*) AS total_products FROM products"},
    
    # Filtering
    {"category": "filtering", "nl_query": "How many orders were completed?", "gold_sql": "SELECT COUNT(*) AS completed_orders FROM orders WHERE status = 'completed'"},
    {"category": "filtering", "nl_query": "List all Gold tier customers.", "gold_sql": "SELECT name FROM customers WHERE tier = 'Gold'"},
    {"category": "filtering", "nl_query": "Which products cost more than 500,000?", "gold_sql": "SELECT product_name FROM products WHERE unit_price > 500000"},

    # Grouping
    {"category": "grouping", "nl_query": "How many customers are in each tier?", "gold_sql": "SELECT tier, COUNT(*) AS num_customers FROM customers GROUP BY tier"},
    {"category": "grouping", "nl_query": "What is the average unit price per product category?", "gold_sql": "SELECT category, AVG(unit_price) AS avg_price FROM products GROUP BY category"},

    # Joins
    {"category": "joins", "nl_query": "What is the total revenue generated by each customer from successful payments?", "gold_sql": "SELECT c.name, SUM(p.amount) AS revenue FROM customers c JOIN orders o ON c.customer_id = o.customer_id JOIN payments p ON o.order_id = p.order_id WHERE p.status = 'paid' GROUP BY c.name"},
    {"category": "joins", "nl_query": "How many orders has each customer placed?", "gold_sql": "SELECT c.name, COUNT(o.order_id) AS num_orders FROM customers c JOIN orders o ON c.customer_id = o.customer_id GROUP BY c.name"},

    # Ranking
    {"category": "ranking", "nl_query": "Who is our single top customer by total order value?", "gold_sql": "SELECT c.name, SUM(o.order_total) AS total FROM customers c JOIN orders o ON c.customer_id = o.customer_id GROUP BY c.name ORDER BY total DESC LIMIT 1"},
    {"category": "ranking", "nl_query": "What are the top 3 best selling products by quantity sold?", "gold_sql": "SELECT p.product_name, SUM(oi.quantity) AS total_sold FROM products p JOIN order_items oi ON p.product_id = oi.product_id GROUP BY p.product_name ORDER BY total_sold DESC LIMIT 3"},

    # Time-based
    {"category": "time", "nl_query": "What is our monthly revenue trend from completed orders?", "gold_sql": "SELECT DATE_TRUNC('month', order_date) AS month, SUM(order_total) AS revenue FROM orders WHERE status = 'completed' GROUP BY month ORDER BY month"},

    # Calculation
    {"category": "calculation", "nl_query": "What is the total gross profit across all sold items?", "gold_sql": "SELECT SUM(oi.line_total - (oi.quantity * p.cost)) AS gross_profit FROM order_items oi JOIN products p ON oi.product_id = p.product_id"},
    {"category": "calculation", "nl_query": "What is the markup (price minus cost) for each product?", "gold_sql": "SELECT product_name, unit_price - cost AS markup FROM products"},

    # Out of scope / Rejections
    {"category": "out_of_scope", "nl_query": "What is the weather in Jakarta today?", "gold_sql": None},
    {"category": "out_of_scope", "nl_query": "Explain how to write a Python web scraper using FastAPI.", "gold_sql": None},
    {"category": "out_of_scope", "nl_query": "Can you recommend a good restaurant in Surabaya?", "gold_sql": None},
    {"category": "out_of_scope", "nl_query": "Who is the president of Indonesia?", "gold_sql": None},
    {"category": "out_of_scope", "nl_query": "Can you write an essay about quantum computing?", "gold_sql": None},
]


@router.post("/evaluation/test-suite", response_model=TestSuiteResponse)
async def run_evaluation_test_suite(db: AsyncSession = Depends(get_db)):
    """
    Executes a Golden Dataset of 20 predefined tests (including out-of-scope prompts) and returns detailed results.
    """
    scored_test_results = []
    passed_count = 0
    failed_count = 0
    total_test_latency = 0.0

    intent_service = IntentService()
    analyst_service = AnalystService(db)

    async def safe_exec(sql: str):
        try:
            _, rows, _ = await analyst_service.execute_sql(sql)
            return rows, None
        except Exception as err:
            await db.rollback()
            return None, str(err)

    for case in TEST_SUITE_QUESTIONS:
        query = case["nl_query"]
        category = case["category"]
        gold_sql = case["gold_sql"]

        start_time = time.time()
        
        # 1. Detect Intent first
        intent = await intent_service.detect_intent(query)
        
        status = "Fail"
        model_output = None
        error_msg = None
        
        if category == "out_of_scope":
            # Expected to reject (be classified as anything other than DATA_QUERY, usually OUT_OF_SCOPE)
            if intent != "DATA_QUERY":
                status = "Pass"
                model_output = f"Rejected (Detected Intent: {intent})"
            else:
                is_ambig, clar, gen_sql, reason, _ = await analyst_service.generate_sql(query)
                model_output = f"Falsely compiled: {gen_sql or 'Empty SQL'}"
                error_msg = "Expected out-of-scope rejection, but compiled SQL instead."
        else:
            # Expected database query
            if intent != "DATA_QUERY":
                model_output = f"Rejected (Detected Intent: {intent})"
                error_msg = f"Expected DATA_QUERY, but classified as {intent}."
            else:
                is_ambig, clar, gen_sql, reason, _ = await analyst_service.generate_sql(query)
                model_output = gen_sql
                
                if is_ambig or not gen_sql:
                    error_msg = clar or "Agent marked request as ambiguous or failed to write SQL."
                elif not await analyst_service.check_sql_safety(gen_sql):
                    error_msg = "Guardrail blocked compiled query (only read-only select allowed)."
                else:
                    gold_rows, gold_err = await safe_exec(gold_sql)
                    if gold_err:
                        error_msg = f"Gold dataset SQL error: {gold_err}"
                    else:
                        gen_rows, gen_err = await safe_exec(gen_sql)
                        if gen_err:
                            error_msg = f"Generated SQL failed execution: {gen_err}"
                        else:
                            is_correct = analyst_service.compare_result_sets(gold_rows, gen_rows)
                            if is_correct:
                                status = "Pass"
                            else:
                                error_msg = "Result dataset did not match gold answer."
                                
        latency = int((time.time() - start_time) * 1000)
        total_test_latency += latency
        
        if status == "Pass":
            passed_count += 1
        else:
            failed_count += 1
            
        scored_test_results.append({
            "nl_query": query,
            "category": category,
            "expected_output": gold_sql or "Out of Scope Rejection",
            "model_output": model_output,
            "status": status,
            "latency_ms": latency,
            "error_message": error_msg
        })

    accuracy_rate = (passed_count / len(TEST_SUITE_QUESTIONS) * 100.0) if TEST_SUITE_QUESTIONS else 100.0
    avg_latency_ms = (total_test_latency / len(TEST_SUITE_QUESTIONS)) if TEST_SUITE_QUESTIONS else 0.0

    return TestSuiteResponse(
        test_results=scored_test_results,
        metrics={
            "total_run": len(TEST_SUITE_QUESTIONS),
            "passed": passed_count,
            "failed": failed_count,
            "accuracy_rate": round(accuracy_rate, 2),
            "avg_latency_ms": round(avg_latency_ms, 2)
        }
    )
