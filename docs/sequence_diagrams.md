# System Sequence Diagrams

These sequence diagrams illustrate the runtime interaction flows between the Next.js Frontend, the FastAPI Backend, Supabase Auth, the PostgreSQL Database, and the Groq LLM API.

---

## 1. User Authentication & Profile Synchronization

This flow shows how user details are synchronized to our PostgreSQL database right after client sign-up/login.

```mermaid
sequenceDiagram
    autonumber
    actor User as Client Browser
    participant FE as Next.js Frontend
    participant SB as Supabase Auth
    participant BE as FastAPI Backend
    participant DB as PostgreSQL DB

    User->>FE: Enters credentials / Signs In
    FE->>SB: Calls signInWithPassword()
    SB-->>FE: Returns session (User details, JWT token)
    FE->>BE: POST /api/v1/auth/sync (JWT in Auth Header)
    Note over BE: security.py decodes JWT<br/>verifies signature locally
    BE->>DB: Check if Profile exists for sub (UUID)
    alt Profile does not exist
        BE->>DB: INSERT into profiles (id, email, role: 'user')
    else Profile exists
        BE->>DB: UPDATE profiles (email, full_name)
    end
    DB-->>BE: Confirm profile state
    BE-->>FE: Return Profile JSON (e.g. role: 'admin')
    FE->>User: Route into Workspace / Dashboard
```

---

## 2. Conversational Analyst Execution Loop

This diagram models the core natural language processing, safety guardrails verification, SQL compilation, execution, and UI presentation loop.

```mermaid
sequenceDiagram
    autonumber
    actor User as Business User
    participant FE as Next.js Workspace
    participant BE as FastAPI Backend
    participant LLM as Groq LLM API
    participant DB as PostgreSQL DB

    User->>FE: Types NL question (e.g., "Top customer NYC")
    FE->>BE: POST /api/v1/chat/query (JSON: query_text, conversation_id)
    BE->>DB: Log incoming query into query_logs (status: processing)
    BE->>LLM: Compiles prompt with schema context & history
    Note over BE,LLM: Uses llama-3.3-70b-versatile
    LLM-->>BE: Returns SQL JSON (is_ambiguous, sql, reasoning)
    
    alt Case A: Query is Ambiguous
        BE->>DB: Save assistant response (clarification question)<br/>Update query_logs (status: failed)
        BE-->>FE: Returns clarification message
        FE->>User: Renders question modal
    else Case B: Query is Valid
        Note over BE: Runs check_sql_safety()<br/>(Blocks INSERT/UPDATE/DELETE/ALTER/DROP)
        alt SQL violates safety rules
            BE->>DB: Save warning message<br/>Update query_logs (status: failed, reason: safety violation)
            BE-->>FE: Returns safety notification message
        else SQL is Safe
            BE->>DB: Execute SELECT/WITH statement in Postgres
            DB-->>BE: Returns column names and row datasets
            BE->>LLM: Request explanation (llama-3-8b-8192)
            LLM-->>BE: Returns plain-text business summary
            Note over BE: Recommend Plotly chart type (bar/line)<br/>based on column datatypes
            BE->>DB: Save Message (content: explanation, sql, results, chart_config)<br/>Update query_logs (status: success, duration_ms)
            BE-->>FE: Return Message JSON
            FE->>User: Renders text summary, Plotly Chart, and Data Grid
        end
    end
```

---

## 3. Document Intelligence Parser Flow

This flow illustrates the asynchronous file processing pipeline for CSVs and PDFs.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Administrator
    participant FE as Admin Panel
    participant BE as FastAPI Backend
    participant DP as Document Service
    participant DB as PostgreSQL DB

    Admin->>FE: Uploads report.pdf / sales.csv
    FE->>BE: POST /api/v1/documents/upload (Multipart file)
    BE->>DP: Save file locally & Create registry in DB (status: processing)
    BE-->>FE: Returns UploadedDocument JSON (document_id)
    Note over FE: UI shows loading spinner<br/>(status: Parsing...)
    
    Note over BE: FastAPI schedules background task:<br/>process_document(document_id)
    
    alt File type is CSV
        DP->>DP: Read with Pandas DataFrame
        DP->>DB: INSERT into extracted_tables (headers, row records)
    else File type is PDF
        DP->>DP: Extract text with PyPDF Reader
        DP->>DP: Tokenise text segments into pages
        DP->>DB: INSERT into document_chunks (page text, metadata)
        DP->>DB: INSERT into extracted_tables (preview text lines)
    end
    
    DP->>DB: UPDATE uploaded_documents (status: completed)
    
    Admin->>FE: Clicks "Refresh List" / Polling
    FE->>BE: GET /api/v1/documents/
    BE->>DB: Fetch uploaded files
    DB-->>BE: Return documents
    BE-->>FE: Return document array (report.pdf, status: completed)
    Note over FE: UI updates status badge to "Ready"<br/>Enables "View Data" button
    
    Admin->>FE: Clicks "View Data"
    FE->>BE: GET /api/v1/documents/{id}/tables
    BE->>DB: SELECT from extracted_tables
    DB-->>BE: Return headers & row json
    BE-->>FE: Return ExtractedTable JSON
    FE->>Admin: Displays tables in preview inspection modal
```
