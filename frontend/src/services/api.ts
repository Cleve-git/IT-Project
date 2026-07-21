import {
  Profile, Conversation, Message, UploadedDocument,
  ExtractedTable, SystemStats, QueryLog, BenchmarkResult,
  Customer, Product, Order, Payment, ImportResult,
  EvaluationMetrics, TestSuiteResponse
} from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface LogFilters {
  status?: string;
  user?: string;
  search?: string;
  start?: string;
  end?: string;
}

class ApiService {
  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    const store = localStorage.getItem('cda-auth-store');
    if (!store) return null;

    try {
      const parsed = JSON.parse(store);
      let token = parsed?.state?.token;

      // Jika token tidak ada atau dalam format string 'undefined'/'null'
      if (!token || token === 'undefined' || token === 'null') {
        return null;
      }

      // Jika token berbentuk object, ambil field token-nya
      if (typeof token === 'object') {
        token = token.access_token || token.token || null;
      }

      if (typeof token !== 'string') return null;

      // Bersihkan jika ada awalan 'Bearer ' ganda
      const cleanToken = token.replace(/^Bearer\s+/i, '').trim();

      // Validasi dasar JWT (JWT harus punya minimal 2 titik/3 segmen: header.payload.signature)
      if (cleanToken.split('.').length !== 3) {
        console.warn("Token JWT tidak valid (not enough segments):", cleanToken);
        return null;
      }

      return cleanToken;
    } catch {
      return null;
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getAuthToken();
    const headers = new Headers(options.headers || {});

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const errorMsg = errBody.detail || response.statusText || 'API Request failed';
      throw new Error(errorMsg);
    }

    return response.json() as Promise<T>;
  }

  // --- Auth API ---
  async getMe(): Promise<Profile> {
    return this.request<Profile>('/api/v1/auth/me');
  }

  async syncProfile(id: string, email: string, fullName?: string): Promise<Profile> {
    return this.request<Profile>('/api/v1/auth/sync', {
      method: 'POST',
      body: JSON.stringify({ id, email, full_name: fullName }),
    });
  }

  // --- Chat & Conversation API ---
  async listConversations(): Promise<Conversation[]> {
    return this.request<Conversation[]>('/api/v1/chat/conversations');
  }

  async createConversation(title?: string): Promise<Conversation> {
    return this.request<Conversation>('/api/v1/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    return this.request<Message[]>(`/api/v1/chat/conversations/${conversationId}/messages`);
  }

  async deleteConversation(conversationId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/v1/chat/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  }

  async submitQuery(queryText: string, conversationId?: string): Promise<Message> {
    return this.request<Message>('/api/v1/chat/query', {
      method: 'POST',
      body: JSON.stringify({ query_text: queryText, conversation_id: conversationId }),
    });
  }

  async submitFeedback(messageId: string, rating: number, comment?: string): Promise<any> {
    return this.request<any>('/api/v1/chat/feedback', {
      method: 'POST',
      body: JSON.stringify({ message_id: messageId, rating, comment }),
    });
  }

  // --- Document Intelligence API ---
  async uploadDocument(file: File): Promise<UploadedDocument> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<UploadedDocument>('/api/v1/documents/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async listDocuments(): Promise<UploadedDocument[]> {
    return this.request<UploadedDocument[]>('/api/v1/documents/');
  }

  async getDocumentTables(documentId: string): Promise<ExtractedTable[]> {
    return this.request<ExtractedTable[]>(`/api/v1/documents/${documentId}/tables`);
  }

  // --- Admin API ---
  async getStats(): Promise<SystemStats> {
    return this.request<SystemStats>('/api/v1/admin/stats');
  }

  async getLogs(filters: LogFilters = {}): Promise<QueryLog[]> {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, String(v)); });
    const qs = p.toString();
    return this.request<QueryLog[]>(`/api/v1/admin/logs${qs ? `?${qs}` : ''}`);
  }

  async exportLogs(format: 'pdf' | 'csv', filters: LogFilters = {}): Promise<void> {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, String(v)); });
    const qs = p.toString();
    const token = this.getAuthToken();
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/logs/export/${format}${qs ? `?${qs}` : ''}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query-logs.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async listUsers(): Promise<Profile[]> {
    return this.request<Profile[]>('/api/v1/admin/users');
  }

  async updateUserRole(profileId: string, role: 'admin' | 'user'): Promise<Profile> {
    return this.request<Profile>(`/api/v1/admin/users/${profileId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  async runBenchmarks(opts?: { sample?: number; category?: string }): Promise<BenchmarkResult[]> {
    const params = new URLSearchParams();
    if (opts?.sample) params.set('sample', String(opts.sample));
    if (opts?.category) params.set('category', opts.category);
    const qs = params.toString();
    return this.request<BenchmarkResult[]>(`/api/v1/admin/benchmarks/run${qs ? `?${qs}` : ''}`, {
      method: 'POST',
    });
  }

  // --- Business Data Admin API (CRUD + CSV import for customers/products/orders/payments) ---
  async listBusinessData<T>(entity: string): Promise<T[]> {
    return this.request<T[]>(`/api/v1/admin/data/${entity}`);
  }

  async createBusinessData<T>(entity: string, payload: Record<string, any>): Promise<T> {
    return this.request<T>(`/api/v1/admin/data/${entity}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateBusinessData<T>(entity: string, id: number, payload: Record<string, any>): Promise<T> {
    return this.request<T>(`/api/v1/admin/data/${entity}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteBusinessData(entity: string, id: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/v1/admin/data/${entity}/${id}`, {
      method: 'DELETE',
    });
  }

  async importBusinessData(entity: string, file: File): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<ImportResult>(`/api/v1/admin/data/${entity}/import`, {
      method: 'POST',
      body: formData,
    });
  }

  async getEvaluationMetrics(): Promise<EvaluationMetrics> {
    return this.request<EvaluationMetrics>('/api/v1/admin/evaluation/metrics');
  }

  async runTestSuite(): Promise<TestSuiteResponse> {
    return this.request<TestSuiteResponse>('/api/v1/admin/evaluation/test-suite', {
      method: 'POST',
    });
  }
}

export const api = new ApiService();
export default api;
