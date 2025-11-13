/**
 * Diff Viewer Component
 * Shows semantic diffs between original and revised text
 */

import type { DiffOperation } from '@card-architect/schemas';

interface DiffViewerProps {
  diff: DiffOperation[];
  compact?: boolean;
}

export function DiffViewer({ diff, compact = false }: DiffViewerProps) {
  // Group consecutive unchanged lines for compaction
  const renderDiff = () => {
    if (compact) {
      return renderCompactDiff();
    }

    return diff.map((op, idx) => (
      <div key={idx} className={getDiffLineClass(op.type)}>
        <span className="inline-block w-8 text-right mr-2 text-dark-muted text-xs">
          {op.lineNumber || ''}
        </span>
        <span className={getDiffSymbolClass(op.type)}>{getDiffSymbol(op.type)}</span>
        <span className="ml-2">{op.value}</span>
      </div>
    ));
  };

  const renderCompactDiff = () => {
    const compacted: JSX.Element[] = [];
    let unchangedCount = 0;
    let lastUnchangedIdx = -1;

    diff.forEach((op, idx) => {
      if (op.type === 'unchanged') {
        unchangedCount++;
        lastUnchangedIdx = idx;
      } else {
        // If we had unchanged lines, show ellipsis
        if (unchangedCount > 3) {
          compacted.push(
            <div key={`ellipsis-${lastUnchangedIdx}`} className="text-dark-muted text-xs py-1">
              ... ({unchangedCount} unchanged lines)
            </div>
          );
        } else {
          // Show the few unchanged lines
          for (let i = idx - unchangedCount; i < idx; i++) {
            const unchangedOp = diff[i];
            compacted.push(
              <div key={i} className={getDiffLineClass('unchanged')}>
                <span className="inline-block w-8 text-right mr-2 text-dark-muted text-xs">
                  {unchangedOp.lineNumber || ''}
                </span>
                <span className="ml-2">{unchangedOp.value}</span>
              </div>
            );
          }
        }

        unchangedCount = 0;

        // Show the changed line
        compacted.push(
          <div key={idx} className={getDiffLineClass(op.type)}>
            <span className="inline-block w-8 text-right mr-2 text-dark-muted text-xs">
              {op.lineNumber || ''}
            </span>
            <span className={getDiffSymbolClass(op.type)}>{getDiffSymbol(op.type)}</span>
            <span className="ml-2">{op.value}</span>
          </div>
        );
      }
    });

    // Handle trailing unchanged lines
    if (unchangedCount > 3) {
      compacted.push(
        <div key={`ellipsis-end`} className="text-dark-muted text-xs py-1">
          ... ({unchangedCount} unchanged lines)
        </div>
      );
    } else if (unchangedCount > 0) {
      for (let i = diff.length - unchangedCount; i < diff.length; i++) {
        const unchangedOp = diff[i];
        compacted.push(
          <div key={i} className={getDiffLineClass('unchanged')}>
            <span className="inline-block w-8 text-right mr-2 text-dark-muted text-xs">
              {unchangedOp.lineNumber || ''}
            </span>
            <span className="ml-2">{unchangedOp.value}</span>
          </div>
        );
      }
    }

    return compacted;
  };

  const stats = computeStats(diff);

  return (
    <div className="border border-dark-border rounded overflow-hidden">
      {/* Stats Header */}
      <div className="bg-dark-bg px-3 py-2 border-b border-dark-border flex gap-4 text-xs">
        <span className="text-green-400">+{stats.additions} additions</span>
        <span className="text-red-400">-{stats.deletions} deletions</span>
        {stats.unchanged > 0 && (
          <span className="text-dark-muted">{stats.unchanged} unchanged</span>
        )}
      </div>

      {/* Diff Content */}
      <div className="bg-dark-card p-3 font-mono text-xs overflow-x-auto max-h-[400px] overflow-y-auto">
        {renderDiff()}
      </div>
    </div>
  );
}

function getDiffLineClass(type: DiffOperation['type']): string {
  switch (type) {
    case 'add':
      return 'bg-green-900/30 text-green-200';
    case 'remove':
      return 'bg-red-900/30 text-red-200';
    case 'unchanged':
      return 'text-dark-muted';
  }
}

function getDiffSymbolClass(type: DiffOperation['type']): string {
  switch (type) {
    case 'add':
      return 'text-green-400 font-bold';
    case 'remove':
      return 'text-red-400 font-bold';
    case 'unchanged':
      return 'text-dark-muted';
  }
}

function getDiffSymbol(type: DiffOperation['type']): string {
  switch (type) {
    case 'add':
      return '+';
    case 'remove':
      return '-';
    case 'unchanged':
      return ' ';
  }
}

function computeStats(diff: DiffOperation[]): {
  additions: number;
  deletions: number;
  unchanged: number;
} {
  return diff.reduce(
    (acc, op) => {
      if (op.type === 'add') acc.additions++;
      else if (op.type === 'remove') acc.deletions++;
      else acc.unchanged++;
      return acc;
    },
    { additions: 0, deletions: 0, unchanged: 0 }
  );
}
