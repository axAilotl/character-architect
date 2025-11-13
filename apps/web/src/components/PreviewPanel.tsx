import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useCardStore } from '../store/card-store';
import type { CCv3Data, CCv2Data } from '@card-architect/schemas';

export function PreviewPanel() {
  const currentCard = useCardStore((state) => state.currentCard);

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
      <div className="card">
        <h1 className="text-3xl font-bold mb-4">{cardData.name}</h1>

        {cardData.tags && cardData.tags.length > 0 && (
          <div className="flex gap-2 mb-4">
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
