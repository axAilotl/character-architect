import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useCardStore } from '../store/card-store';
import type { CCv3Data, CCv2Data } from '@card-architect/schemas';
import { useState, useEffect } from 'react';

export function PreviewPanel() {
  const currentCard = useCardStore((state) => state.currentCard);
  const [showPngPreview, setShowPngPreview] = useState(false);
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [pngLoading, setPngLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');
  const [copied, setCopied] = useState(false);

  if (!currentCard) return null;

  const isV3 = currentCard.meta.spec === 'v3';
  const cardData = isV3 ? (currentCard.data as CCv3Data).data : (currentCard.data as CCv2Data);

  // Load PNG preview when shown
  useEffect(() => {
    if (showPngPreview && !pngUrl && currentCard.id) {
      setPngLoading(true);
      fetch(`http://localhost:3456/cards/${currentCard.id}/export?format=png`)
        .then(res => res.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob);
          setPngUrl(url);
          setPngLoading(false);
        })
        .catch(err => {
          console.error('Failed to load PNG preview:', err);
          setPngLoading(false);
        });
    }

    // Cleanup URL on unmount
    return () => {
      if (pngUrl) {
        URL.revokeObjectURL(pngUrl);
      }
    };
  }, [showPngPreview, currentCard.id]);

  const renderMarkdown = (text: string) => {
    const html = marked.parse(text) as string;
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'img', 'ul', 'ol', 'li', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'width', 'height', 'style', 'class'],
    });
  };

  const handleCopy = async () => {
    try {
      const jsonString = JSON.stringify(currentCard.data, null, 2);
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* PNG Preview Card */}
      <div className="card bg-gradient-to-br from-slate-700 to-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">PNG Export Preview</h2>
          <button
            onClick={() => setShowPngPreview(!showPngPreview)}
            className="btn-secondary text-sm"
          >
            {showPngPreview ? 'Hide' : 'Show'} PNG Preview
          </button>
        </div>

        {showPngPreview && (
          <div className="flex justify-center">
            {pngLoading ? (
              <div className="flex items-center justify-center h-48">
                <p className="text-dark-muted">Loading PNG preview...</p>
              </div>
            ) : pngUrl ? (
              <img
                src={pngUrl}
                alt="PNG Export Preview"
                className="max-w-full h-auto rounded-lg shadow-2xl"
                style={{ maxHeight: '600px' }}
              />
            ) : (
              <div className="flex items-center justify-center h-48">
                <p className="text-red-400">Failed to load PNG preview</p>
              </div>
            )}
          </div>
        )}

        <p className="text-sm text-dark-muted mt-4">
          This is the actual PNG export with embedded character card data.
        </p>
      </div>

      {/* Preview/Raw Content Card */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">
            {viewMode === 'preview' ? 'Preview' : 'Raw JSON'}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="btn-secondary text-sm flex items-center gap-1"
              title="Copy JSON to clipboard"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'preview' ? 'raw' : 'preview')}
              className="btn-secondary text-sm"
            >
              {viewMode === 'preview' ? 'View Raw' : 'View Preview'}
            </button>
          </div>
        </div>

        {viewMode === 'raw' ? (
          <pre className="bg-dark-surface p-4 rounded overflow-x-auto text-xs">
            {JSON.stringify(currentCard.data, null, 2)}
          </pre>
        ) : (
          <>
            <h1 className="text-3xl font-bold mb-4">{cardData.name}</h1>

            {cardData.tags && cardData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {cardData.tags.map((tag, i) => (
                  <span key={i} className="chip bg-slate-700 text-slate-200">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-4">
              <section>
                <h2 className="text-xl font-semibold mb-2">Description</h2>
                <div
                  className="prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(cardData.description) }}
                />
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-2">Personality</h2>
                <div
                  className="prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(cardData.personality) }}
                />
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-2">Scenario</h2>
                <div
                  className="prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(cardData.scenario) }}
                />
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-2">First Message</h2>
                <div
                  className="prose prose-invert max-w-none bg-dark-surface p-4 rounded"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(cardData.first_mes) }}
                />
              </section>

              {cardData.alternate_greetings && cardData.alternate_greetings.length > 0 && (
                <section>
                  <h2 className="text-xl font-semibold mb-2">Alternate Greetings</h2>
                  <div className="space-y-2">
                    {cardData.alternate_greetings.map((greeting, i) => (
                      <div
                        key={i}
                        className="prose prose-invert max-w-none bg-dark-surface p-4 rounded"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(greeting) }}
                      />
                    ))}
                  </div>
                </section>
              )}

              {cardData.mes_example && (
                <section>
                  <h2 className="text-xl font-semibold mb-2">Example Dialogue</h2>
                  <pre className="bg-dark-surface p-4 rounded overflow-x-auto text-sm">
                    {cardData.mes_example}
                  </pre>
                </section>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
