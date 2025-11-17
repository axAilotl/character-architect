import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCardStore, extractCardData } from '../store/card-store';
import type { CCv2Data, CCv3Data, Template, Snippet, CCFieldName } from '@card-architect/schemas';
import { MilkdownProvider } from '@milkdown/react';
import { Crepe } from '@milkdown/crepe';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame-dark.css';
import { editorViewCtx, parserCtx } from '@milkdown/kit/core';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { Slice } from '@milkdown/kit/prose/model';
import { Selection } from '@milkdown/kit/prose/state';
import { eclipse } from '@uiw/codemirror-theme-eclipse';
import throttle from 'lodash.throttle';
import CodeMirror from '@uiw/react-codemirror';
import { markdown as codemirrorMarkdown } from '@codemirror/lang-markdown';
import { githubDark } from '@uiw/codemirror-theme-github';
import { EditorView } from '@codemirror/view';
import { TemplateSnippetPanel } from './TemplateSnippetPanel';
import { LLMAssistSidebar } from './LLMAssistSidebar';

const focusableFields = [
  { id: 'description', label: 'Description' },
  { id: 'personality', label: 'Personality' },
  { id: 'scenario', label: 'Scenario' },
  { id: 'first_mes', label: 'First Message' },
  { id: 'mes_example', label: 'Example Dialogue' },
  { id: 'system_prompt', label: 'System Prompt' },
  { id: 'post_history_instructions', label: 'Post History' },
  { id: 'creator_notes', label: 'Creator Notes' },
  { id: 'alternate_greetings', label: 'Alt Greetings' },
] as const;

type FocusField = (typeof focusableFields)[number]['id'];

interface CrepeEditorProps {
  value: string;
  editorKey: number;
  onChange: (markdown: string) => void;
  onReady: (instance: Crepe | null) => void;
}

// Programmatic update function from playground - preserves cursor position
function updateCrepeContent(crepe: Crepe, markdown: string) {
  if (crepe.getMarkdown() === markdown) return;

  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const parser = ctx.get(parserCtx);
    const doc = parser(markdown);
    if (!doc) return;

    const state = view.state;
    const selection = state.selection;
    const { from } = selection;

    let tr = state.tr;
    tr = tr.replace(
      0,
      state.doc.content.size,
      new Slice(doc.content, 0, 0)
    );

    const docSize = doc.content.size;
    const safeFrom = Math.min(from, docSize - 2);
    tr = tr.setSelection(Selection.near(tr.doc.resolve(safeFrom)));
    view.dispatch(tr);
  });
}

function CrepeMarkdownEditor({ value, editorKey, onChange, onReady }: CrepeEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const crepeInstanceRef = useRef<Crepe | null>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || loadingRef.current) return;

    loadingRef.current = true;

    // Clear the container before creating a new editor
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    // Crepe configuration with proper features enabled - playground pattern
    const crepe = new Crepe({
      root: containerRef.current,
      defaultValue: value || '',
      featureConfigs: {
        [Crepe.Feature.CodeMirror]: {
          theme: eclipse, // Light theme for code blocks (can switch based on dark mode later)
        },
        [Crepe.Feature.Placeholder]: {
          text: 'Type your markdown here...',
        },
      },
    });

    // Use listener plugin approach with throttling (playground pattern)
    crepe.editor
      .config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated(
          throttle((_, markdown) => {
            onChange(markdown);
          }, 200)
        );
      })
      .use(listener);

    crepe.create().then(() => {
      crepeInstanceRef.current = crepe;
      loadingRef.current = false;
      onReady(crepe);
    }).catch((error) => {
      console.error('Failed to create Crepe editor:', error);
      loadingRef.current = false;
    });

    return () => {
      if (loadingRef.current) return;
      if (crepeInstanceRef.current) {
        try {
          crepeInstanceRef.current.destroy();
        } catch (error) {
          console.error('Error destroying Crepe editor:', error);
        }
        crepeInstanceRef.current = null;
      }
      onReady(null);
    };
  }, [editorKey]);

  return <div ref={containerRef} className="h-full w-full" />;
}

type FocusType = 'wysiwyg' | 'raw' | null;

function FocusedEditorInner() {
  const { currentCard, updateCardData } = useCardStore();
  const [selectedField, setSelectedField] = useState<FocusField>('description');
  const [drafts, setDrafts] = useState<Record<FocusField, string>>({
    description: '',
    personality: '',
    scenario: '',
    first_mes: '',
    mes_example: '',
    system_prompt: '',
    post_history_instructions: '',
    creator_notes: '',
    alternate_greetings: '',
  });
  const [alternateGreetingIndex, setAlternateGreetingIndex] = useState(0);
  const [editorKey, setEditorKey] = useState(0);
  const [showRawPanel, setShowRawPanel] = useState(false);
  const [editorFocus, setEditorFocus] = useState<FocusType>(null);
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [llmAssistOpen, setLLMAssistOpen] = useState(false);
  const crepeRef = useRef<Crepe | null>(null);
  const rawMarkdownRef = useRef<string>('');
  const prevFieldRef = useRef<FocusField | null>(null);

  const isV3 = currentCard?.meta.spec === 'v3';
  const cardData = useMemo(() => {
    if (!currentCard) return null;
    return extractCardData(currentCard);
  }, [currentCard]);

  const getFieldValue = useCallback(
    (field: FocusField) => {
      if (!cardData) return '';

      // Handle alternate_greetings specially - get the selected greeting
      if (field === 'alternate_greetings') {
        const greetings = cardData.alternate_greetings;
        if (Array.isArray(greetings) && greetings.length > 0) {
          return greetings[alternateGreetingIndex] || '';
        }
        return '';
      }

      const raw = (cardData as Record<string, unknown>)[field];
      return typeof raw === 'string' ? raw : '';
    },
    [cardData, alternateGreetingIndex]
  );

  useEffect(() => {
    if (!currentCard) return;
    const next: Record<FocusField, string> = {
      description: getFieldValue('description'),
      personality: getFieldValue('personality'),
      scenario: getFieldValue('scenario'),
      first_mes: getFieldValue('first_mes'),
      mes_example: getFieldValue('mes_example'),
      system_prompt: getFieldValue('system_prompt'),
      post_history_instructions: getFieldValue('post_history_instructions'),
      creator_notes: getFieldValue('creator_notes'),
      alternate_greetings: getFieldValue('alternate_greetings'),
    };
    setDrafts(next);
    setSelectedField((prev) => prev ?? 'description');
    // Only recreate editor when card changes, not on field changes
    setEditorKey((key) => key + 1);
  }, [currentCard?.meta.id, currentCard?.meta.spec, getFieldValue]);

  // Use programmatic update when switching fields instead of destroying editor
  useEffect(() => {
    // Update editor when field or alternate greeting index changes
    const shouldUpdate = prevFieldRef.current !== selectedField || selectedField === 'alternate_greetings';

    if (!shouldUpdate && selectedField !== 'alternate_greetings') {
      return;
    }
    prevFieldRef.current = selectedField;

    // Get value from drafts, fallback to card data if not in drafts yet
    const draftValue = drafts[selectedField];
    const cardValue = getFieldValue(selectedField);
    const value = draftValue !== undefined ? draftValue : cardValue;

    if (crepeRef.current) {
      updateCrepeContent(crepeRef.current, value);
    }
    // Also sync to raw markdown ref
    rawMarkdownRef.current = value;
  }, [selectedField, alternateGreetingIndex, drafts, getFieldValue]);

  if (!currentCard || !cardData) {
    return (
      <div className="p-6 text-center text-dark-muted">
        Load a card to use Focused Mode.
      </div>
    );
  }

  const currentValue = drafts[selectedField] ?? '';

  const normalizeDraft = (value: string) => value.replace(/^(\s*)\\\[/gm, '$1[');

  // Create refs to always access current values without recreating callbacks
  const selectedFieldRef = useRef(selectedField);
  useEffect(() => {
    selectedFieldRef.current = selectedField;
  }, [selectedField]);

  // Handle WYSIWYG editor changes - sync to raw editor if it doesn't have focus
  const handleDraftChange = useCallback(
    (value: string) => {
      const normalized = normalizeDraft(value);
      const currentField = selectedFieldRef.current;
      setDrafts((prev) => ({ ...prev, [currentField]: normalized }));

      // Sync to raw markdown if it doesn't have focus
      if (editorFocus !== 'raw') {
        rawMarkdownRef.current = normalized;
      }
    },
    [editorFocus]
  );

  // Handle raw markdown editor changes - sync to WYSIWYG if it doesn't have focus
  const handleRawMarkdownChange = useCallback(
    (value: string) => {
      const normalized = normalizeDraft(value);
      const currentField = selectedFieldRef.current;
      rawMarkdownRef.current = normalized;
      setDrafts((prev) => ({ ...prev, [currentField]: normalized }));

      // Sync to Crepe editor if it doesn't have focus
      if (editorFocus !== 'wysiwyg' && crepeRef.current) {
        updateCrepeContent(crepeRef.current, normalized);
      }
    },
    [editorFocus]
  );

  const applyChanges = () => {
    const value = drafts[selectedField] ?? '';

    // Handle alternate_greetings specially
    if (selectedField === 'alternate_greetings') {
      const greetings = [...(cardData?.alternate_greetings || [])];

      // Update the current greeting or add it if it doesn't exist
      if (alternateGreetingIndex < greetings.length) {
        greetings[alternateGreetingIndex] = value;
      } else {
        greetings.push(value);
      }

      if (isV3) {
        updateCardData({
          data: {
            ...(currentCard.data as CCv3Data).data,
            alternate_greetings: greetings,
          },
        } as Partial<CCv3Data>);
      } else {
        updateCardData({ alternate_greetings: greetings } as Partial<CCv2Data>);
      }
    } else {
      if (isV3) {
        updateCardData({
          data: {
            ...(currentCard.data as CCv3Data).data,
            [selectedField]: value,
          },
        } as Partial<CCv3Data>);
      } else {
        updateCardData({ [selectedField]: value } as Partial<CCv2Data>);
      }
    }
  };

  const resetCurrentField = () => {
    const baseValue = getFieldValue(selectedField);
    setDrafts((prev) => ({ ...prev, [selectedField]: baseValue }));
    // Use programmatic update instead of recreating editor
    if (crepeRef.current) {
      updateCrepeContent(crepeRef.current, baseValue);
    }
    // Also sync to raw markdown
    rawMarkdownRef.current = baseValue;
  };

  const handleAddAlternateGreeting = () => {
    const greetings = [...(cardData?.alternate_greetings || [])];
    greetings.push('');

    if (isV3) {
      updateCardData({
        data: {
          ...(currentCard.data as CCv3Data).data,
          alternate_greetings: greetings,
        },
      } as Partial<CCv3Data>);
    } else {
      updateCardData({ alternate_greetings: greetings } as Partial<CCv2Data>);
    }

    // Select the new greeting
    setAlternateGreetingIndex(greetings.length - 1);
  };

  const handleDeleteAlternateGreeting = () => {
    if (!confirm('Delete this alternate greeting?')) return;

    const greetings = [...(cardData?.alternate_greetings || [])];
    greetings.splice(alternateGreetingIndex, 1);

    if (isV3) {
      updateCardData({
        data: {
          ...(currentCard.data as CCv3Data).data,
          alternate_greetings: greetings,
        },
      } as Partial<CCv3Data>);
    } else {
      updateCardData({ alternate_greetings: greetings } as Partial<CCv2Data>);
    }

    // Adjust selected index if needed
    if (alternateGreetingIndex >= greetings.length && greetings.length > 0) {
      setAlternateGreetingIndex(greetings.length - 1);
    } else if (greetings.length === 0) {
      setAlternateGreetingIndex(0);
    }
  };

  const handleApplyTemplate = (template: Template, mode: 'replace' | 'append' | 'prepend') => {
    if (template.targetFields === 'all') {
      // Apply to all fields - show confirmation
      if (!confirm(`This will ${mode} content in all fields. Continue?`)) {
        return;
      }

      const newDrafts: Record<FocusField, string> = { ...drafts };
      Object.entries(template.content).forEach(([field, content]) => {
        const focusField = field as FocusField;
        const currentValue = newDrafts[focusField] ?? '';

        if (mode === 'replace') {
          newDrafts[focusField] = content ?? '';
        } else if (mode === 'append') {
          newDrafts[focusField] = currentValue + '\n\n' + (content ?? '');
        } else if (mode === 'prepend') {
          newDrafts[focusField] = (content ?? '') + '\n\n' + currentValue;
        }
      });

      setDrafts(newDrafts);

      // Update current field's editor
      const updatedValue = newDrafts[selectedField];
      if (crepeRef.current) {
        updateCrepeContent(crepeRef.current, updatedValue);
      }
      rawMarkdownRef.current = updatedValue;
    } else {
      // Apply to current field only
      const content = template.content[selectedField];
      if (!content) {
        alert(`This template does not have content for the ${selectedField} field.`);
        return;
      }

      const currentValue = drafts[selectedField] ?? '';
      let newValue = '';

      if (mode === 'replace') {
        newValue = content;
      } else if (mode === 'append') {
        newValue = currentValue + '\n\n' + content;
      } else if (mode === 'prepend') {
        newValue = content + '\n\n' + currentValue;
      }

      setDrafts((prev) => ({ ...prev, [selectedField]: newValue }));

      if (crepeRef.current) {
        updateCrepeContent(crepeRef.current, newValue);
      }
      rawMarkdownRef.current = newValue;
    }
  };

  const handleInsertSnippet = (snippet: Snippet) => {
    const currentValue = drafts[selectedField] ?? '';
    // Simple append for now - could be enhanced to insert at cursor position
    const newValue = currentValue + snippet.content;

    setDrafts((prev) => ({ ...prev, [selectedField]: newValue }));

    if (crepeRef.current) {
      updateCrepeContent(crepeRef.current, newValue);
    }
    rawMarkdownRef.current = newValue;
  };

  const handleLLMApply = (value: string, action: 'replace' | 'append' | 'insert') => {
    const currentValue = drafts[selectedField] ?? '';
    let newValue = '';

    if (action === 'replace') {
      newValue = value;
    } else if (action === 'append') {
      newValue = currentValue + '\n\n' + value;
    } else {
      // insert - same as append for now
      newValue = currentValue + '\n\n' + value;
    }

    setDrafts((prev) => ({ ...prev, [selectedField]: newValue }));

    if (crepeRef.current) {
      updateCrepeContent(crepeRef.current, newValue);
    }
    rawMarkdownRef.current = newValue;
  };

  const renderWysiwyg = (suffix = '') => (
    <div className="flex-1 bg-slate-900/60 border border-dark-border rounded-lg p-3 overflow-auto">
      <CrepeMarkdownEditor
        key={`${editorKey}-${suffix}`}
        value={currentValue}
        editorKey={editorKey}
        onChange={handleDraftChange}
        onReady={(instance) => {
          crepeRef.current = instance;
          rawMarkdownRef.current = currentValue;
        }}
      />
    </div>
  );

  // Render collapsible control panel with CodeMirror (playground pattern)
  const renderControlPanel = () => {
    if (!showRawPanel) {
      return (
        <div className="absolute top-[10px] right-6 flex flex-col gap-2 z-10">
          <button
            onClick={() => setShowRawPanel(true)}
            className="flex h-12 w-12 items-center justify-center rounded-sm bg-dark-surface/90 border border-dark-border hover:bg-dark-bg transition-colors"
            title="Show raw markdown"
          >
            <span className="text-2xl">‹</span>
          </button>
        </div>
      );
    }

    return (
      <div className="flex-shrink-0 w-1/2 flex flex-col border-l border-dark-border bg-dark-surface">
        {/* Control Panel Header */}
        <div className="flex h-10 items-center justify-between border-b border-dark-border bg-dark-bg px-4 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRawPanel(false)}
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-dark-surface transition-colors"
              title="Hide raw markdown"
            >
              <span className="text-base">›</span>
            </button>
            <span className="text-sm font-medium">Raw Markdown</span>
          </div>
        </div>

        {/* CodeMirror Editor */}
        <div
          className="flex-1 overflow-auto"
          onFocus={() => setEditorFocus('raw')}
          onBlur={() => setEditorFocus(null)}
        >
          <CodeMirror
            value={rawMarkdownRef.current}
            height="100%"
            theme={githubDark}
            extensions={[codemirrorMarkdown(), EditorView.lineWrapping]}
            onChange={handleRawMarkdownChange}
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              foldGutter: true,
            }}
            style={{ fontSize: '15px' }}
          />
        </div>
      </div>
    );
  };

  const alternateGreetings = cardData?.alternate_greetings || [];
  const hasAlternateGreetings = alternateGreetings.length > 0;

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* Field Selector Header */}
      <div className="bg-dark-surface border-b border-dark-border px-6 py-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-dark-muted mr-2">Field:</span>
            {focusableFields.map((field) => (
              <button
                key={field.id}
                onClick={() => {
                  setSelectedField(field.id);
                  if (field.id === 'alternate_greetings' && alternateGreetingIndex >= alternateGreetings.length) {
                    setAlternateGreetingIndex(Math.max(0, alternateGreetings.length - 1));
                  }
                }}
                className={`px-4 py-2 rounded transition-colors text-sm font-medium ${
                  selectedField === field.id
                    ? 'bg-blue-600 text-white border border-blue-400'
                    : 'bg-dark-bg text-dark-text border border-dark-border hover:bg-dark-surface'
                }`}
              >
                {field.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLLMAssistOpen(true)}
              className="px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm"
              title="AI Assist"
            >
              ✨ AI
            </button>
            <button
              onClick={() => setShowTemplatePanel(true)}
              className="btn-secondary"
              title="Templates & Snippets"
            >
              Templates
            </button>
            <button onClick={resetCurrentField} className="btn-secondary">
              Reset
            </button>
            <button onClick={applyChanges} className="btn-primary">
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* Alternate Greetings Controls */}
      {selectedField === 'alternate_greetings' && (
        <div className="bg-dark-surface border-b border-dark-border px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-dark-muted">Greeting:</span>
            {hasAlternateGreetings ? (
              <select
                value={alternateGreetingIndex}
                onChange={(e) => setAlternateGreetingIndex(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 bg-dark-bg border border-dark-border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                {alternateGreetings.map((_, idx) => (
                  <option key={idx} value={idx}>
                    Greeting {idx + 1}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-dark-muted">No alternate greetings yet</span>
            )}
            <button
              onClick={handleAddAlternateGreeting}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
            >
              + Add
            </button>
            {hasAlternateGreetings && (
              <button
                onClick={handleDeleteAlternateGreeting}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col p-6 space-y-4">
        {/* Editor Container with relative positioning for chevron */}
        <div className="flex-1 flex gap-4 min-h-0 relative">
          <div
            className="flex-1 flex"
            onFocus={() => setEditorFocus('wysiwyg')}
            onBlur={() => setEditorFocus(null)}
          >
            {renderWysiwyg('single')}
          </div>

          {/* Collapsible Control Panel */}
          {renderControlPanel()}
        </div>

        <div className="text-xs text-dark-muted">
          <span className="font-semibold">Tip:</span> WYSIWYG editor - Press Shift+Enter for line breaks, Enter for paragraph breaks. Use the ‹ button to toggle raw markdown view.
        </div>
      </div>

      {/* Template & Snippet Panel */}
      <TemplateSnippetPanel
        isOpen={showTemplatePanel}
        onClose={() => setShowTemplatePanel(false)}
        onApplyTemplate={handleApplyTemplate}
        onInsertSnippet={handleInsertSnippet}
        currentField={selectedField}
      />

      {/* LLM Assist Sidebar */}
      {llmAssistOpen && (
        <LLMAssistSidebar
          isOpen={llmAssistOpen}
          onClose={() => setLLMAssistOpen(false)}
          fieldName={selectedField as CCFieldName}
          currentValue={currentValue}
          onApply={handleLLMApply}
          cardSpec={currentCard?.meta.spec || 'v3'}
          panelWidth="420px"
          panelRight="24px"
        />
      )}
    </div>
  );
}

export function FocusedEditor() {
  return (
    <MilkdownProvider>
      <FocusedEditorInner />
    </MilkdownProvider>
  );
}
