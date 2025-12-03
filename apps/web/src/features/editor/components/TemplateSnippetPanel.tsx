import { useState, useEffect, useRef } from 'react';
import { useTemplateStore } from '../../../store/template-store';
import type { Template, Snippet, TemplateCategory, SnippetCategory, FocusField } from '@card-architect/schemas';
import { TemplateEditor } from './TemplateEditor';
import { SnippetEditor } from './SnippetEditor';

// ELARA VOSS stats type
interface ElaraVossStats {
  total: number;
  male: { first: number; last: number };
  female: { first: number; last: number };
  neutral: { first: number; last: number };
}

interface TemplateSnippetPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate?: (template: Template, mode: 'replace' | 'append' | 'prepend') => void;
  onInsertSnippet?: (snippet: Snippet) => void;
  currentField?: FocusField;
  manageMode?: boolean; // If true, shows full CRUD interface
  embedded?: boolean; // If true, doesn't render as modal (for embedding in settings)
}

type Tab = 'templates' | 'snippets' | 'elara-voss';

export function TemplateSnippetPanel({
  isOpen,
  onClose,
  onApplyTemplate,
  onInsertSnippet,
  manageMode = false,
  embedded = false,
}: TemplateSnippetPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('templates');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | SnippetCategory | 'all'>('all');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | undefined>(undefined);
  const [showSnippetEditor, setShowSnippetEditor] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | undefined>(undefined);

  // ELARA VOSS state
  const [elaraVossStats, setElaraVossStats] = useState<ElaraVossStats | null>(null);
  const [elaraVossLoading, setElaraVossLoading] = useState(false);
  const [elaraVossStatus, setElaraVossStatus] = useState<string | null>(null);
  const elaraVossImportRef = useRef<HTMLInputElement>(null);

  const templateImportRef = useRef<HTMLInputElement>(null);
  const snippetImportRef = useRef<HTMLInputElement>(null);

  const {
    templates,
    snippets,
    loadTemplates,
    loadSnippets,
    deleteTemplate,
    deleteSnippet,
    createTemplate,
    updateTemplate,
    createSnippet,
    updateSnippet,
    exportTemplates,
    exportSnippets,
    importTemplates,
    importSnippets,
    resetTemplates,
    resetSnippets,
  } = useTemplateStore();

  // Load templates and snippets on mount
  useEffect(() => {
    if (isOpen || embedded) {
      loadTemplates();
      loadSnippets();
    }
  }, [isOpen, embedded, loadTemplates, loadSnippets]);

  // Load ELARA VOSS stats when tab is active
  const loadElaraVossStats = async () => {
    setElaraVossLoading(true);
    try {
      const response = await fetch('/api/elara-voss/stats');
      if (response.ok) {
        const data = await response.json();
        setElaraVossStats(data);
      }
    } catch (err) {
      console.error('Failed to load ELARA VOSS stats:', err);
    } finally {
      setElaraVossLoading(false);
    }
  };

  useEffect(() => {
    if ((isOpen || embedded) && activeTab === 'elara-voss') {
      loadElaraVossStats();
    }
  }, [isOpen, embedded, activeTab]);

  // ELARA VOSS import handler
  const handleElaraVossImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setElaraVossStatus('Importing...');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const names = Array.isArray(parsed) ? parsed : (parsed.names || []);

      const response = await fetch('/api/elara-voss/names/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names, merge: false }),
      });

      const result = await response.json();
      if (response.ok) {
        setElaraVossStatus(`Imported ${result.imported} names`);
        loadElaraVossStats();
      } else {
        setElaraVossStatus(`Import failed: ${result.error}`);
      }
    } catch (err: any) {
      setElaraVossStatus(`Import error: ${err.message}`);
    }

    setTimeout(() => setElaraVossStatus(null), 5000);
    e.target.value = '';
  };

  // ELARA VOSS export handler
  const handleElaraVossExport = async () => {
    window.location.href = '/api/elara-voss/names/export';
  };

  // ELARA VOSS reset handler
  const handleElaraVossReset = async () => {
    if (confirm('Reset ELARA VOSS names to defaults? This will remove all custom names.')) {
      try {
        const response = await fetch('/api/elara-voss/names/reset', { method: 'POST' });
        if (response.ok) {
          setElaraVossStatus('Reset to defaults');
          loadElaraVossStats();
        }
      } catch (err: any) {
        setElaraVossStatus(`Reset error: ${err.message}`);
      }
      setTimeout(() => setElaraVossStatus(null), 3000);
    }
  };

  if (!isOpen && !embedded) return null;

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filter snippets
  const filteredSnippets = snippets.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         s.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleApplyTemplate = (mode: 'replace' | 'append' | 'prepend') => {
    if (selectedTemplate && onApplyTemplate) {
      onApplyTemplate(selectedTemplate, mode);
      onClose();
    }
  };

  const handleInsertSnippet = () => {
    if (selectedSnippet && onInsertSnippet) {
      onInsertSnippet(selectedSnippet);
      onClose();
    }
  };

  const handleDelete = async () => {
    if (activeTab === 'templates' && selectedTemplate) {
      if (selectedTemplate.isDefault) {
        alert('Cannot delete default templates');
        return;
      }
      if (confirm(`Delete template "${selectedTemplate.name}"?`)) {
        await deleteTemplate(selectedTemplate.id);
        setSelectedTemplate(null);
      }
    } else if (activeTab === 'snippets' && selectedSnippet) {
      if (selectedSnippet.isDefault) {
        alert('Cannot delete default snippets');
        return;
      }
      if (confirm(`Delete snippet "${selectedSnippet.name}"?`)) {
        await deleteSnippet(selectedSnippet.id);
        setSelectedSnippet(null);
      }
    }
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(undefined);
    setShowTemplateEditor(true);
  };

  const handleEditTemplate = () => {
    if (selectedTemplate) {
      if (selectedTemplate.isDefault) {
        // Create a copy of the default template for editing
        const copy: Template = {
          ...selectedTemplate,
          id: '', // Will be assigned by createTemplate
          name: `${selectedTemplate.name} (Copy)`,
          isDefault: false,
          createdAt: '',
          updatedAt: '',
        };
        setEditingTemplate(copy);
      } else {
        setEditingTemplate(selectedTemplate);
      }
      setShowTemplateEditor(true);
    }
  };

  const handleSaveTemplate = async (templateData: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingTemplate && editingTemplate.id) {
      // Editing existing template
      await updateTemplate(editingTemplate.id, templateData);
    } else {
      // Creating new template (either from scratch or copy of default)
      await createTemplate(templateData);
    }
    setShowTemplateEditor(false);
    setEditingTemplate(undefined);
  };

  const handleCreateSnippet = () => {
    setEditingSnippet(undefined);
    setShowSnippetEditor(true);
  };

  const handleEditSnippet = () => {
    if (selectedSnippet) {
      if (selectedSnippet.isDefault) {
        // Create a copy of the default snippet for editing
        const copy: Snippet = {
          ...selectedSnippet,
          id: '', // Will be assigned by createSnippet
          name: `${selectedSnippet.name} (Copy)`,
          isDefault: false,
          createdAt: '',
          updatedAt: '',
        };
        setEditingSnippet(copy);
      } else {
        setEditingSnippet(selectedSnippet);
      }
      setShowSnippetEditor(true);
    }
  };

  const handleSaveSnippet = async (snippetData: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingSnippet && editingSnippet.id) {
      // Editing existing snippet
      await updateSnippet(editingSnippet.id, snippetData);
    } else {
      // Creating new snippet (either from scratch or copy of default)
      await createSnippet(snippetData);
    }
    setShowSnippetEditor(false);
    setEditingSnippet(undefined);
  };

  // Import/Export handlers
  const handleExport = async () => {
    if (activeTab === 'templates') {
      await exportTemplates();
    } else {
      await exportSnippets();
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus('Importing...');
    try {
      const result = activeTab === 'templates'
        ? await importTemplates(file)
        : await importSnippets(file);

      if (result.success) {
        setImportStatus(`Imported ${result.imported} ${activeTab}`);
        setTimeout(() => setImportStatus(null), 3000);
      } else {
        setImportStatus(`Import failed: ${result.error}`);
        setTimeout(() => setImportStatus(null), 5000);
      }
    } catch (err: any) {
      setImportStatus(`Import error: ${err.message}`);
      setTimeout(() => setImportStatus(null), 5000);
    }

    // Reset file input
    e.target.value = '';
  };

  const handleReset = async () => {
    const type = activeTab === 'templates' ? 'templates' : 'snippets';
    if (confirm(`Reset all ${type} to defaults? This will remove user ${type} and restore built-in ones.`)) {
      if (activeTab === 'templates') {
        await resetTemplates();
        setSelectedTemplate(null);
      } else {
        await resetSnippets();
        setSelectedSnippet(null);
      }
    }
  };

  const renderTemplateContent = (template: Template) => {
    if (template.targetFields === 'all') {
      return (
        <div className="space-y-3">
          {Object.entries(template.content).map(([field, content]) => (
            <div key={field} className="border-l-2 border-blue-500 pl-3">
              <div className="text-xs font-semibold text-blue-400 mb-1">{field}</div>
              <div className="text-sm text-dark-muted whitespace-pre-wrap">{content}</div>
            </div>
          ))}
        </div>
      );
    } else {
      const field = template.targetFields[0];
      const content = template.content[field];
      return (
        <div className="text-sm text-dark-muted whitespace-pre-wrap">{content}</div>
      );
    }
  };

  const panelContent = (
    <div className={embedded ? "h-full flex flex-col" : "bg-dark-surface border border-dark-border rounded-lg shadow-xl w-[90vw] h-[85vh] flex flex-col"}>
      {/* Header */}
      {!embedded && (
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <h2 className="text-xl font-bold">Templates & Snippets</h2>
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      )}

        {/* Tabs */}
        <div className="flex border-b border-dark-border">
          <button
            onClick={() => {
              setActiveTab('templates');
              setSelectedSnippet(null);
              setCategoryFilter('all');
            }}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'templates'
                ? 'bg-dark-bg text-blue-400 border-b-2 border-blue-400'
                : 'text-dark-muted hover:text-dark-text'
            }`}
          >
            Templates
          </button>
          <button
            onClick={() => {
              setActiveTab('snippets');
              setSelectedTemplate(null);
              setCategoryFilter('all');
            }}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'snippets'
                ? 'bg-dark-bg text-blue-400 border-b-2 border-blue-400'
                : 'text-dark-muted hover:text-dark-text'
            }`}
          >
            Snippets
          </button>
          <button
            onClick={() => {
              setActiveTab('elara-voss');
              setSelectedTemplate(null);
              setSelectedSnippet(null);
            }}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'elara-voss'
                ? 'bg-dark-bg text-purple-400 border-b-2 border-purple-400'
                : 'text-dark-muted hover:text-dark-text'
            }`}
          >
            ELARA VOSS
          </button>
        </div>

        {/* Search and Filter - only for templates/snippets tabs */}
        {activeTab !== 'elara-voss' && (
        <div className="p-4 border-b border-dark-border flex flex-col gap-3">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="px-3 py-2 bg-dark-bg border border-dark-border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {activeTab === 'templates' ? (
                <>
                  <option value="character">Character</option>
                  <option value="scenario">Scenario</option>
                  <option value="dialogue">Dialogue</option>
                  <option value="custom">Custom</option>
                </>
              ) : (
                <>
                  <option value="jed">JED Format</option>
                  <option value="instruction">Instruction</option>
                  <option value="format">Format</option>
                  <option value="custom">Custom</option>
                </>
              )}
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={activeTab === 'templates' ? handleCreateTemplate : handleCreateSnippet}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors whitespace-nowrap"
            >
              + Create
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              Export
            </button>
            <button
              onClick={() => activeTab === 'templates' ? templateImportRef.current?.click() : snippetImportRef.current?.click()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              Import
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors whitespace-nowrap"
            >
              Reset
            </button>
            {importStatus && (
              <span className={`ml-2 text-sm ${importStatus.includes('failed') || importStatus.includes('error') ? 'text-red-400' : 'text-green-400'}`}>
                {importStatus}
              </span>
            )}
            {/* Hidden file inputs */}
            <input
              type="file"
              ref={templateImportRef}
              onChange={handleImportFile}
              accept=".json"
              className="hidden"
            />
            <input
              type="file"
              ref={snippetImportRef}
              onChange={handleImportFile}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>
        )}

        {/* Content Area - Templates/Snippets only */}
        {activeTab !== 'elara-voss' && (
        <div className="flex-1 flex min-h-0">
          {/* List */}
          <div className="w-1/3 border-r border-dark-border overflow-y-auto">
            {activeTab === 'templates' ? (
              <div className="divide-y divide-dark-border">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className={`w-full text-left p-4 hover:bg-dark-bg transition-colors ${
                      selectedTemplate?.id === template.id ? 'bg-dark-bg border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="font-semibold mb-1">{template.name}</div>
                    <div className="text-sm text-dark-muted mb-2">{template.description}</div>
                    <div className="flex gap-2">
                      <span className="text-xs px-2 py-0.5 bg-blue-600/20 text-blue-300 rounded">
                        {template.category}
                      </span>
                      {template.isDefault && (
                        <span className="text-xs px-2 py-0.5 bg-green-600/20 text-green-300 rounded">
                          default
                        </span>
                      )}
                    </div>
                  </button>
                ))}
                {filteredTemplates.length === 0 && (
                  <div className="p-4 text-center text-dark-muted">No templates found</div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-dark-border">
                {filteredSnippets.map((snippet) => (
                  <button
                    key={snippet.id}
                    onClick={() => setSelectedSnippet(snippet)}
                    className={`w-full text-left p-4 hover:bg-dark-bg transition-colors ${
                      selectedSnippet?.id === snippet.id ? 'bg-dark-bg border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="font-semibold mb-1">{snippet.name}</div>
                    <div className="text-sm text-dark-muted mb-2">{snippet.description}</div>
                    <div className="flex gap-2">
                      <span className="text-xs px-2 py-0.5 bg-purple-600/20 text-purple-300 rounded">
                        {snippet.category}
                      </span>
                      {snippet.isDefault && (
                        <span className="text-xs px-2 py-0.5 bg-green-600/20 text-green-300 rounded">
                          default
                        </span>
                      )}
                    </div>
                  </button>
                ))}
                {filteredSnippets.length === 0 && (
                  <div className="p-4 text-center text-dark-muted">No snippets found</div>
                )}
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'templates' && selectedTemplate ? (
              <div>
                <h3 className="text-lg font-bold mb-2">{selectedTemplate.name}</h3>
                <p className="text-dark-muted mb-4">{selectedTemplate.description}</p>
                <div className="mb-4">
                  <span className="text-sm font-semibold text-dark-muted">Target: </span>
                  <span className="text-sm">
                    {selectedTemplate.targetFields === 'all'
                      ? 'All fields'
                      : selectedTemplate.targetFields.join(', ')}
                  </span>
                </div>
                <div className="bg-dark-bg border border-dark-border rounded p-4 mb-4">
                  {renderTemplateContent(selectedTemplate)}
                </div>

                {!manageMode && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApplyTemplate('replace')}
                      className="btn-primary"
                    >
                      Replace
                    </button>
                    <button
                      onClick={() => handleApplyTemplate('append')}
                      className="btn-secondary"
                    >
                      Append
                    </button>
                    <button
                      onClick={() => handleApplyTemplate('prepend')}
                      className="btn-secondary"
                    >
                      Prepend
                    </button>
                  </div>
                )}

                {manageMode && (
                  <div className="flex gap-2">
                    <button onClick={handleEditTemplate} className="btn-primary">
                      {selectedTemplate?.isDefault ? 'Copy & Edit' : 'Edit'}
                    </button>
                    <button onClick={handleDelete} className="btn-secondary">
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ) : activeTab === 'snippets' && selectedSnippet ? (
              <div>
                <h3 className="text-lg font-bold mb-2">{selectedSnippet.name}</h3>
                <p className="text-dark-muted mb-4">{selectedSnippet.description}</p>
                <div className="bg-dark-bg border border-dark-border rounded p-4 mb-4 font-mono text-sm">
                  {selectedSnippet.content}
                </div>

                {!manageMode && (
                  <button
                    onClick={handleInsertSnippet}
                    className="btn-primary"
                  >
                    Insert
                  </button>
                )}

                {manageMode && (
                  <div className="flex gap-2">
                    <button onClick={handleEditSnippet} className="btn-primary">
                      {selectedSnippet?.isDefault ? 'Copy & Edit' : 'Edit'}
                    </button>
                    <button onClick={handleDelete} className="btn-secondary">
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-dark-muted">
                Select a {activeTab === 'templates' ? 'template' : 'snippet'} to preview
              </div>
            )}
          </div>
        </div>
        )}

        {/* ELARA VOSS Content */}
        {activeTab === 'elara-voss' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-6">
              <div>
                <h3 className="text-lg font-bold mb-2">ELARA VOSS Name Database</h3>
                <p className="text-dark-muted">
                  Manage the name database used by the ELARA VOSS name replacement tool.
                  Import custom names or reset to defaults.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 items-center flex-wrap">
                <button
                  onClick={() => elaraVossImportRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Import Names
                </button>
                <button
                  onClick={handleElaraVossExport}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Export Names
                </button>
                <button
                  onClick={handleElaraVossReset}
                  className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
                >
                  Reset to Defaults
                </button>
                {elaraVossStatus && (
                  <span className={`ml-2 text-sm ${elaraVossStatus.includes('failed') || elaraVossStatus.includes('error') ? 'text-red-400' : 'text-green-400'}`}>
                    {elaraVossStatus}
                  </span>
                )}
                <input
                  type="file"
                  ref={elaraVossImportRef}
                  onChange={handleElaraVossImport}
                  accept=".json"
                  className="hidden"
                />
              </div>

              {/* Stats */}
              {elaraVossLoading ? (
                <div className="text-center py-8 text-dark-muted">Loading...</div>
              ) : elaraVossStats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-dark-bg border border-dark-border rounded p-4 text-center">
                    <div className="text-3xl font-bold text-purple-400">{elaraVossStats.total}</div>
                    <div className="text-sm text-dark-muted">Total Names</div>
                  </div>
                  <div className="bg-dark-bg border border-dark-border rounded p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400">{elaraVossStats.male.first}</div>
                    <div className="text-sm text-dark-muted">Male First</div>
                  </div>
                  <div className="bg-dark-bg border border-dark-border rounded p-4 text-center">
                    <div className="text-2xl font-bold text-pink-400">{elaraVossStats.female.first}</div>
                    <div className="text-sm text-dark-muted">Female First</div>
                  </div>
                  <div className="bg-dark-bg border border-dark-border rounded p-4 text-center">
                    <div className="text-2xl font-bold text-gray-400">{elaraVossStats.neutral.last}</div>
                    <div className="text-sm text-dark-muted">Last Names</div>
                  </div>
                </div>
              ) : null}

              {/* Format Documentation */}
              <div className="bg-dark-bg border border-dark-border rounded p-4">
                <h4 className="font-semibold mb-2">JSON File Format</h4>
                <p className="text-sm text-dark-muted mb-3">
                  Import a JSON file containing an array of name objects with the following structure:
                </p>
                <pre className="bg-dark-surface p-3 rounded text-xs overflow-x-auto">
{`[
  { "gender": "male", "type": "first", "name": "Ace" },
  { "gender": "female", "type": "first", "name": "Nova" },
  { "gender": "neutral", "type": "last", "name": "Vega" }
]`}
                </pre>
                <div className="mt-3 space-y-1 text-xs text-dark-muted">
                  <p><strong>gender:</strong> "male" | "female" | "neutral"</p>
                  <p><strong>type:</strong> "first" | "last"</p>
                  <p><strong>name:</strong> The actual name string</p>
                </div>
                <p className="mt-3 text-xs text-amber-400">
                  Note: "neutral" gender names with type "last" are used as surnames for all genders.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
  );

  if (embedded) {
    return (
      <>
        {panelContent}
        <TemplateEditor
          isOpen={showTemplateEditor}
          onClose={() => {
            setShowTemplateEditor(false);
            setEditingTemplate(undefined);
          }}
          onSave={handleSaveTemplate}
          template={editingTemplate}
        />
        <SnippetEditor
          isOpen={showSnippetEditor}
          onClose={() => {
            setShowSnippetEditor(false);
            setEditingSnippet(undefined);
          }}
          onSave={handleSaveSnippet}
          snippet={editingSnippet}
        />
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        {panelContent}
      </div>
      <TemplateEditor
        isOpen={showTemplateEditor}
        onClose={() => {
          setShowTemplateEditor(false);
          setEditingTemplate(undefined);
        }}
        onSave={handleSaveTemplate}
        template={editingTemplate}
      />
      <SnippetEditor
        isOpen={showSnippetEditor}
        onClose={() => {
          setShowSnippetEditor(false);
          setEditingSnippet(undefined);
        }}
        onSave={handleSaveSnippet}
        snippet={editingSnippet}
      />
    </>
  );
}
