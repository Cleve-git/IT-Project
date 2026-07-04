import { 
  Profile, Conversation, Message, UploadedDocument, 
  ExtractedTable, SystemStats, QueryLog, BenchmarkResult 
} from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiService {
  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    const store = localStorage.getItem('cda-auth-store');
    if (!store) return null;
    try {
      const parsed = JSON.parse(store);
      return parsed?.state?.token || null;
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

  async submitFeedback(messageId: string, rating: number, comment?: string): Promise<unknown> {
    return this.request<unknown>('/api/v1/chat/feedback', {
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

  async getLogs(): Promise<QueryLog[]> {
    return this.request<QueryLog[]>('/api/v1/admin/logs');
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
}

export const api = new ApiService();
export default api;
