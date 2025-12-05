/**
 * wwwyzzerdd Tab - AI-assisted character creation wizard
 * Two-column layout: Left = Character form fields, Right = AI chat
 */

import { useState, useRef, useEffect } from 'react';
import { useCardStore, extractCardData } from '../../store/card-store';
import { useSettingsStore } from '../../store/settings-store';
import { useLLMStore } from '../../store/llm-store';
import { getDeploymentConfig } from '../../config/deployment';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  parsedData?: Partial<CharacterFields>;
}

interface CharacterFields {
  name: string;
  nickname: string;
  description: string;
  scenario: string;
  first_mes: string;
  appearance: string;
  personality: string;
  tags: string[];
}

interface WwwyzzerddPromptSet {
  id: string;
  name: string;
  characterPrompt: string;
  lorePrompt: string;
  personality: string;
}

// Persist messages across component remounts
let persistedMessages: ChatMessage[] = [];
let hasInitializedGreeting = false;

// Try to parse JSON from assistant response
function tryParseCharacterJson(content: string): Partial<CharacterFields> | null {
  // Look for JSON block in the response
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
                    content.match(/```\s*([\s\S]*?)\s*```/) ||
                    content.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      // Validate it has at least one expected field
      const validFields = ['name', 'nickname', 'description', 'scenario', 'first_mes', 'first_message', 'appearance', 'personality', 'tags'];
      const hasValidField = validFields.some(f => f in parsed);

      if (hasValidField) {
        // Normalize first_message to first_mes
        if (parsed.first_message && !parsed.first_mes) {
          parsed.first_mes = parsed.first_message;
          delete parsed.first_message;
        }
        return parsed;
      }
    } catch {
      // Not valid JSON
    }
  }
  return null;
}

export function WwwyzzerddTab() {
  const { currentCard, updateCardData } = useCardStore();
  const llmSettings = useLLMStore((state) => state.settings);
  const loadSettings = useLLMStore((state) => state.loadSettings);
  const activePromptSetId = useSettingsStore((state) => state.wwwyzzerdd?.activePromptSetId);

  // Initialize messages from persisted state
  const [messages, setMessagesState] = useState<ChatMessage[]>(persistedMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [promptSet, setPromptSet] = useState<WwwyzzerddPromptSet | null>(null);
  const [mode, setMode] = useState<'character' | 'lore'>('character');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Wrapper to persist messages
  const setMessages = (newMessages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setMessagesState((prev) => {
      const result = typeof newMessages === 'function' ? newMessages(prev) : newMessages;
      persistedMessages = result;
      return result;
    });
  };

  // Get card data
  const cardData = currentCard ? extractCardData(currentCard) : null;
  const isV3 = currentCard?.meta.spec === 'v3';
  const v2Data = currentCard?.data as any;
  const isWrappedV2 = !isV3 && v2Data?.spec === 'chara_card_v2' && 'data' in v2Data;

  // Helper to update card fields
  const handleFieldChange = (field: string, value: string | string[]) => {
    if (!currentCard || !cardData) return;

    if (isV3 || isWrappedV2) {
      updateCardData({
        data: {
          ...cardData,
          [field]: value,
        },
      } as any);
    } else {
      updateCardData({ [field]: value });
    }
  };

  // Load LLM settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Load active prompt set
  useEffect(() => {
    if (activePromptSetId) {
      fetch(`/api/wwwyzzerdd/prompts/${activePromptSetId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.promptSet) {
            setPromptSet(data.promptSet);
          }
        })
        .catch(console.error);
    }
  }, [activePromptSetId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add initial greeting when prompt set loads (only once ever, using module-level flag)
  useEffect(() => {
    if (promptSet && !hasInitializedGreeting && persistedMessages.length === 0) {
      hasInitializedGreeting = true;
      const greeting = `Hello! I'm wwwyzzerdd, your character creation assistant. ${promptSet.personality}

Before we begin, I need to know a few things:

1. **Card Type**: Are you creating a standard **Character Card (CC)** or a **Voxta** card?
   - CC: Personality field is deprecated, traits go in Description using JED format
   - Voxta: Personality field is used, plus Appearance field for image generation

2. **Image Generation**: What type of image generator will you use for the Appearance field?
   - **Tag-based** (Stable Diffusion, NovelAI): Use booru-style tags like "1girl, long hair, blue eyes, school uniform"
   - **Natural language** (DALL-E, Midjourney): Use descriptive sentences

Tell me your preferences and describe the character you'd like to create!`;

      const newMessages = [{
        role: 'assistant' as const,
        content: greeting,
        timestamp: new Date(),
      }];
      persistedMessages = newMessages;
      setMessagesState(newMessages);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptSet]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;
    if (!promptSet) {
      alert('Please select a prompt set in Settings > wwwyzzerdd first.');
      return;
    }

    console.log('LLM Settings:', llmSettings);
    console.log('Providers:', llmSettings.providers);
    console.log('Active Provider ID:', llmSettings.activeProviderId);

    // Find active provider - try activeProviderId first, fallback to first provider
    let activeProvider = llmSettings.providers.find((p) => p.id === llmSettings.activeProviderId);
    if (!activeProvider && llmSettings.providers.length > 0) {
      activeProvider = llmSettings.providers[0];
      console.log('Using first provider as fallback:', activeProvider);
    }

    if (!activeProvider) {
      alert('Please configure an LLM provider in Settings > AI Providers first.');
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      // Build context from current card
      const cardContext = cardData ? `
Current character data:
- Name: ${cardData.name || '(not set)'}
- Description: ${cardData.description || '(not set)'}
- Personality: ${cardData.personality || '(not set)'}
- Scenario: ${cardData.scenario || '(not set)'}
- First Message: ${cardData.first_mes || '(not set)'}
` : 'No character card loaded yet.';

      const jsonInstruction = `

IMPORTANT FORMATTING RULES:
- Default to JED (JSON-Enhanced Description) format for the description field unless user specifies otherwise
- JED format uses structured sections like [Character], [Personality], [Background], [Traits], etc.
- The "personality" field is DEPRECATED for standard Character Cards - put personality traits in the description using JED format
- Only use the "personality" field if the user explicitly says they're making a Voxta card
- The "appearance" field is for image generation prompts - ask user if they prefer booru tags or natural language

When you have enough information to fill in character fields, output them in a JSON code block like this:
\`\`\`json
{
  "name": "Character Name",
  "nickname": "Optional nickname",
  "description": "[Character]\\nName, age, role...\\n\\n[Personality]\\nTraits and behavior...\\n\\n[Background]\\nHistory...",
  "scenario": "The scenario/setting...",
  "first_mes": "The opening message...",
  "appearance": "For image gen - either booru tags or natural language based on user preference",
  "personality": "ONLY for Voxta cards, otherwise leave empty",
  "tags": ["tag1", "tag2"]
}
\`\`\`
Only include fields you want to update. The user can then apply these to the character card.`;

      const systemPrompt = mode === 'character' ? promptSet.characterPrompt : promptSet.lorePrompt;
      const fullSystemPrompt = `${systemPrompt}${jsonInstruction}\n\n${cardContext}`;

      // Build messages array (excluding system - that goes separately)
      const chatMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: input.trim() },
      ];

      const response = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: activeProvider.id,
          system: fullSystemPrompt,
          messages: chatMessages,
          temperature: 0.7,
          maxTokens: 2048,
        }),
        signal: abortControllerRef.current.signal,
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const content = data.content || data.text || 'No response received.';
      const parsedData = tryParseCharacterJson(content);

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content,
        timestamp: new Date(),
        parsedData: parsedData || undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: '[Request stopped by user]',
            timestamp: new Date(),
          },
        ]);
      } else {
        console.error('Chat error:', err);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}`,
            timestamp: new Date(),
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    // Clear persisted messages
    persistedMessages = [];
    hasInitializedGreeting = false;

    // Immediately show greeting
    if (promptSet) {
      hasInitializedGreeting = true;
      const greeting = `Hello! I'm wwwyzzerdd, your character creation assistant. ${promptSet.personality}

Before we begin, I need to know a few things:

1. **Card Type**: Are you creating a standard **Character Card (CC)** or a **Voxta** card?
   - CC: Personality field is deprecated, traits go in Description using JED format
   - Voxta: Personality field is used, plus Appearance field for image generation

2. **Image Generation**: What type of image generator will you use for the Appearance field?
   - **Tag-based** (Stable Diffusion, NovelAI): Use booru-style tags like "1girl, long hair, blue eyes, school uniform"
   - **Natural language** (DALL-E, Midjourney): Use descriptive sentences

Tell me your preferences and describe the character you'd like to create!`;

      const newMessages = [{
        role: 'assistant' as const,
        content: greeting,
        timestamp: new Date(),
      }];
      persistedMessages = newMessages;
      setMessagesState(newMessages);
    } else {
      setMessagesState([]);
    }
  };

  const applyParsedData = (data: Partial<CharacterFields>) => {
    if (!currentCard || !cardData) return;

    // Build the complete update object with all fields at once
    const fieldsToUpdate: Record<string, any> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        // Handle appearance specially - it goes into extensions
        if (key === 'appearance') {
          const existingExtensions = (cardData as any)?.extensions || {};
          const extensions = { ...existingExtensions };
          if (extensions.voxta) {
            extensions.voxta = { ...extensions.voxta, appearance: value };
          } else {
            extensions.visual_description = value;
          }
          fieldsToUpdate.extensions = extensions;
        } else {
          fieldsToUpdate[key] = value;
        }
      }
    });

    if (Object.keys(fieldsToUpdate).length === 0) return;

    // Apply all fields in a single update
    if (isV3 || isWrappedV2) {
      updateCardData({
        data: {
          ...cardData,
          ...fieldsToUpdate,
        },
      } as any);
    } else {
      updateCardData(fieldsToUpdate);
    }
  };

  if (!currentCard) {
    return (
      <div className="flex items-center justify-center h-full text-dark-muted">
        <div className="text-center">
          <div className="text-6xl mb-4">&#129497;</div>
          <h2 className="text-xl font-semibold mb-2">No Card Loaded</h2>
          <p>Create or load a character card to use wwwyzzerdd.</p>
        </div>
      </div>
    );
  }

  // Light mode check - wwwyzzerdd requires LLM server
  const config = getDeploymentConfig();
  if (config.mode === 'light' || config.mode === 'static') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-dark-muted max-w-md">
          <h2 className="text-xl font-semibold mb-2">wwwyzzerdd AI Assistant</h2>
          <p className="mb-4">
            The AI character creation wizard requires running Card Architect locally with LLM integration configured.
          </p>
          <p className="text-sm">
            Run Card Architect with a backend server and configure an LLM provider in Settings to use this feature.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left Column - Character Form */}
      <div className="w-1/2 border-r border-dark-border overflow-auto p-6">
        <div className="space-y-4">
          {/* Name & Nickname */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={cardData?.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nickname</label>
              <input
                type="text"
                value={(cardData as any)?.nickname || ''}
                onChange={(e) => handleFieldChange('nickname', e.target.value)}
                className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={cardData?.description || ''}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              rows={8}
              className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 resize-y"
            />
          </div>

          {/* Scenario */}
          <div>
            <label className="block text-sm font-medium mb-1">Scenario</label>
            <textarea
              value={cardData?.scenario || ''}
              onChange={(e) => handleFieldChange('scenario', e.target.value)}
              rows={6}
              className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 resize-y"
            />
          </div>

          {/* First Message */}
          <div>
            <label className="block text-sm font-medium mb-1">First Message</label>
            <textarea
              value={cardData?.first_mes || ''}
              onChange={(e) => handleFieldChange('first_mes', e.target.value)}
              rows={8}
              className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 resize-y"
            />
          </div>

          {/* Appearance */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium">Appearance</label>
              <span className="text-xs px-1.5 py-0.5 rounded bg-orange-600 text-white">Image Gen</span>
            </div>
            <textarea
              value={(() => {
                const ext = (cardData as any)?.extensions || {};
                return ext.voxta?.appearance || ext.visual_description || '';
              })()}
              onChange={(e) => {
                const existingExtensions = (cardData as any)?.extensions || {};
                const extensions = { ...existingExtensions };
                if (extensions.voxta) {
                  extensions.voxta = { ...extensions.voxta, appearance: e.target.value };
                } else {
                  extensions.visual_description = e.target.value;
                }
                handleFieldChange('extensions', extensions);
              }}
              rows={4}
              placeholder="Booru tags or natural language for image generation..."
              className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 resize-y"
            />
          </div>

          {/* Personality - Last, deprecated for CC */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium">Personality</label>
              <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-600 text-white">Voxta Only</span>
            </div>
            <textarea
              value={cardData?.personality || ''}
              onChange={(e) => handleFieldChange('personality', e.target.value)}
              rows={4}
              placeholder="Only used for Voxta cards. For CC, put personality in Description."
              className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 resize-y"
            />
          </div>
        </div>
      </div>

      {/* Right Column - AI Chat */}
      <div className="w-1/2 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b border-dark-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-purple-400">wwwyzzerdd</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('character')}
                className={`px-3 py-1 rounded text-sm ${
                  mode === 'character'
                    ? 'bg-purple-600 text-white'
                    : 'bg-dark-surface text-dark-muted hover:text-dark-text'
                }`}
              >
                Character
              </button>
              <button
                onClick={() => setMode('lore')}
                className={`px-3 py-1 rounded text-sm ${
                  mode === 'lore'
                    ? 'bg-purple-600 text-white'
                    : 'bg-dark-surface text-dark-muted hover:text-dark-text'
                }`}
              >
                Lore
              </button>
            </div>
          </div>
          <button
            onClick={clearChat}
            className="px-3 py-1 text-sm text-dark-muted hover:text-dark-text"
          >
            Clear Chat
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {!promptSet && (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded p-4 text-yellow-200 text-sm">
              No prompt set selected. Go to Settings &gt; wwwyzzerdd to select or create a prompt set.
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-dark-surface border border-dark-border'
                }`}
              >
                <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                {msg.parsedData && (
                  <div className="mt-3 pt-3 border-t border-dark-border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-green-400">
                        JSON detected: {Object.keys(msg.parsedData).join(', ')}
                      </span>
                      <button
                        onClick={() => applyParsedData(msg.parsedData!)}
                        className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                      >
                        Apply to Card
                      </button>
                    </div>
                  </div>
                )}
                <div className="text-xs opacity-50 mt-1">
                  {msg.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-dark-surface border border-dark-border rounded-lg px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full" />
                  <span className="text-dark-muted">wwwyzzerdd is thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-dark-border">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your character or ask for suggestions..."
              rows={2}
              className="flex-1 bg-dark-surface border border-dark-border rounded px-3 py-2 resize-none"
              disabled={isLoading || !promptSet}
            />
            {isLoading ? (
              <button
                onClick={handleStop}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={handleSendMessage}
                disabled={!input.trim() || !promptSet}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                Send
              </button>
            )}
          </div>
          <p className="text-xs text-dark-muted mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
