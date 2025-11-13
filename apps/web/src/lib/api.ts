import type {
  Card,
  TokenizeRequest,
  TokenizeResponse,
  LLMInvokeRequest,
  LLMAssistRequest,
  LLMResponse,
  LLMAssistResponse,
} from '@card-architect/schemas';

const API_BASE = '/api';

class ApiClient {
  public baseURL = API_BASE;
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<{ data?: T; error?: string }> {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        return { error: error.error || `HTTP ${response.status}` };
      }

      const data = await response.json();
      return { data };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  // Cards
  async listCards(query?: string, page = 1) {
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    params.set('page', page.toString());

    return this.request<Card[]>(`/cards?${params}`);
  }

  async getCard(id: string) {
    return this.request<Card>(`/cards/${id}`);
  }

  async createCard(card: unknown) {
    return this.request<Card>('/cards', {
      method: 'POST',
      body: JSON.stringify(card),
    });
  }

  async updateCard(id: string, updates: Partial<Card>) {
    return this.request<Card>(`/cards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteCard(id: string) {
    return this.request<void>(`/cards/${id}`, { method: 'DELETE' });
  }

  // Versions
  async listVersions(cardId: string) {
    return this.request<unknown[]>(`/cards/${cardId}/versions`);
  }

  async createVersion(cardId: string, message?: string) {
    return this.request<unknown>(`/cards/${cardId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async restoreVersion(cardId: string, versionId: string) {
    return this.request<Card>(`/cards/${cardId}/versions/${versionId}/restore`, {
      method: 'POST',
    });
  }

  // Tokenization
  async tokenize(req: TokenizeRequest) {
    return this.request<TokenizeResponse>('/tokenize', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  // Import/Export
  async importCard(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/import`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Import failed' }));
      return { error: error.error };
    }

    const data = await response.json();
    return { data };
  }

  async exportCard(cardId: string, format: 'json' | 'png') {
    const response = await fetch(`${API_BASE}/cards/${cardId}/export?format=${format}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Export failed' }));
      return { error: error.error };
    }

    const blob = await response.blob();
    return { data: blob };
  }

  // Assets
  async uploadAsset(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/assets`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      return { error: error.error };
    }

    const data = await response.json();
    return { data };
  }

  // LLM
  async invokeLLM(req: LLMInvokeRequest) {
    return this.request<LLMResponse>('/llm/invoke', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async llmAssist(req: LLMAssistRequest) {
    return this.request<LLMAssistResponse>('/llm/assist', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  // LLM streaming version
  async llmAssistStream(
    req: LLMAssistRequest,
    onChunk: (chunk: any) => void,
    onComplete: (response: LLMAssistResponse) => void,
    onError: (error: string) => void
  ) {
    try {
      const response = await fetch(`${API_BASE}/llm/assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...req, stream: true }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const chunk = JSON.parse(line.slice(6));
              if (chunk.done && chunk.assistResponse) {
                onComplete(chunk.assistResponse);
              } else {
                onChunk(chunk);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error: any) {
      onError(error.message);
    }
  }
}

export const api = new ApiClient();
