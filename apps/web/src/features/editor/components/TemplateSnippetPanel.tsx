import { useState } from 'react';
import { useTemplateStore } from '../../../store/template-store';
import type { Template, Snippet, TemplateCategory, SnippetCategory, FocusField } from '@card-architect/schemas';
import { TemplateEditor } from './TemplateEditor';
import { SnippetEditor } from './SnippetEditor';

interface TemplateSnippetPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate?: (template: Template, mode: 'replace' | 'append' | 'prepend') => void;
  onInsertSnippet?: (snippet: Snippet) => void;
  currentField?: FocusField;
  manageMode?: boolean; // If true, shows full CRUD interface
  embedded?: boolean; // If true, doesn't render as modal (for embedding in settings)
}

type Tab = 'templates' | 'snippets';

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

  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | undefined>(undefined);
  const [showSnippetEditor, setShowSnippetEditor] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | undefined>(undefined);

  const { templates, snippets, deleteTemplate, deleteSnippet, createTemplate, updateTemplate, createSnippet, updateSnippet } = useTemplateStore();

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

  const handleDelete = () => {
    if (activeTab === 'templates' && selectedTemplate) {
      if (selectedTemplate.isDefault) {
        alert('Cannot delete default templates');
        return;
      }
      if (confirm(`Delete template "${selectedTemplate.name}"?`)) {
        deleteTemplate(selectedTemplate.id);
        setSelectedTemplate(null);
      }
    } else if (activeTab === 'snippets' && selectedSnippet) {
      if (selectedSnippet.isDefault) {
        alert('Cannot delete default snippets');
        return;
      }
      if (confirm(`Delete snippet "${selectedSnippet.name}"?`)) {
        deleteSnippet(selectedSnippet.id);
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

  const handleSaveTemplate = (templateData: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingTemplate && editingTemplate.id) {
      // Editing existing template
      updateTemplate(editingTemplate.id, templateData);
    } else {
      // Creating new template (either from scratch or copy of default)
      createTemplate(templateData);
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

  const handleSaveSnippet = (snippetData: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingSnippet && editingSnippet.id) {
      // Editing existing snippet
      updateSnippet(editingSnippet.id, snippetData);
    } else {
      // Creating new snippet (either from scratch or copy of default)
      createSnippet(snippetData);
    }
    setShowSnippetEditor(false);
    setEditingSnippet(undefined);
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
        </div>

        {/* Search and Filter */}
        <div className="p-4 border-b border-dark-border flex gap-3">
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
                <option value="instruction">Instruction</option>
                <option value="format">Format</option>
                <option value="custom">Custom</option>
              </>
            )}
          </select>
          <button
            onClick={activeTab === 'templates' ? handleCreateTemplate : handleCreateSnippet}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors whitespace-nowrap"
          >
            + Create
          </button>
        </div>

        {/* Content Area */}
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
