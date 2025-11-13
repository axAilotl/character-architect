import type { Card, TokenizeRequest, TokenizeResponse } from '@card-architect/schemas';

const API_BASE = '/api';

class ApiClient {
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
}

export const api = new ApiClient();
