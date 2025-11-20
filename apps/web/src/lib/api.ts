import type {
  Card,
  TokenizeRequest,
  TokenizeResponse,
  LLMInvokeRequest,
  LLMAssistRequest,
  LLMResponse,
  LLMAssistResponse,
  RagDatabase,
  RagDatabaseDetail,
  RagSnippet,
  RagSource,
  CardAssetWithDetails,
  UserPreset,
  CreatePresetRequest,
} from '@card-architect/schemas';

const API_BASE = '/api';

class ApiClient {
  public baseURL = API_BASE;
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<{ data?: T; error?: string }> {
    try {
      // Only set Content-Type if there's a body
      const headers: Record<string, string> = {};
      if (options?.body) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          ...options?.headers,
          ...headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        return { error: error.error || `HTTP ${response.status}` };
      }

      // Handle empty responses (e.g., 204 No Content or empty DELETE responses)
      const text = await response.text();
      if (!text) {
        return { data: undefined as T };
      }

      const data = JSON.parse(text);
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

  async getCardAssets(cardId: string) {
    return this.request<CardAssetWithDetails[]>(`/cards/${cardId}/assets`);
  }

  async getAssets(cardId: string) {
    const result = await this.getCardAssets(cardId);
    if (result.error) throw new Error(result.error);
    return result.data || [];
  }

  async getAssetGraph(cardId: string) {
    const result = await this.request<any>(`/cards/${cardId}/asset-graph`);
    if (result.error) throw new Error(result.error);
    return result.data;
  }

  async uploadAsset(
    cardId: string,
    file: File,
    type: string,
    name: string,
    isMain: boolean,
    tags: string[]
  ) {
    const formData = new FormData();
    formData.append('file', file);

    const params = new URLSearchParams();
    params.set('type', type);
    params.set('name', name);
    if (isMain) params.set('isMain', 'true');
    if (tags.length > 0) params.set('tags', tags.join(','));

    const response = await fetch(`${API_BASE}/cards/${cardId}/assets/upload?${params}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error);
    }

    return await response.json();
  }

  async updateAsset(cardId: string, assetId: string, updates: any) {
    const result = await this.request<any>(`/cards/${cardId}/assets/${assetId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    if (result.error) throw new Error(result.error);
    return result.data;
  }

  async deleteAsset(cardId: string, assetId: string) {
    const result = await this.request<void>(`/cards/${cardId}/assets/${assetId}`, {
      method: 'DELETE',
    });
    if (result.error) throw new Error(result.error);
  }

  async setPortraitOverride(cardId: string, assetId: string) {
    const result = await this.request<any>(
      `/cards/${cardId}/assets/${assetId}/set-portrait-override`,
      { method: 'POST' }
    );
    if (result.error) throw new Error(result.error);
    return result.data;
  }

  async setMainBackground(cardId: string, assetId: string) {
    const result = await this.request<any>(
      `/cards/${cardId}/assets/${assetId}/set-main-background`,
      { method: 'POST' }
    );
    if (result.error) throw new Error(result.error);
    return result.data;
  }

  async bindAssetToActor(cardId: string, assetId: string, actorIndex: number) {
    const result = await this.request<any>(`/cards/${cardId}/assets/${assetId}/bind-actor`, {
      method: 'POST',
      body: JSON.stringify({ actorIndex }),
    });
    if (result.error) throw new Error(result.error);
    return result.data;
  }

  async unbindAssetFromActor(cardId: string, assetId: string) {
    const result = await this.request<any>(`/cards/${cardId}/assets/${assetId}/unbind-actor`, {
      method: 'POST',
    });
    if (result.error) throw new Error(result.error);
    return result.data;
  }

  async setAssetAsMain(cardId: string, assetId: string) {
    return this.request<{ success: boolean }>(`/cards/${cardId}/assets/${assetId}/main`, {
      method: 'PATCH',
    });
  }

  async deleteCardAsset(cardId: string, assetId: string) {
    return this.request<void>(`/cards/${cardId}/assets/${assetId}`, {
      method: 'DELETE',
    });
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

  async importVoxtaPackage(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/import-voxta`, {
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

  async importCardFromURL(url: string) {
    return this.request<{ card: Card; warnings?: string[]; source: string }>('/import-url', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  async exportCard(cardId: string, format: 'json' | 'png' | 'charx' | 'voxta') {
    const response = await fetch(`${API_BASE}/cards/${cardId}/export?format=${format}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Export failed' }));
      return { error: error.error };
    }

    const blob = await response.blob();
    return { data: blob };
  }

  // Assets (generic, not card-specific)
  async uploadGenericAsset(file: File) {
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

  // RAG
  async listRagDatabases() {
    return this.request<{ databases: RagDatabase[]; activeDatabaseId: string | null }>(
      '/rag/databases'
    );
  }

  async createRagDatabase(payload: { label: string; description?: string; tags?: string[] }) {
    return this.request<{ database: RagDatabaseDetail }>('/rag/databases', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getRagDatabase(id: string) {
    return this.request<{ database: RagDatabaseDetail }>(`/rag/databases/${id}`);
  }

  async updateRagDatabase(
    id: string,
    payload: { label?: string; description?: string; tags?: string[] }
  ) {
    return this.request<{ database: RagDatabaseDetail }>(`/rag/databases/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteRagDatabase(id: string) {
    return this.request<{ success: boolean }>(`/rag/databases/${id}`, { method: 'DELETE' });
  }

  async uploadRagDocument(
    dbId: string,
    file: File,
    options?: { title?: string; tags?: string[] }
  ) {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.title) formData.append('title', options.title);
    if (options?.tags?.length) formData.append('tags', JSON.stringify(options.tags));

    const response = await fetch(`${API_BASE}/rag/databases/${dbId}/documents`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      return { error: error.error };
    }

    const data = (await response.json()) as { source: RagSource; indexedChunks: number };
    return { data };
  }

  async addRagFreeText(
    dbId: string,
    payload: { title: string; content: string; tags?: string[] }
  ) {
    return this.request<{ source: RagSource; indexedChunks: number }>(
      `/rag/databases/${dbId}/text`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  }

  async addRagLorebook(
    dbId: string,
    payload: { characterName: string; lorebook: any; tags?: string[] }
  ) {
    return this.request<{ source: RagSource; indexedChunks: number }>(
      `/rag/databases/${dbId}/lorebook`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  }

  async deleteRagDocument(dbId: string, sourceId: string) {
    return this.request<{ success: boolean }>(
      `/rag/databases/${dbId}/documents/${sourceId}`,
      { method: 'DELETE' }
    );
  }

  async searchRag(
    databaseId: string,
    query: string,
    params?: { topK?: number; tokenCap?: number }
  ) {
    const searchParams = new URLSearchParams({ q: query, databaseId });
    if (params?.topK) searchParams.set('k', params.topK.toString());
    if (params?.tokenCap) searchParams.set('tokenCap', params.tokenCap.toString());
    return this.request<{ snippets: RagSnippet[] }>(`/rag/search?${searchParams.toString()}`);
  }

  // Presets
  async getPresets() {
    return this.request<{ presets: UserPreset[] }>('/presets');
  }

  async getPreset(id: string) {
    return this.request<{ preset: UserPreset }>(`/presets/${id}`);
  }

  async createPreset(data: CreatePresetRequest) {
    return this.request<{ preset: UserPreset }>('/presets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePreset(id: string, data: Partial<CreatePresetRequest>) {
    return this.request<{ preset: UserPreset }>(`/presets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deletePreset(id: string) {
    return this.request<{ success: boolean }>(`/presets/${id}`, { method: 'DELETE' });
  }

  async exportPresets() {
    const response = await fetch(`${API_BASE}/presets/export/all`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Export failed' }));
      return { error: error.error };
    }

    const blob = await response.blob();
    return { data: blob };
  }

  async importPresets(presets: CreatePresetRequest[]) {
    return this.request<{ success: boolean; imported: number; failed: number; failures: Array<{ name: string; error: string }> }>('/presets/import', {
      method: 'POST',
      body: JSON.stringify({ presets }),
    });
  }

  // SillyTavern integration
  async pushToSillyTavern(cardId: string) {
    return this.request<{ success: boolean; status?: number; imported?: any; fileName?: string; error?: string }>(
      `/cards/${cardId}/push-to-sillytavern`,
      { method: 'POST' }
    );
  }

  // Settings
  async getSillyTavernSettings() {
    return this.request<{ settings: { enabled: boolean; baseUrl: string; importEndpoint: string; sessionCookie: string } }>(
      '/settings/sillytavern'
    );
  }

  async updateSillyTavernSettings(settings: { enabled: boolean; baseUrl: string; importEndpoint: string; sessionCookie: string }) {
    return this.request<{ success: boolean; settings: any }>(
      '/settings/sillytavern',
      {
        method: 'PATCH',
        body: JSON.stringify({ sillyTavern: settings }),
      }
    );
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
