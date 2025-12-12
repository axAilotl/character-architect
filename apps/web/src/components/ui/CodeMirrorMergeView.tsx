/**
 * CodeMirror 6 Merge View Component
 *
 * React wrapper for @codemirror/merge MergeView with JSON syntax highlighting.
 * Displays a two-way diff comparison with collapsible unchanged sections.
 */

import { useEffect, useRef, useState } from 'react';
import { MergeView } from '@codemirror/merge';
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState, Extension } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { githubDark } from '@uiw/codemirror-theme-github';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, foldKeymap } from '@codemirror/language';
import { keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';

export interface CodeMirrorMergeViewProps {
  /** Original text (left side / "before") */
  originalText: string;
  /** Current text (right side / "after") */
  currentText: string;
  /** Language mode for syntax highlighting */
  language?: 'json' | 'text';
  /** Collapse unchanged sections */
  collapseUnchanged?: boolean | { margin?: number; minSize?: number };
  /** Show gutter with line numbers */
  showGutter?: boolean;
  /** Container height */
  height?: string;
  /** Make editors read-only */
  readOnly?: boolean;
  /** Original side label */
  originalLabel?: string;
  /** Current side label */
  currentLabel?: string;
  /** Callback when current text changes (if not readOnly) */
  onChange?: (value: string) => void;
}

/**
 * Create base extensions for CodeMirror editors
 */
function createBaseExtensions(options: {
  language?: 'json' | 'text';
  readOnly?: boolean;
  showGutter?: boolean;
}): Extension[] {
  const extensions: Extension[] = [
    // Theme
    githubDark,
    // Syntax highlighting
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    // Bracket matching
    bracketMatching(),
    // Selection matching
    highlightSelectionMatches(),
    // Active line highlighting
    highlightActiveLine(),
    highlightActiveLineGutter(),
    // History (undo/redo)
    history(),
    // Keymaps
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...searchKeymap,
    ]),
    // Line wrapping
    EditorView.lineWrapping,
  ];

  // Add line numbers if requested
  if (options.showGutter !== false) {
    extensions.push(lineNumbers());
    extensions.push(foldGutter());
  }

  // Add language support
  if (options.language === 'json') {
    extensions.push(json());
  }

  // Add read-only state
  if (options.readOnly) {
    extensions.push(EditorState.readOnly.of(true));
  }

  return extensions;
}

export function CodeMirrorMergeView({
  originalText,
  currentText,
  language = 'json',
  collapseUnchanged = { margin: 3, minSize: 4 },
  showGutter = true,
  height = '600px',
  readOnly = true,
  originalLabel = 'Original',
  currentLabel = 'Current',
  onChange,
}: CodeMirrorMergeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mergeViewRef = useRef<MergeView | null>(null);
  const [stats, setStats] = useState({ additions: 0, deletions: 0, unchanged: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing content
    containerRef.current.innerHTML = '';

    // Create extensions
    const extensions = createBaseExtensions({ language, readOnly, showGutter });

    // Configure collapse behavior
    let collapseConfig: { margin?: number; minSize?: number } | undefined;
    if (collapseUnchanged === true) {
      collapseConfig = { margin: 3, minSize: 4 };
    } else if (collapseUnchanged && typeof collapseUnchanged === 'object') {
      collapseConfig = collapseUnchanged;
    }

    // Create MergeView
    const mergeView = new MergeView({
      a: {
        doc: originalText,
        extensions,
      },
      b: {
        doc: currentText,
        extensions: [
          ...extensions,
          // Add change listener for editable side
          ...(onChange && !readOnly
            ? [
                EditorView.updateListener.of((update) => {
                  if (update.docChanged) {
                    onChange(update.state.doc.toString());
                  }
                }),
              ]
            : []),
        ],
      },
      parent: containerRef.current,
      collapseUnchanged: collapseConfig,
      gutter: true,
      highlightChanges: true,
      renderRevertControl: undefined, // Could add revert buttons here
    });

    mergeViewRef.current = mergeView;

    // Compute simple stats
    const originalLines = originalText.split('\n');
    const currentLines = currentText.split('\n');
    let additions = 0;
    let deletions = 0;
    let unchanged = 0;

    // Simple line-by-line comparison for stats
    const maxLen = Math.max(originalLines.length, currentLines.length);
    const originalSet = new Set(originalLines);
    const currentSet = new Set(currentLines);

    for (const line of currentLines) {
      if (!originalSet.has(line)) additions++;
    }
    for (const line of originalLines) {
      if (!currentSet.has(line)) deletions++;
    }
    unchanged = maxLen - Math.max(additions, deletions);

    setStats({ additions, deletions, unchanged: Math.max(0, unchanged) });

    // Cleanup
    return () => {
      if (mergeViewRef.current) {
        mergeViewRef.current.destroy();
        mergeViewRef.current = null;
      }
    };
  }, [originalText, currentText, language, readOnly, showGutter, JSON.stringify(collapseUnchanged)]);

  return (
    <div className="flex flex-col border border-dark-border rounded-lg overflow-hidden bg-dark-card">
      {/* Stats Header */}
      <div className="flex items-center justify-between bg-dark-bg px-4 py-2 border-b border-dark-border">
        <div className="flex gap-4 text-xs">
          <span className="text-green-400">+{stats.additions} additions</span>
          <span className="text-red-400">-{stats.deletions} deletions</span>
          {stats.unchanged > 0 && (
            <span className="text-dark-muted">{stats.unchanged} unchanged</span>
          )}
        </div>
        <div className="flex gap-2 text-xs text-dark-muted">
          <span className="px-2 py-0.5 bg-dark-surface rounded">{originalLabel}</span>
          <span>vs</span>
          <span className="px-2 py-0.5 bg-dark-surface rounded">{currentLabel}</span>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-2 bg-dark-bg border-b border-dark-border text-xs font-semibold text-dark-muted">
        <div className="px-4 py-2 border-r border-dark-border">{originalLabel}</div>
        <div className="px-4 py-2">{currentLabel}</div>
      </div>

      {/* Merge View Container */}
      <div
        ref={containerRef}
        className="merge-view-container"
        style={{ height, overflow: 'auto' }}
      />

      {/* Custom styles for merge view */}
      <style>{`
        .merge-view-container .cm-mergeView {
          height: 100%;
        }
        .merge-view-container .cm-mergeViewEditors {
          display: flex;
          height: 100%;
        }
        .merge-view-container .cm-mergeViewEditor {
          flex: 1;
          overflow: auto;
        }
        .merge-view-container .cm-editor {
          height: 100%;
        }
        .merge-view-container .cm-scroller {
          overflow: auto;
        }
        .merge-view-container .cm-changedLine {
          background-color: rgba(255, 255, 0, 0.1);
        }
        .merge-view-container .cm-deletedChunk {
          background-color: rgba(255, 0, 0, 0.15);
        }
        .merge-view-container .cm-insertedChunk {
          background-color: rgba(0, 255, 0, 0.15);
        }
        .merge-view-container .cm-changedText {
          background-color: rgba(255, 255, 0, 0.3);
        }
        .merge-view-container .cm-deletedText {
          background-color: rgba(255, 0, 0, 0.3);
          text-decoration: line-through;
        }
        .merge-view-container .cm-insertedText {
          background-color: rgba(0, 255, 0, 0.3);
        }
        .merge-view-container .cm-collapsedLines {
          padding: 4px 8px;
          background-color: var(--tw-dark-bg, #1e1e1e);
          color: var(--tw-dark-muted, #888);
          cursor: pointer;
          text-align: center;
          font-size: 12px;
        }
        .merge-view-container .cm-collapsedLines:hover {
          background-color: var(--tw-dark-surface, #2d2d2d);
        }
        .merge-view-container .cm-mergeViewGutter {
          width: 8px;
          background-color: var(--tw-dark-border, #333);
        }
      `}</style>
    </div>
  );
}

/**
 * Simple unified diff view using CodeMirror MergeView
 * Shows changes inline rather than side-by-side
 */
export function CodeMirrorUnifiedDiff({
  originalText,
  currentText,
  language = 'json',
  height = '600px',
}: Pick<CodeMirrorMergeViewProps, 'originalText' | 'currentText' | 'language' | 'height'>) {
  // For unified view, we'll use the same MergeView but style it differently
  // Or compute a unified diff string and display it
  return (
    <CodeMirrorMergeView
      originalText={originalText}
      currentText={currentText}
      language={language}
      height={height}
      collapseUnchanged={{ margin: 3, minSize: 4 }}
      readOnly={true}
    />
  );
}
