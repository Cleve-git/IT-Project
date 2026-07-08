# Conversational Data Analyst

A production-ready monorepo web application that translates natural language questions into secure PostgreSQL queries, executes them securely, visualizes the result sets dynamically with Plotly.js charts, generates plain-text business summaries using LLMs, and extracts tabular layouts from uploaded PDFs/CSVs.

---

## Project 3 Deliverables — Where to Find Each

This project implements **Project 3: Conversational Data Analyst** end to end. Mapping of each required deliverable to its implementation:

| # | Deliverable | Implementation |
|---|---|---|
| 1 | Schema-aware, **read-only** NL→SQL agent | `backend/app/application/services/analyst_service.py` (`generate_sql`, `check_sql_safety` — blocks all write/DDL) |
| 2 | Execute → answer + **auto chart** + **explanation** | `analyst_service.py` (`execute_sql`, `generate_plotly_config`, `generate_explanation`); rendered by `frontend/.../chat/QueryVisualizer.tsx` |
| 3 | **Clarifying questions + multi-turn** follow-ups | `chat.py` + `infrastructure/repositories/context_repository.py` + `ConversationContext` model (persists the pending clarification, merges the user's next answer) |
| 4 | Query log + **"show the SQL"** transparency | `query_logs` table, `LogViewer.tsx`, and the SQL tab in `QueryVisualizer.tsx` |
| 5 | **Execution-accuracy** evaluation (50+ benchmark questions) | `backend/app/application/benchmarks/benchmark_suite.py` (52 gold Qs) + `POST /api/v1/admin/benchmarks/run`; Admin → Benchmarking tab. See *Evaluation* below. |
| 6 | **Business case** for self-service analytics | `docs/business_case.md` |

---

## Technical Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui components, Zustand, TanStack Query, Plotly.js.
- **Backend**: FastAPI, SQLAlchemy (Asyncpg), Pydantic v2, Alembic, LangChain, LangChain-Groq.
- **Database**: Supabase PostgreSQL (compatible with standard PostgreSQL instances).
- **Authentication**: Supabase Auth (integrated with Local JWT decryption and Role-Based Access Controls).
- **AI Provider**: Groq API (Defaulting to `llama-3.3-70b-versatile` for SQL and `llama-3-8b-8192` for explanations).
- **Deployment**: Frontend -> Vercel | Backend -> Railway | Database -> Supabase.

---

## Monorepo Directory Mapping

```
conversational-data-analyst/
├── backend/
│   ├── app/
│   │   ├── api/             # Routes schemas (DTOs) and v1 endpoint controllers
│   │   ├── application/     # Services: SQL generator, Document parser
│   │   ├── core/            # Security JWT verification, DB engine, Seeder config
│   │   ├── domain/          # Declarative models (all 14 tables)
│   │   └── infrastructure/  # Repositories for Profiles, Chats, Docs
│   ├── alembic/             # Database migration environments
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router (login, dashboard, admin panel)
│   │   ├── components/      # UI components (charts, schema explorer, grids)
│   │   ├── services/        # API client fetches
│   │   ├── store/           # Zustand states
│   │   └── types/           # TypeScript contracts
│   ├── Dockerfile
│   └── package.json
├── docs/
│   ├── erd.md               # Mermaid Entity-Relationship Diagram
│   └── sequence_diagrams.md # Mermaid Sequence Diagrams
├── docker-compose.yml       # Local database, backend, frontend orchestration
└── README.md
```

---

## Database Tables

The project implements **14 database tables** split into two categories:

### Core Business Tables (Sales Context)
- `customers`: ID, Name, City, Tier (Premium, Standard, Basic), Created At
- `products`: ID, Name, Category, Unit Price, cost
- `orders`: ID, Customer ID, Date, Status (Completed, Pending, Cancelled), Total
- `payments`: ID, Order ID, Amount, Method, Paid Date, Status (Success, Pending, Failed)
- `order_items`: ID, Order ID, Product ID, Quantity, Unit Price, Line Total

### Application System Tables
- `profiles`: Synced user entries linked to Supabase authentication UUIDs (RBAC roles: `admin`/`user`)
- `conversations`: Chat sessions titles and date properties
- `messages`: Indivual entries containing NL prompt, compiled SQL, raw results, Plotly chart specs, and plain language explanations
- `query_logs`: Complete execution audit history (timings, compile success indicators, errors)
- `benchmark_results`: Performance analytics metrics comparing compiled outputs to golden statements
- `feedback`: User thumbs-up/down ratings and comment inputs on query responses
- `uploaded_documents`: PDF/CSV file uploads registry and status tracking
- `extracted_tables`: Relational representations extracted from unstructured files
- `document_chunks`: Document text partitions mapped with mock embedding vectors

---

## Local Development & Setup

Follow these steps to run the complete workspace locally.

### 1. Configure Environment Variables

Create a file named `.env` inside the `backend/` folder:

```env
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/conversational_analyst
DATABASE_SYNC_URL=postgresql://postgres:password@localhost:5432/conversational_analyst
GROQ_API_KEY=your-actual-groq-api-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_JWT_SECRET=your-supabase-jwt-secret-for-token-decoding
ENVIRONMENT=development
SQL_GENERATION_MODEL=llama-3.3-70b-versatile
EXPLANATION_MODEL=llama-3-8b-8192
```

> [!TIP]
> If you do not have a Groq API Key or Supabase URL configured yet, you can leave the default values unchanged in `docker-compose.yml`. The system will automatically fall back to **Mock Sandbox Engines**, permitting complete offline testing and reviews!

---

### 2. Run via Docker Compose (Recommended)

Start the entire monorepo stack with a single command from the root directory:

```bash
docker-compose up --build
```

This launches three containers:
1. `cda-postgres` at `localhost:5432` (Auto-creates the 14 tables and **seeds them with mock customers, products, orders, payments, and profiles**)
2. `cda-backend` at `localhost:8000` (FastAPI server, documentation available at `http://localhost:8000/docs`)
3. `cda-frontend` at `localhost:3000` (Next.js 15 App router workspace)

---

### 3. Immediate Login Sandboxes

Once docker-compose is healthy:
1. Navigate to the login screen: `http://localhost:3000`
2. Click the **User Sandbox** shortcut to log in instantly as a Business Analyst (`user@cda.com`).
3. Click the **Admin Sandbox** shortcut to log in instantly as a System Administrator (`admin@cda.com`).

---

## SQL Guardrails & Security Policies

To secure execution, the backend Analyst Service implements a two-stage filter:
1. **Keyword Sanitization**: Disallows any operations containing modifying SQL keywords (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `TRUNCATE`).
2. **Statement Constraint**: Verifies using regex syntax filters that statements strictly begin with `SELECT` or `WITH`.

---

## Evaluation: Execution-Accuracy Benchmark

The NL→SQL agent is evaluated against a **golden dataset of 52 natural-language questions** (`backend/app/application/benchmarks/benchmark_suite.py`), each paired with a hand-written gold SQL answer and grouped into categories (aggregation, filtering, grouping, joins, ranking, time, calculation).

The metric is **execution accuracy**, the standard for text-to-SQL: for every question the system executes *both* the agent-generated SQL and the gold SQL against the live database, then compares the two **result sets**. A case counts as correct only when the generated query returns the same data as the gold answer. The comparison is order- and alias-insensitive (treats each result as a multiset of normalized rows), so harmless phrasing differences don't cause false negatives, while a query that computes the wrong thing is caught.

Run it from the **Admin Panel → Benchmarking** tab, or directly:

```bash
# Full suite
curl -X POST http://localhost:8000/api/v1/admin/benchmarks/run

# Optional: one category, or cap the count (useful to avoid LLM rate limits)
curl -X POST "http://localhost:8000/api/v1/admin/benchmarks/run?category=joins"
curl -X POST "http://localhost:8000/api/v1/admin/benchmarks/run?sample=10"
```

The response (and the admin UI) reports overall accuracy, per-category accuracy, mean compile latency, and the failure reason for each missed case (ambiguous, guardrail-blocked, execution error, or result mismatch).

> [!NOTE]
> The benchmark exercises the **real LLM** path. Running it in offline Mock Sandbox mode will score low, because the mock generator only recognizes a handful of query patterns — set a valid `GROQ_API_KEY` for a representative score.

---

## platform deployment Guides

### Database Setup
1. Create a PostgreSQL project on [Supabase](https://supabase.com).
2. Grab the transaction connection string and set it in your environment variables as `DATABASE_URL` (with `postgresql+asyncpg://` schema).

### Backend Deployment (Railway)
1. Link your GitHub repository to [Railway](https://railway.app).
2. Create a new service from the repository and point the path to `/backend`.
3. Add the required environment variables in the variables tab.
4. Set the start command to `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

### Frontend Deployment (Vercel)
1. Import your repository into [Vercel](https://vercel.com).
2. Set the root directory configuration to `frontend`.
3. Configure Environment Variables:
   - `NEXT_PUBLIC_API_URL`: Your deployed FastAPI backend URL.
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project API URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon Key.
4. Deploy.
