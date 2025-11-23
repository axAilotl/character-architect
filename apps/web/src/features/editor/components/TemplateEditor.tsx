import { useState, useEffect } from 'react';
import type { Template, TemplateCategory, FocusField } from '@card-architect/schemas';

interface TemplateEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>) => void;
  template?: Template; // If provided, we're editing; otherwise creating
}

const focusFields: { id: FocusField; label: string }[] = [
  { id: 'description', label: 'Description' },
  { id: 'personality', label: 'Personality' },
  { id: 'scenario', label: 'Scenario' },
  { id: 'first_mes', label: 'First Message' },
  { id: 'mes_example', label: 'Example Dialogue' },
];

export function TemplateEditor({ isOpen, onClose, onSave, template }: TemplateEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('custom');
  const [targetFields, setTargetFields] = useState<FocusField[] | 'all'>([]);
  const [content, setContent] = useState<Partial<Record<FocusField, string>>>({});

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description);
      setCategory(template.category);
      setTargetFields(template.targetFields);
      setContent(template.content);
    } else {
      // Reset for new template
      setName('');
      setDescription('');
      setCategory('custom');
      setTargetFields([]);
      setContent({});
    }
  }, [template, isOpen]);

  if (!isOpen) return null;

  const handleTargetFieldToggle = (field: FocusField) => {
    if (targetFields === 'all') {
      // Switch from 'all' to specific fields
      setTargetFields([field]);
    } else {
      if (targetFields.includes(field)) {
        setTargetFields(targetFields.filter((f) => f !== field));
      } else {
        setTargetFields([...targetFields, field]);
      }
    }
  };

  const handleTargetAllToggle = () => {
    if (targetFields === 'all') {
      setTargetFields([]);
    } else {
      setTargetFields('all');
      // Pre-fill all fields with current content if switching to 'all'
      const newContent: Partial<Record<FocusField, string>> = {};
      focusFields.forEach((f) => {
        newContent[f.id] = content[f.id] || '';
      });
      setContent(newContent);
    }
  };

  const handleContentChange = (field: FocusField, value: string) => {
    setContent((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter a template name');
      return;
    }

    if (targetFields !== 'all' && targetFields.length === 0) {
      alert('Please select at least one target field or "All Fields"');
      return;
    }

    // Validate that we have content for selected fields
    const fieldsToCheck = targetFields === 'all' ? focusFields.map((f) => f.id) : targetFields;
    const missingContent = fieldsToCheck.filter((field) => !content[field]?.trim());

    if (missingContent.length > 0) {
      alert(`Please provide content for: ${missingContent.join(', ')}`);
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      category,
      targetFields,
      content,
    });

    onClose();
  };

  const activeFields = targetFields === 'all' ? focusFields.map((f) => f.id) : targetFields;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-dark-surface border border-dark-border rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <h2 className="text-xl font-bold">{template ? 'Edit Template' : 'Create Template'}</h2>
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Template Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., My Custom Template"
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="custom">Custom</option>
                <option value="character">Character</option>
                <option value="scenario">Scenario</option>
                <option value="dialogue">Dialogue</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this template"
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Target Fields */}
          <div>
            <label className="block text-sm font-medium mb-2">Target Fields *</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={targetFields === 'all'}
                  onChange={handleTargetAllToggle}
                  className="rounded"
                />
                <span>All Fields (full card template)</span>
              </label>

              {targetFields !== 'all' && (
                <div className="ml-6 space-y-1">
                  {focusFields.map((field) => (
                    <label key={field.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={targetFields.includes(field.id)}
                        onChange={() => handleTargetFieldToggle(field.id)}
                        className="rounded"
                      />
                      <span>{field.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Content Fields */}
          <div>
            <label className="block text-sm font-medium mb-2">Template Content *</label>
            <div className="space-y-4">
              {activeFields.map((field) => {
                const fieldLabel = focusFields.find((f) => f.id === field)?.label || field;
                return (
                  <div key={field} className="border border-dark-border rounded p-3">
                    <label className="block text-sm font-semibold text-blue-400 mb-2">
                      {fieldLabel}
                    </label>
                    <textarea
                      value={content[field] || ''}
                      onChange={(e) => handleContentChange(field, e.target.value)}
                      rows={6}
                      placeholder={`Enter template content for ${fieldLabel.toLowerCase()}...`}
                      className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-border flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary">
            {template ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
