export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  created_at: string;
}

export interface Conversation {
  conversation_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  message_id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  generated_sql: string | null;
  sql_results: {
    columns: string[];
    rows: Record<string, any>[];
  } | null;
  visualization_config: Record<string, any> | null;
  explanation: string | null;
  created_at: string;
  
  // New API response fields
  type?: 'conversation' | 'query_result';
  message?: string | null;
  sql?: string | null;
  results?: Record<string, any>[] | null;
  visualization?: Record<string, any> | null;
  references?: {
    tables: { table: string; description: string }[];
    row_count: number;
    source: string;
  } | null;
}

export interface QueryLog {
  log_id: string;
  user_id: string;
  user_email: string | null;
  query_text: string;
  executed_sql: string | null;
  execution_duration_ms: number | null;
  status: 'success' | 'failed';
  error_message: string | null;
  created_at: string;
}

export interface UploadedDocument {
  document_id: string;
  user_id: string;
  filename: string;
  file_type: 'PDF' | 'CSV';
  file_size: number;
  status: 'processing' | 'completed' | 'failed';
  created_at: string;
}

export interface ExtractedTable {
  table_id: string;
  document_id: string;
  table_name: string;
  headers: string[];
  rows: Record<string, any>[];
  created_at: string;
}

export interface SystemStats {
  total_users: number;
  total_conversations: number;
  total_queries: number;
  total_documents: number;
  query_success_rate: number;
}

// --- Business Data Admin ---
export interface Customer {
  customer_id: number;
  name: string;
  city: string;
  tier: 'Gold' | 'Silver' | 'Bronze';
  created_at: string;
}

export interface Product {
  product_id: number;
  product_name: string;
  category: 'Beauty' | 'Electronics' | 'Fashion' | 'Grocery' | 'Home' | 'Office' | 'Sports' | 'Toys';
  unit_price: number;
  cost: number;
}

export interface Order {
  order_id: number;
  customer_id: number;
  order_date: string;
  status: 'completed' | 'cancelled' | 'refunded';
  order_total: number;
}

export interface Payment {
  payment_id: number;
  order_id: number;
  amount: number;
  method: 'credit_card' | 'e_wallet' | 'bank_transfer' | 'virtual_account';
  paid_date: string;
  status: 'paid' | 'refunded';
}

export interface ImportResult {
  inserted: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export interface BenchmarkResult {
  benchmark_id: string;
  nl_query: string;
  expected_sql: string;
  generated_sql: string | null;
  is_correct: boolean;
  outcome: 'correct' | 'clarification' | 'mismatch';
  execution_time_ms: number | null;
  error_message: string | null;
  category: string | null;
  created_at: string;
}
