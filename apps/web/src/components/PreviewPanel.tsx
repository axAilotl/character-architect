import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useCardStore } from '../store/card-store';
import type { CCv3Data, CCv2Data } from '@card-architect/schemas';
import { useState } from 'react';

export function PreviewPanel() {
  const currentCard = useCardStore((state) => state.currentCard);
  const [showPngPreview, setShowPngPreview] = useState(false);

  if (!currentCard) return null;

  const isV3 = currentCard.meta.spec === 'v3';
  const cardData = isV3 ? (currentCard.data as CCv3Data).data : (currentCard.data as CCv2Data);

  const renderMarkdown = (text: string) => {
    const html = marked.parse(text) as string;
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'img', 'ul', 'ol', 'li', 'code', 'pre'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title'],
    });
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
          <div className="relative w-[400px] h-[600px] mx-auto bg-gradient-to-br from-blue-600 to-purple-700 rounded-lg overflow-hidden shadow-2xl">
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-white">
              <div className="w-32 h-32 mb-4 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <span className="text-6xl">
                  {cardData.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <h3 className="text-2xl font-bold mb-2 text-center">{cardData.name}</h3>
              <div className="flex flex-wrap gap-2 justify-center mb-4">
                {cardData.tags?.slice(0, 3).map((tag, i) => (
                  <span key={i} className="px-2 py-1 bg-white/30 backdrop-blur-sm rounded-full text-xs">
                    {tag}
                  </span>
                ))}
                {cardData.tags && cardData.tags.length > 3 && (
                  <span className="px-2 py-1 bg-white/30 backdrop-blur-sm rounded-full text-xs">
                    +{cardData.tags.length - 3} more
                  </span>
                )}
              </div>
              <p className="text-sm text-center text-white/90 line-clamp-6 px-4">
                {cardData.description || 'No description available'}
              </p>
              <div className="absolute bottom-4 right-4 text-xs text-white/70">
                {currentCard.meta.spec.toUpperCase()}
              </div>
            </div>
          </div>
        )}

        <p className="text-sm text-dark-muted mt-4">
          This is a visual representation of your PNG export. The actual PNG will embed all card data.
        </p>
      </div>

      <div className="card">
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
      </div>
    </div>
  );
}
