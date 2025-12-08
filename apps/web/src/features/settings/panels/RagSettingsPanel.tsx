import { useState, useEffect } from 'react';
import { useLLMStore } from '../../../store/llm-store';
import { useCardStore } from '../../../store/card-store';
import { extractCardData } from '../../../lib/card-utils';
import { api } from '../../../lib/api';

export function RagSettingsPanel() {
  const {
    settings,
    loadRagDatabases,
    ragDatabases,
    ragActiveDatabaseId,
    ragDatabaseDetails,
    ragIsLoading,
    ragError,
    createRagDatabase,
    deleteRagDatabase,
    loadRagDatabaseDetail,
    setActiveRagDatabaseId,
    uploadRagDocument,
    removeRagDocument,
  } = useLLMStore();

  const [selectedDbId, setSelectedDbId] = useState<string | null>(null);
  const [newDbName, setNewDbName] = useState('');
  const [newDbDescription, setNewDbDescription] = useState('');
  const [ragStatus, setRagStatus] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  // Free text entry state
  const [freeTextTitle, setFreeTextTitle] = useState('');
  const [freeTextContent, setFreeTextContent] = useState('');
  const [addingFreeText, setAddingFreeText] = useState(false);

  useEffect(() => {
    loadRagDatabases();
  }, [loadRagDatabases]);

  useEffect(() => {
    if (!selectedDbId && ragDatabases.length > 0) {
      const defaultId = ragActiveDatabaseId || ragDatabases[0].id;
      setSelectedDbId(defaultId);
    }
  }, [ragDatabases, ragActiveDatabaseId, selectedDbId]);

  useEffect(() => {
    if (selectedDbId && !ragDatabaseDetails[selectedDbId]) {
      loadRagDatabaseDetail(selectedDbId);
    }
  }, [selectedDbId, ragDatabaseDetails, loadRagDatabaseDetail]);

  const selectedDatabase = selectedDbId ? ragDatabaseDetails[selectedDbId] : null;

  const handleCreateDatabase = async () => {
    if (!newDbName.trim()) {
      setRagStatus('Please provide a name for the knowledge base.');
      return;
    }

    const result = await createRagDatabase({
      label: newDbName,
      description: newDbDescription,
    });

    if (!result.success) {
      setRagStatus(result.error || 'Failed to create knowledge base.');
      return;
    }

    setNewDbName('');
    setNewDbDescription('');
    setRagStatus('Knowledge base created.');
    loadRagDatabases();
  };

  const handleSelectDatabase = async (dbId: string) => {
    setSelectedDbId(dbId);
    if (!ragDatabaseDetails[dbId]) {
      await loadRagDatabaseDetail(dbId);
    }
  };

  const handleDeleteDatabase = async (dbId: string) => {
    const confirmed = window.confirm('Delete this knowledge base? This cannot be undone.');
    if (!confirmed) return;

    const result = await deleteRagDatabase(dbId);
    if (!result.success) {
      setRagStatus(result.error || 'Failed to delete knowledge base.');
      return;
    }

    if (selectedDbId === dbId) {
      setSelectedDbId(null);
    }
    setRagStatus('Knowledge base deleted.');
  };

  const handleUploadDocument = async () => {
    if (!selectedDbId || !uploadFile) {
      setRagStatus('Choose a file to upload.');
      return;
    }

    setUploading(true);
    const result = await uploadRagDocument(selectedDbId, uploadFile, {
      title: uploadTitle.trim() || undefined,
    });
    setUploading(false);

    if (!result.success) {
      setRagStatus(result.error || 'Failed to upload document.');
      return;
    }

    setUploadTitle('');
    setUploadFile(null);
    setFileInputKey((key) => key + 1);
    setRagStatus('Document indexed.');
  };

  const handleRemoveDocument = async (sourceId: string) => {
    if (!selectedDbId) return;
    const confirmed = window.confirm('Remove this document from the knowledge base?');
    if (!confirmed) return;

    const result = await removeRagDocument(selectedDbId, sourceId);
    if (!result.success) {
      setRagStatus(result.error || 'Failed to remove document.');
      return;
    }

    setRagStatus('Document removed.');
  };

  const handleSetActiveDatabase = async (dbId: string) => {
    await setActiveRagDatabaseId(dbId);
    setRagStatus('Active knowledge base updated.');
  };

  const handleAddFreeText = async () => {
    if (!selectedDbId || !freeTextTitle.trim() || !freeTextContent.trim()) {
      setRagStatus('Please provide both title and content.');
      return;
    }

    setAddingFreeText(true);
    const result = await api.addRagFreeText(selectedDbId, {
      title: freeTextTitle.trim(),
      content: freeTextContent.trim(),
    });
    setAddingFreeText(false);

    if ('error' in result) {
      setRagStatus(result.error || 'Failed to add free text entry.');
      return;
    }

    setFreeTextTitle('');
    setFreeTextContent('');
    setRagStatus(`Indexed ${result.data!.indexedChunks} chunks from free text.`);
    if (selectedDbId) {
      loadRagDatabaseDetail(selectedDbId);
    }
  };

  const handleImportCurrentLorebook = async () => {
    if (!selectedDbId) {
      setRagStatus('Please select a knowledge base first.');
      return;
    }

    // Get current card from card store
    const currentCard = useCardStore.getState().currentCard;

    if (!currentCard) {
      setRagStatus('No card loaded.');
      return;
    }

    // Extract card data
    const cardData = extractCardData(currentCard);
    const lorebook = (cardData as any).character_book;

    if (!lorebook || !lorebook.entries || lorebook.entries.length === 0) {
      setRagStatus('Current card has no lorebook entries.');
      return;
    }

    setUploading(true);
    const result = await api.addRagLorebook(selectedDbId, {
      characterName: cardData.name,
      lorebook,
    });
    setUploading(false);

    if ('error' in result) {
      setRagStatus(result.error || 'Failed to import lorebook.');
      return;
    }

    setRagStatus(
      `Imported ${lorebook.entries.length} lorebook entries (${result.data!.indexedChunks} chunks indexed).`
    );
    if (selectedDbId) {
      loadRagDatabaseDetail(selectedDbId);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">RAG Configuration</h3>
        <p className="text-dark-muted">
          Connect curated lore, style guides, and JSON instruction files so LLM Assist can cite
          them automatically.
        </p>
      </div>

      <div className="space-y-4 border border-dark-border rounded-lg p-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ragEnabled"
            checked={settings.rag?.enabled ?? false}
            onChange={(e) =>
              useLLMStore
                .getState()
                .saveSettings({ rag: { ...settings.rag, enabled: e.target.checked } })
            }
            className="rounded"
          />
          <label htmlFor="ragEnabled" className="text-sm font-medium">
            Enable RAG for LLM Assist
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Top-K Snippets</label>
            <input
              type="number"
              value={settings.rag?.topK ?? 5}
              min={1}
              onChange={(e) =>
                useLLMStore
                  .getState()
                  .saveSettings({ rag: { ...settings.rag, topK: parseInt(e.target.value) } })
              }
              className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Token Cap</label>
            <input
              type="number"
              value={settings.rag?.tokenCap ?? 2000}
              min={200}
              onChange={(e) =>
                useLLMStore
                  .getState()
                  .saveSettings({
                    rag: { ...settings.rag, tokenCap: parseInt(e.target.value) || 0 },
                  })
              }
              className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold">Knowledge Bases</h4>
        <button
          onClick={loadRagDatabases}
          className="px-3 py-1 text-sm border border-dark-border rounded hover:border-blue-500 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {(ragError || ragStatus) && (
        <div className="space-y-2">
          {ragError && (
            <div className="p-2 rounded bg-red-900/30 border border-red-700 text-red-100 text-sm">
              {ragError}
            </div>
          )}
          {ragStatus && (
            <div className="p-2 rounded bg-green-900/20 border border-green-700 text-green-100 text-sm">
              {ragStatus}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="border border-dark-border rounded-lg p-4 space-y-3">
          <h5 className="font-semibold">Create Knowledge Base</h5>
          <input
            type="text"
            placeholder="Name (e.g., Warhammer 40K Lore)"
            value={newDbName}
            onChange={(e) => setNewDbName(e.target.value)}
            className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Optional description"
            value={newDbDescription}
            onChange={(e) => setNewDbDescription(e.target.value)}
            className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm h-24 resize-none"
          />
          <button
            onClick={handleCreateDatabase}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
          >
            Create Knowledge Base
          </button>
        </div>

        <div className="border border-dark-border rounded-lg p-4 space-y-3">
          <h5 className="font-semibold">Available Bases</h5>
          {ragIsLoading ? (
            <p className="text-sm text-dark-muted">Loading knowledge bases…</p>
          ) : ragDatabases.length === 0 ? (
            <p className="text-sm text-dark-muted">
              No knowledge bases yet. Create one on the left to start indexing lore.
            </p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-auto pr-1">
              {ragDatabases.map((db) => (
                <div
                  key={db.id}
                  className={`rounded-md border p-3 ${
                    selectedDbId === db.id
                      ? 'border-blue-500 bg-blue-900/10'
                      : 'border-dark-border'
                  }`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div className="font-medium">{db.label}</div>
                      {db.description && (
                        <div className="text-xs text-dark-muted mt-0.5">{db.description}</div>
                      )}
                      <div className="text-xs text-dark-muted mt-1">
                        Docs: {db.sourceCount} • Chunks: {db.chunkCount} • Tokens: {db.tokenCount}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 text-xs">
                      <button
                        onClick={() => handleSelectDatabase(db.id)}
                        className="px-2 py-1 rounded border border-dark-border hover:border-blue-500 transition-colors"
                      >
                        Manage
                      </button>
                      <button
                        onClick={() => handleSetActiveDatabase(db.id)}
                        disabled={ragActiveDatabaseId === db.id}
                        className={`px-2 py-1 rounded border ${
                          ragActiveDatabaseId === db.id
                            ? 'border-green-600 text-green-200 cursor-default'
                            : 'border-dark-border hover:border-green-500'
                        }`}
                      >
                        {ragActiveDatabaseId === db.id ? 'Active' : 'Set Active'}
                      </button>
                      <button
                        onClick={() => handleDeleteDatabase(db.id)}
                        className="px-2 py-1 rounded border border-red-600 text-red-200 hover:bg-red-600/10 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedDatabase && (
        <div className="border border-dark-border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="font-semibold">{selectedDatabase.label}</h5>
              <p className="text-xs text-dark-muted">
                {selectedDatabase.description || 'No description'} • {selectedDatabase.sourceCount}{' '}
                docs • {selectedDatabase.tokenCount} tokens
              </p>
            </div>
            <button
              onClick={() => handleSetActiveDatabase(selectedDatabase.id)}
              className="px-3 py-1 text-sm border border-dark-border rounded hover:border-blue-500 transition-colors"
            >
              {ragActiveDatabaseId === selectedDatabase.id ? 'Active' : 'Set Active'}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {/* File Upload */}
            <div className="space-y-2">
              <h6 className="font-semibold text-sm">Upload Document</h6>
              <input
                type="text"
                placeholder="Optional display title"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm"
              />
              <input
                key={fileInputKey}
                type="file"
                accept=".md,.markdown,.txt,.json,.pdf"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-dark-text file:mr-3 file:rounded file:border-0 file:px-3 file:py-2 file:bg-blue-600 file:text-white"
              />
              <button
                onClick={handleUploadDocument}
                disabled={uploading || !uploadFile}
                className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm transition-colors"
              >
                {uploading ? 'Uploading…' : 'Upload & Index'}
              </button>
              <p className="text-xs text-dark-muted">
                PDF, Markdown, JSON, text files
              </p>
            </div>

            {/* Free Text Entry */}
            <div className="space-y-2">
              <h6 className="font-semibold text-sm">Add Free Text</h6>
              <input
                type="text"
                placeholder="Title (e.g., Writing Guide)"
                value={freeTextTitle}
                onChange={(e) => setFreeTextTitle(e.target.value)}
                className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm"
              />
              <textarea
                placeholder="Paste your documentation, notes, or guidelines here..."
                value={freeTextContent}
                onChange={(e) => setFreeTextContent(e.target.value)}
                rows={3}
                className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm resize-none"
              />
              <button
                onClick={handleAddFreeText}
                disabled={addingFreeText || !freeTextTitle.trim() || !freeTextContent.trim()}
                className="w-full px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm transition-colors"
              >
                {addingFreeText ? 'Adding…' : 'Add Text Entry'}
              </button>
              <p className="text-xs text-dark-muted">
                Direct text input for notes
              </p>
            </div>

            {/* Lorebook Import */}
            <div className="space-y-2">
              <h6 className="font-semibold text-sm">Import Lorebook</h6>
              <p className="text-xs text-dark-muted mb-3">
                Import the lorebook from the currently loaded card as searchable knowledge.
              </p>
              <button
                onClick={handleImportCurrentLorebook}
                disabled={uploading}
                className="w-full px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 text-sm transition-colors"
              >
                {uploading ? 'Importing…' : 'Import Current Card Lorebook'}
              </button>
              <p className="text-xs text-dark-muted">
                Extracts all lorebook entries with keywords and content
              </p>
            </div>

          </div>

          {/* Documents List */}
          <div className="mt-4">
            <h6 className="font-semibold text-sm mb-2">Indexed Documents</h6>
            {selectedDatabase.sources.length === 0 ? (
              <p className="text-sm text-dark-muted">No documents indexed yet.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-auto pr-1">
                {selectedDatabase.sources.map((source) => {
                  // Define type badge colors
                  const typeColors: Record<string, string> = {
                    pdf: 'bg-red-600',
                    markdown: 'bg-blue-600',
                    json: 'bg-yellow-600',
                    text: 'bg-gray-600',
                    html: 'bg-green-600',
                    freetext: 'bg-purple-600',
                    lorebook: 'bg-orange-600',
                  };
                  const typeColor = typeColors[source.type] || 'bg-slate-600';

                  return (
                    <div
                      key={source.id}
                      className="border border-dark-border rounded-md p-2 flex justify-between items-start gap-3"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">{source.title}</div>
                          <span className={`text-xs px-2 py-0.5 rounded text-white ${typeColor}`}>
                            {source.type.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs text-dark-muted">
                          {source.chunkCount} chunks • {source.tokenCount} tokens
                          {source.tags && source.tags.length > 0 && (
                            <span> • Tags: {source.tags.join(', ')}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveDocument(source.id)}
                        className="text-xs text-red-300 hover:text-red-200 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
