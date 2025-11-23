import { useState, useEffect } from 'react';
import type { Snippet, SnippetCategory } from '@card-architect/schemas';

interface SnippetEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>) => void;
  snippet?: Snippet; // If provided, we're editing; otherwise creating
}

export function SnippetEditor({ isOpen, onClose, onSave, snippet }: SnippetEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<SnippetCategory>('custom');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (snippet) {
      setName(snippet.name);
      setDescription(snippet.description);
      setCategory(snippet.category);
      setContent(snippet.content);
    } else {
      // Reset for new snippet
      setName('');
      setDescription('');
      setCategory('custom');
      setContent('');
    }
  }, [snippet, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter a snippet name');
      return;
    }

    if (!content.trim()) {
      alert('Please enter snippet content');
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      category,
      content,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-dark-surface border border-dark-border rounded-lg shadow-xl w-[800px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <h2 className="text-xl font-bold">{snippet ? 'Edit Snippet' : 'Create Snippet'}</h2>
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Snippet Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Common Instruction"
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SnippetCategory)}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="custom">Custom</option>
                <option value="instruction">Instruction</option>
                <option value="format">Format</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this snippet"
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium mb-2">Snippet Content *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              placeholder="Enter the text you want to insert as a snippet..."
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <p className="text-xs text-dark-muted mt-1">
              This content will be inserted when you use this snippet
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-border flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary">
            {snippet ? 'Save Changes' : 'Create Snippet'}
          </button>
        </div>
      </div>
    </div>
  );
}
