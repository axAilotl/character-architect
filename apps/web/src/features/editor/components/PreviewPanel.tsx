import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useCardStore, extractCardData } from '../../../store/card-store';
import { useState, useEffect } from 'react';
import { localDB } from '../../../lib/db';
import { getDeploymentConfig } from '../../../config/deployment';

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
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');
  const [copied, setCopied] = useState(false);
  const [cachedImageUrl, setCachedImageUrl] = useState<string | null>(null);

  const config = getDeploymentConfig();
  const isLightMode = config.mode === 'light' || config.mode === 'static';

  // Load cached image from IndexedDB in light mode
  useEffect(() => {
    if (isLightMode && currentCard?.meta?.id) {
      localDB.getImage(currentCard.meta.id, 'thumbnail').then((imageData) => {
        setCachedImageUrl(imageData);
      });
    }
  }, [isLightMode, currentCard?.meta?.id]);

  if (!currentCard) return null;
  const cardId = currentCard.meta.id;

  const cardData = extractCardData(currentCard);

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
            {/* Large centered thumbnail */}
            <div className="flex justify-center mb-6">
              <div className="w-64 bg-dark-bg border border-dark-border rounded-lg overflow-hidden shadow-lg">
                {(isLightMode ? cachedImageUrl : true) ? (
                  <img
                    src={isLightMode ? (cachedImageUrl || '') : `/api/cards/${cardId}/image?v=${currentCard.meta.updatedAt}`}
                    alt="Character Avatar"
                    className="w-full h-auto object-contain"
                    style={{ minHeight: '256px', maxHeight: '384px', display: (isLightMode && !cachedImageUrl) ? 'none' : 'block' }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent && !parent.querySelector('.no-image-placeholder')) {
                        const placeholder = document.createElement('div');
                        placeholder.className = 'no-image-placeholder flex items-center justify-center text-dark-muted text-sm';
                        placeholder.style.height = '256px';
                        placeholder.textContent = 'No Image';
                        parent.appendChild(placeholder);
                      }
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center text-dark-muted text-sm" style={{ height: '256px' }}>
                    No Image
                  </div>
                )}
              </div>
            </div>

            <h1 className="text-3xl font-bold mb-4 text-center">{cardData.name}</h1>

            {cardData.tags && cardData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4 justify-center">
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
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(cardData.personality || '') }}
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
