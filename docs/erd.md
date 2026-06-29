# Entity-Relationship Diagram (ERD)

The database schema of the **Conversational Data Analyst** project consists of **14 tables** divided into **Core Business tables** (containing seedable sales data) and **Application operational tables**.

```mermaid
erDiagram
    PROFILES {
        string id PK "Supabase User UUID"
        string email
        string full_name
        string role "admin / user"
        timestamp created_at
    }

    CUSTOMERS {
        integer customer_id PK
        string name
        string city
        string tier "Premium / Standard / Basic"
        timestamp created_at
    }

    PRODUCTS {
        integer product_id PK
        string product_name
        string category
        decimal unit_price
        decimal cost
    }

    ORDERS {
        integer order_id PK
        integer customer_id FK
        timestamp order_date
        string status "Completed / Pending / Cancelled"
        decimal order_total
    }

    PAYMENTS {
        integer payment_id PK
        integer order_id FK
        decimal amount
        string method "Credit Card / PayPal / Bank Transfer"
        timestamp paid_date
        string status "Success / Pending / Failed"
    }

    ORDER_ITEMS {
        integer order_item_id PK
        integer order_id FK
        integer product_id FK
        integer quantity
        decimal unit_price
        decimal line_total
    }

    CONVERSATIONS {
        string conversation_id PK "UUID"
        string user_id FK
        string title
        timestamp created_at
        timestamp updated_at
    }

    MESSAGES {
        string message_id PK "UUID"
        string conversation_id FK
        string role "user / assistant"
        text content
        text generated_sql
        json sql_results
        json visualization_config
        text explanation
        timestamp created_at
    }

    QUERY_LOGS {
        string log_id PK "UUID"
        string user_id FK
        text query_text
        text executed_sql
        integer execution_duration_ms
        string status "success / failed"
        text error_message
        timestamp created_at
    }

    BENCHMARK_RESULTS {
        string benchmark_id PK "UUID"
        text nl_query
        text expected_sql
        text generated_sql
        boolean is_correct
        integer execution_time_ms
        text error_message
        timestamp created_at
    }

    FEEDBACK {
        string feedback_id PK "UUID"
        string message_id FK
        string user_id FK
        integer rating "1 (dislike) - 5 (like)"
        text comment
        timestamp created_at
    }

    UPLOADED_DOCUMENTS {
        string document_id PK "UUID"
        string user_id FK
        string filename
        string file_type "PDF / CSV"
        integer file_size
        string storage_path
        string status "processing / completed / failed"
        timestamp created_at
    }

    EXTRACTED_TABLES {
        string table_id PK "UUID"
        string document_id FK
        string table_name
        json headers
        json rows
        timestamp created_at
    }

    DOCUMENT_CHUNKS {
        string chunk_id PK "UUID"
        string document_id FK
        text content
        json metadata_json
        json embedding
        timestamp created_at
    }

    PROFILES ||--o{ CONVERSATIONS : "starts"
    PROFILES ||--o{ QUERY_LOGS : "runs"
    PROFILES ||--o{ UPLOADED_DOCUMENTS : "uploads"
    PROFILES ||--o{ FEEDBACK : "submits"

    CUSTOMERS ||--o{ ORDERS : "places"
    ORDERS ||--o{ PAYMENTS : "pays"
    ORDERS ||--o{ ORDER_ITEMS : "details"
    PRODUCTS ||--o{ ORDER_ITEMS : "included_in"

    CONVERSATIONS ||--o{ MESSAGES : "contains"
    MESSAGES ||--o{ FEEDBACK : "rates"

    UPLOADED_DOCUMENTS ||--o{ EXTRACTED_TABLES : "extracts_to"
    UPLOADED_DOCUMENTS ||--o{ DOCUMENT_CHUNKS : "splits_into"
```
