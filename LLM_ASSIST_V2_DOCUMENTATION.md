# LLM Assist v2.0 - Feature Documentation

## Overview

LLM Assist v2.0 adds AI-powered editing capabilities to Card Architect, enabling users to leverage OpenAI, Anthropic, and OpenAI-compatible LLM providers to enhance character card fields with intelligent text transformations, generation, and editing.

## Features

### 1. **Multi-Provider Support**

- **OpenAI**: Supports both the newer Responses API and legacy Chat Completions API
- **Anthropic**: Full support for Claude via the Messages API
- **OpenAI-Compatible**: Works with OpenRouter, Azure OpenAI, vLLM, LM Studio, and other compatible endpoints

### 2. **Settings Management**

Access LLM settings via the ⚙️ button in the header.

#### Provider Configuration
- **Label**: Friendly name for the provider
- **Provider Type**: OpenAI, OpenAI-Compatible, or Anthropic
- **Base URL**: API endpoint (e.g., `https://api.openai.com`)
- **API Key**: Your provider's API key (stored securely in `~/.card-architect/config.json` with 600 permissions)
- **Mode**: For OpenAI providers, choose between Responses API (newer) or Chat Completions (legacy)
- **Default Model**: Model identifier (e.g., `gpt-4`, `claude-3-5-sonnet-20241022`)
- **Temperature**: Controls randomness (0-2)
- **Max Tokens**: Maximum completion length
- **Streaming**: Enable/disable real-time streaming

#### Test Connection
Each provider has a "Test" button that verifies connectivity and authentication.

### 3. **LLM Assist Sidebar**

Click the **✨ AI** button next to any field to open the LLM Assist sidebar.

#### Configuration Options
- **Provider**: Select which LLM provider to use
- **Model**: Override the default model if needed
- **Temperature**: Adjust for this specific operation
- **Stream Response**: Toggle streaming on/off

#### Quick Presets

1. **Tighten**: Reduce text to target token count while preserving meaning
   - Configurable target tokens

2. **→ Structured**: Convert prose to structured format with labeled sections and bullets

3. **→ Prose**: Convert structured text to flowing prose paragraphs

4. **Fix Style**: Enforce CCv2/CCv3 formatting rules:
   - "Quoted dialogue" for speech
   - *Italic actions* for actions
   - Present tense for descriptions
   - Proper {{char}}/{{user}} placeholders

5. **Gen Alts**: Generate N alternate greetings
   - Configurable count (1-10)

6. **→ Lore Entry**: Convert selected text into a lorebook entry (returns JSON)

#### Custom Instructions
Enter any custom instruction to override preset behavior.

### 4. **Diff Preview**

After processing, the sidebar shows:
- **Line-by-line diff** with additions (green) and deletions (red)
- **Token delta**: Shows before/after token counts and net change
- **Statistics**: Additions, deletions, unchanged lines
- **Metadata**: Provider, model, prompt/completion token usage

### 5. **Apply Actions**

- **Replace**: Replace the field content with the revised version
- **Append**: Add the revised version after the current content (for examples, alt greetings)

### 6. **RAG (Retrieval-Augmented Generation)**

**Settings → Knowledge (RAG)**

- **Enable RAG**: Toggle RAG system on/off
- **Top-K Results**: Number of snippets to retrieve
- **Token Cap**: Maximum tokens from RAG snippets
- **Sources**: Add documentation, style guides, or best practices

When enabled, RAG snippets are automatically injected into prompts to ground LLM suggestions.

**Note**: Current implementation uses simple keyword search. Production-ready RAG would use embeddings and vector similarity.

## Architecture

### Backend (`apps/api/src/`)

#### Provider Shims
- **`providers/openai.ts`**: OpenAI Responses & Chat Completions APIs
- **`providers/anthropic.ts`**: Anthropic Messages API with streaming

Both support:
- Streaming via Server-Sent Events (SSE)
- Proper error handling
- Usage tracking

#### Routes
- **`routes/llm.ts`**: LLM invocation and assist endpoints
  - `GET /api/llm/settings` - Load settings
  - `POST /api/llm/settings` - Save settings
  - `POST /api/llm/test-connection` - Test provider
  - `POST /api/llm/invoke` - Low-level LLM invocation
  - `POST /api/llm/assist` - High-level assist with prompt building

- **`routes/rag.ts`**: RAG indexing and search
  - `GET /api/rag/search` - Search index
  - `POST /api/rag/index` - Index document
  - `DELETE /api/rag/index` - Clear index
  - `GET /api/rag/stats` - Index statistics

#### Utilities
- **`utils/settings.ts`**: Secure settings persistence (`~/.card-architect/config.json`)
- **`utils/llm-prompts.ts`**: Prompt building logic, preset templates
- **`utils/diff.ts`**: Line-level diff computation
- **`utils/tokenizer.ts`**: Token counting wrapper

### Frontend (`apps/web/src/`)

#### Components
- **`SettingsModal.tsx`**: Provider configuration UI
- **`LLMAssistSidebar.tsx`**: Main assist interface with streaming
- **`DiffViewer.tsx`**: Visual diff display
- **`FieldEditor.tsx`**: Enhanced with ✨ AI button
- **`EditPanel.tsx`**: Wired up to open LLM Assist sidebar

#### Store
- **`store/llm-store.ts`**: Zustand store for LLM settings management

#### API Client
- **`lib/api.ts`**: Extended with LLM methods
  - `invokeLLM()` - Direct invocation
  - `llmAssist()` - Non-streaming assist
  - `llmAssistStream()` - Streaming assist

### Types (`packages/schemas/src/types.ts`)

All LLM-related types defined, including:
- `ProviderConfig`, `LLMSettings`, `RagConfig`
- `LLMInvokeRequest`, `LLMResponse`, `LLMStreamChunk`
- `FieldContext`, `LLMAssistRequest`, `LLMAssistResponse`
- `DiffOperation`, `ApplyAction`

## Usage Examples

### Example 1: Tighten Description

1. Click ✨ AI button next to Description field
2. Select "Tighten" preset
3. Set target tokens to 150
4. Click "Run"
5. Review diff and token delta
6. Click "Replace" to apply

### Example 2: Generate Alternate Greetings

1. Click ✨ AI next to First Message field
2. Select "Gen Alts" preset
3. Set count to 3
4. Click "Run"
5. Review generated greetings
6. Click "Append" to add to alternate greetings list

### Example 3: Custom Instruction

1. Open LLM Assist for any field
2. Enter custom instruction: "Rewrite in a more mysterious tone, emphasizing shadows and secrets"
3. Adjust temperature to 0.9 for more creativity
4. Click "Run"
5. Review and apply

## Prompting Strategy

### System Message
```
You are an expert CCv2/CCv3 character card editor. Obey style/format rules strictly.
If asked to rewrite, preserve character voice and factual details.
Return only the rewritten text unless otherwise requested.

FORMATTING RULES:
- Respect CCv2/CCv3 format and placeholders {{char}} / {{user}}.
- For dialogue: Use "quoted dialogue" for speech and *italic actions* for actions.
- Keep consistent tense (usually present tense for character descriptions).
- Preserve line breaks and paragraph structure.
- Do not add meta-commentary or explanations unless requested.
```

### User Message Template
```
TASK: <instruction>

TARGET_FIELD: <field_name>
SPEC: CCv2/CCv3

CARD_CONTEXT: (optional)
- description: ...
- personality: ...

ACTIVE_LORE_ENTRIES: (optional)
1. ...

REFERENCE_DOCUMENTATION: (optional from RAG)
[Source: ...]
...

TEXT:
<field content>
```

## Security

- API keys stored in `~/.card-architect/config.json` with `chmod 600`
- Keys never exposed to frontend (redacted in GET responses)
- Backend proxies all LLM requests
- Keys never written to exports/backups

## Performance

- **Streaming**: Real-time token display during generation
- **Token Counting**: Fast client-side estimation via BPE approximation
- **Diff Computation**: Efficient line-level algorithm
- **Concurrent Requests**: Multiple fields can be processed simultaneously

## Limitations & Future Work

### Current Limitations
1. **RAG**: Simple keyword search; no embeddings or vector similarity
2. **Tokenizer**: Approximation only; not using actual model tokenizers
3. **Diff Algorithm**: Simple line-based; could be enhanced with word-level diffs
4. **Apply Actions**: "Insert as new alt greeting" not fully wired up

### Planned Enhancements
1. **Vector RAG**: Integrate proper embedding models (sentence-transformers) and vector DB (Chroma/Pinecone)
2. **Real Tokenizers**: Use HuggingFace tokenizers via WASM for accurate counts
3. **Batch Operations**: Process multiple fields in one request
4. **Version Control**: Automatic snapshots before LLM edits
5. **Prompt Library**: Save and share custom prompts
6. **Context Window Management**: Smart truncation when approaching token limits

## API Reference

### POST /api/llm/assist

**Request:**
```json
{
  "providerId": "provider-123",
  "model": "gpt-4",
  "instruction": "Tighten to 200 tokens",
  "context": {
    "fieldName": "description",
    "currentValue": "...",
    "selection": null,
    "spec": "v3"
  },
  "preset": {
    "operation": "tighten",
    "params": { "tokenTarget": 200 }
  },
  "temperature": 0.7,
  "maxTokens": 2048,
  "stream": true
}
```

**Response (streaming):**
```
data: {"content": "chunk", "done": false}
data: {"content": "chunk", "done": false}
data: {"done": true, "assistResponse": {...}}
```

**Response (non-streaming):**
```json
{
  "original": "...",
  "revised": "...",
  "diff": [{"type": "add", "value": "...", "lineNumber": 1}],
  "tokenDelta": {
    "before": 300,
    "after": 200,
    "delta": -100
  },
  "metadata": {
    "provider": "openai",
    "model": "gpt-4",
    "temperature": 0.7,
    "promptTokens": 150,
    "completionTokens": 200
  }
}
```

## Testing

### Manual Testing Checklist

- [ ] Configure OpenAI provider with valid API key
- [ ] Test connection succeeds
- [ ] Open LLM Assist on description field
- [ ] Run "Tighten" preset
- [ ] Verify streaming works
- [ ] Check diff display
- [ ] Apply changes and verify field updates
- [ ] Test non-streaming mode
- [ ] Configure Anthropic provider
- [ ] Repeat tests with Anthropic
- [ ] Test custom instructions
- [ ] Verify RAG toggle (if sources configured)
- [ ] Test all preset operations
- [ ] Verify settings persistence across restarts

## Troubleshooting

### "Provider not found"
- Ensure you've added at least one provider in Settings
- Click "Save" after adding a provider

### "Test connection failed"
- Verify API key is correct
- Check base URL is correct (no trailing slash)
- For Anthropic, ensure anthropic-version is set
- Check network connectivity

### "Stream not working"
- Verify `streamDefault` is enabled for provider
- Check browser console for errors
- Try non-streaming mode

### "Token counts seem wrong"
- Current implementation uses rough approximation
- Actual model tokenizers may differ
- Use for relative comparison, not absolute accuracy

## Credits

Developed for Card Architect by Claude (Anthropic) as specified in the LLM Assist v2.0 feature request.

## License

MIT (same as Card Architect)
