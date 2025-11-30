/**
 * ELARA VOSS Panel
 * Tool for replacing placeholder character names with randomly generated ones
 */

import { useState, useEffect } from 'react';
import { useCardStore, extractCardData } from '../../../store/card-store';

type Gender = 'male' | 'female' | 'femboy' | 'futa';

interface NameEntry {
  gender: 'male' | 'female' | 'neutral';
  type: 'first' | 'last';
  name: string;
}

interface GeneratedName {
  firstName: string;
  lastName: string;
}

export function ElaraVossPanel() {
  const { currentCard, updateCardData, createSnapshot } = useCardStore();

  // Offending name inputs
  const [offendingFirst, setOffendingFirst] = useState('Elara');
  const [offendingLast, setOffendingLast] = useState('Voss');
  const [gender, setGender] = useState<Gender>('female');

  // Name database
  const [nameDb, setNameDb] = useState<NameEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Generated name
  const [generatedName, setGeneratedName] = useState<GeneratedName | null>(null);

  // Replacement status
  const [replacing, setReplacing] = useState(false);
  const [replaceResult, setReplaceResult] = useState<string | null>(null);

  // Load name database
  useEffect(() => {
    fetch('/elara_voss.json')
      .then((res) => res.json())
      .then((data: NameEntry[]) => {
        setNameDb(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load elara_voss.json:', err);
        setLoading(false);
      });
  }, []);

  const getRandomName = (): GeneratedName => {
    // Get first names based on gender
    // For femboy/futa, use female first names
    const firstNameGender = gender === 'femboy' || gender === 'futa' ? 'female' : gender;
    const firstNames = nameDb.filter((n) => n.type === 'first' && n.gender === firstNameGender);
    const lastNames = nameDb.filter((n) => n.type === 'last' && n.gender === 'neutral');

    if (firstNames.length === 0 || lastNames.length === 0) {
      return { firstName: 'Unknown', lastName: 'Name' };
    }

    const randomFirst = firstNames[Math.floor(Math.random() * firstNames.length)];
    const randomLast = lastNames[Math.floor(Math.random() * lastNames.length)];

    return {
      firstName: randomFirst.name,
      lastName: randomLast.name,
    };
  };

  const handleGenerate = () => {
    const name = getRandomName();
    setGeneratedName(name);
    setReplaceResult(null);
  };

  const replaceInString = (str: string, oldFirst: string, newFirst: string, oldLast: string, newLast: string): string => {
    if (!str) return str;
    let result = str;

    // Only replace if we have both old and new values (avoid empty string replacements)
    const hasFirst = oldFirst.trim() && newFirst.trim();
    const hasLast = oldLast.trim() && newLast.trim();

    // Replace full name first (to avoid partial replacements)
    if (hasFirst && hasLast) {
      const oldFullName = `${oldFirst} ${oldLast}`;
      const newFullName = `${newFirst} ${newLast}`;
      result = result.split(oldFullName).join(newFullName);
    }

    // Replace first name (case-sensitive) - only if not empty
    if (hasFirst) {
      result = result.split(oldFirst).join(newFirst);
    }

    // Replace last name (case-sensitive) - only if not empty
    if (hasLast) {
      result = result.split(oldLast).join(newLast);
    }

    return result;
  };

  const handleReplace = async () => {
    if (!currentCard || !generatedName) return;
    if (!offendingFirst.trim() && !offendingLast.trim()) {
      setReplaceResult('Please enter at least one name to replace.');
      return;
    }

    setReplacing(true);
    setReplaceResult(null);

    try {
      // Create snapshot first
      await createSnapshot(`Before ELARA VOSS replacement: ${offendingFirst} ${offendingLast} -> ${generatedName.firstName} ${generatedName.lastName}`);

      const cardData = extractCardData(currentCard);
      const isV3 = currentCard.meta.spec === 'v3';
      const v2Data = currentCard.data as any;
      const isWrappedV2 = !isV3 && v2Data.spec === 'chara_card_v2' && 'data' in v2Data;

      // Fields to search and replace
      const fieldsToReplace = [
        'name',
        'description',
        'personality',
        'scenario',
        'first_mes',
        'mes_example',
        'system_prompt',
        'post_history_instructions',
        'creator_notes',
      ];

      let replacementCount = 0;
      const updatedData: any = { ...cardData };

      // Replace in main fields
      for (const field of fieldsToReplace) {
        const value = (cardData as any)[field];
        if (typeof value === 'string' && value) {
          const newValue = replaceInString(
            value,
            offendingFirst,
            generatedName.firstName,
            offendingLast,
            generatedName.lastName
          );
          if (newValue !== value) {
            updatedData[field] = newValue;
            replacementCount++;
          }
        }
      }

      // Replace in alternate_greetings array
      if (Array.isArray(cardData.alternate_greetings)) {
        const newGreetings = cardData.alternate_greetings.map((greeting) => {
          const newGreeting = replaceInString(
            greeting,
            offendingFirst,
            generatedName.firstName,
            offendingLast,
            generatedName.lastName
          );
          if (newGreeting !== greeting) replacementCount++;
          return newGreeting;
        });
        updatedData.alternate_greetings = newGreetings;
      }

      // Replace in lorebook entries
      if (cardData.character_book?.entries) {
        const newEntries = cardData.character_book.entries.map((entry: any) => {
          const newEntry = { ...entry };
          if (entry.content) {
            const newContent = replaceInString(
              entry.content,
              offendingFirst,
              generatedName.firstName,
              offendingLast,
              generatedName.lastName
            );
            if (newContent !== entry.content) {
              newEntry.content = newContent;
              replacementCount++;
            }
          }
          // Also check keys
          if (Array.isArray(entry.keys)) {
            newEntry.keys = entry.keys.map((key: string) => {
              const newKey = replaceInString(
                key,
                offendingFirst,
                generatedName.firstName,
                offendingLast,
                generatedName.lastName
              );
              if (newKey !== key) replacementCount++;
              return newKey;
            });
          }
          return newEntry;
        });
        updatedData.character_book = {
          ...cardData.character_book,
          entries: newEntries,
        };
      }

      // Update card data
      if (isV3 || isWrappedV2) {
        updateCardData({ data: updatedData } as any);
      } else {
        updateCardData(updatedData);
      }

      setReplaceResult(`Replacement complete! Modified ${replacementCount} field(s). Snapshot created.`);
    } catch (err) {
      console.error('Replacement failed:', err);
      setReplaceResult(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setReplacing(false);
    }
  };

  if (!currentCard) {
    return (
      <div className="flex items-center justify-center h-full text-dark-muted">
        <div className="text-center">
          <div className="text-6xl mb-4">&#128100;</div>
          <h2 className="text-xl font-semibold mb-2">No Card Loaded</h2>
          <p>Load a character card to use ELARA VOSS.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-purple-400 mb-2">WHO IS ELARA VOSS?</h2>
        <p className="text-dark-muted">
          Replace placeholder character names with randomly generated ones.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8 text-dark-muted">Loading name database...</div>
      ) : (
        <>
          {/* Offending Name Input */}
          <div className="bg-dark-surface border border-dark-border rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold">Offending Name</h3>
            <p className="text-sm text-dark-muted">
              Enter the placeholder name you want to replace throughout the card.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">First Name</label>
                <input
                  type="text"
                  value={offendingFirst}
                  onChange={(e) => setOffendingFirst(e.target.value)}
                  placeholder="Elara"
                  className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last Name</label>
                <input
                  type="text"
                  value={offendingLast}
                  onChange={(e) => setOffendingLast(e.target.value)}
                  placeholder="Voss"
                  className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Gender</label>
              <div className="flex gap-2">
                {(['male', 'female', 'femboy', 'futa'] as Gender[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={`px-4 py-2 rounded capitalize transition-colors ${
                      gender === g
                        ? 'bg-purple-600 text-white'
                        : 'bg-dark-bg border border-dark-border hover:border-purple-500'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <div className="text-center">
            <button
              onClick={handleGenerate}
              className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white text-xl font-bold rounded-lg transition-colors"
            >
              WHO IS ELARA VOSS?
            </button>
          </div>

          {/* Generated Name Display */}
          {generatedName && (
            <div className="bg-dark-surface border-2 border-purple-500 rounded-lg p-6 text-center space-y-4">
              <h3 className="text-lg font-semibold text-dark-muted">Generated Name</h3>
              <div className="text-4xl font-bold text-purple-400">
                {generatedName.firstName} {generatedName.lastName}
              </div>
              <p className="text-sm text-dark-muted">
                Will replace "{offendingFirst} {offendingLast}" throughout the card
              </p>

              <button
                onClick={handleReplace}
                disabled={replacing}
                className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
              >
                {replacing ? 'Replacing...' : 'REPLACE'}
              </button>

              {replaceResult && (
                <div
                  className={`p-3 rounded ${
                    replaceResult.startsWith('Error')
                      ? 'bg-red-900/30 text-red-300'
                      : 'bg-green-900/30 text-green-300'
                  }`}
                >
                  {replaceResult}
                </div>
              )}
            </div>
          )}

          {/* Info */}
          <div className="text-sm text-dark-muted text-center">
            <p>Names from: {nameDb.filter((n) => n.type === 'first').length} first names, {nameDb.filter((n) => n.type === 'last').length} last names</p>
          </div>
        </>
      )}
    </div>
  );
}
