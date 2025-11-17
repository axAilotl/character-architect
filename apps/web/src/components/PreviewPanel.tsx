import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useCardStore, extractCardData } from '../store/card-store';
import { useState, useEffect, useRef } from 'react';

// Custom marked extension to support image sizing syntax: ![alt](url =widthxheight)
// This handles syntax like: ![image](url =100%x100%) or ![image](url =400x300)
const imageSizeExtension = {
  name: 'imageSize',
  level: 'inline' as const,
  start(src: string) {
    return src.match(/!\[/)?.index;
  },
  tokenizer(src: string) {
    // Match: ![alt](<url> =widthxheight) or ![alt](url =widthxheight)
    const rule = /^!\[([^\]]*)\]\(<?([^>\s]+)>?\s*=([^)]+)\)/;
    const match = rule.exec(src);
    if (match) {
      return {
        type: 'imageSize',
        raw: match[0],
        alt: match[1],
        href: match[2],
        size: match[3],
      };
    }
  },
  renderer(token: { alt: string; href: string; size: string }) {
    const { alt, href, size } = token;

    // Parse size: can be "widthxheight", "width", or "100%x100%"
    const sizeMatch = size.match(/^(\d+%?|\*)?x?(\d+%?|\*)?$/);
    let width = '';
    let height = '';

    if (sizeMatch) {
      if (sizeMatch[1] && sizeMatch[1] !== '*') {
        width = sizeMatch[1];
      }
      if (sizeMatch[2] && sizeMatch[2] !== '*') {
        height = sizeMatch[2];
      }
    } else {
      // If size doesn't match expected format, try to use it as-is for width
      width = size;
    }

    const attrs = [];
    if (width) attrs.push(`width="${width}"`);
    if (height) attrs.push(`height="${height}"`);

    return `<img src="${href}" alt="${alt}" ${attrs.join(' ')} />`;
  },
};

// Configure marked with the extension once (outside component to avoid re-registration)
let markedConfigured = false;
if (!markedConfigured) {
  marked.use({ extensions: [imageSizeExtension as any] });
  markedConfigured = true;
}

export function PreviewPanel() {
  const currentCard = useCardStore((state) => state.currentCard);
  const [showPngPreview, setShowPngPreview] = useState(false);
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [pngLoading, setPngLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');
  const [copied, setCopied] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  if (!currentCard) return null;
  const cardId = currentCard.meta.id;

  useEffect(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPngUrl(null);
  }, [cardId]);

  const cardData = extractCardData(currentCard);

  // Load PNG preview when shown
  useEffect(() => {
    if (showPngPreview && cardId) {
      setPngLoading(true);
      const controller = new AbortController();

      fetch(`/api/cards/${cardId}/export?format=png`, {
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          return res.blob();
        })
        .then((blob) => {
          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
          }
          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;
          setPngUrl(url);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            console.error('Failed to load PNG preview:', err);
          }
          setPngUrl(null);
        })
        .finally(() => {
          setPngLoading(false);
        });

      return () => {
        controller.abort();
      };
    } else if (showPngPreview && !cardId) {
      setPngUrl(null);
    }
  }, [showPngPreview, cardId]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

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
    <div className="max-w-7xl mx-auto p-6 space-y-6">
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
            {!cardId ? (
              <div className="flex items-center justify-center h-48">
                <p className="text-dark-muted">Save the card first to generate a PNG preview.</p>
              </div>
            ) : pngLoading ? (
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
          <pre className="bg-dark-surface p-4 rounded overflow-x-auto text-xs whitespace-pre-wrap break-words">
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
