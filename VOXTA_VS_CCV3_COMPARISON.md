# Voxta Package Format vs Character Card V3 Comparison

## Overview

Both formats serve character-based AI interactions but with different scopes and capabilities. Character Card V3 focuses on individual character definitions with basic lorebook support, while Voxta extends into full interactive scenario systems with multiple characters, scripting, and events.

## Format Comparison Table

| Feature | Character Card V3 | Voxta Package |
|---------|------------------|---------------|
| **File Extension** | `.charx` (zip), `.json`, `.png` | `.voxpkg` (extracted folder structure) |
| **Scope** | Single character | Multiple characters + scenarios |
| **Specification Version** | 3.0 | Not versioned (implied 1.0) |
| **Primary Use Case** | Character roleplay | Interactive scenarios & storytelling |

## Structure Comparison

### Character Card V3 Structure
```
character.charx (zip file)
├── card.json          # Character definition
└── assets/           # Optional assets
    ├── icon.png
    └── background.jpg
```

### Voxta Package Structure
```
package.version/
├── package.json       # Package metadata
├── Characters/        # Multiple characters
│   └── {uuid}/
│       ├── character.json
│       ├── thumbnail.png
│       └── Assets/Avatars/Default/
│           └── {Emotion}_{State}_{Variant}.webp
├── Scenarios/         # Scenario definitions
│   └── {uuid}/
│       └── scenario.json
└── Books/            # Lorebooks
    └── {uuid}/
        └── book.json
```

## Field-by-Field Comparison

### Character Definition

| Field | CCV3 (`data` object) | Voxta (`character.json`) |
|-------|---------------------|---------------------------|
| **Identifier** | N/A | `Id` (UUID) |
| **Name** | `name` | `Name` |
| **Description** | `description` | `Description` (physical) |
| **Personality** | `personality` | `Personality` |
| **Backstory** | `mes_example` | `Profile` |
| **First Message** | `first_mes` | `FirstMessage` |
| **Scenario** | `scenario` | `Scenario` |
| **Example Messages** | `mes_example` | `MessageExamples` |
| **Creator** | `creator` | `Creator` |
| **Creator Notes** | `creator_notes` | `CreatorNotes` |
| **Tags** | `tags` | `Tags` |
| **Version** | `version` | `Version` (semver) |
| **Timestamps** | N/A | `DateCreated`, `DateModified` |
| **NSFW Flag** | N/A | `ExplicitContent` |
| **Language** | N/A | `Culture` |

### Unique to Character Card V3

- `alternate_greetings` - Multiple greeting options
- `system_prompt` - System-level instructions
- `post_history_instructions` - Instructions after chat history
- `nickname` - Character nickname
- `source` - Source references
- `group_only_greetings` - Group-specific greetings

### Unique to Voxta

- **Text-to-Speech Configuration** - Multiple TTS voices and services
- **Chat Settings**:
  - `ChatStyle`
  - `EnableThinkingSpeech`
  - `NotifyUserAwayReturn`
  - `TimeAware`
  - `UseMemory`
  - `MaxTokens`/`MaxSentences`
- **Avatar System** - Emotion-based sprite animations
- **Scripting Support** - JavaScript/TypeScript integration
- **Package References** - `PackageId`, `MemoryBooks`, `DefaultScenarios`

## Lorebook/Memory Comparison

### Character Card V3 Lorebook
```json
{
  "entries": [{
    "keys": ["keyword1", "keyword2"],
    "content": "Entry content",
    "enabled": true,
    "insertion_order": 100,
    "decorators": {}
  }]
}
```

### Voxta Memory Book
```json
{
  "Items": [{
    "Id": "uuid",
    "Keywords": ["keyword1", "keyword2"],
    "Text": "Entry content",
    "Weight": 0,
    "CreatedAt": "ISO 8601",
    "LastUpdated": "ISO 8601"
  }]
}
```

## Asset Management

### Character Card V3
- Simple asset array with type/URI
- Basic types: `icon`, `background`
- Embedded in CHARX zip or referenced

### Voxta
- Structured avatar system
- Emotion states: 11 emotions × 3 states × multiple variants
- WebP format for efficiency
- Organized directory hierarchy

## Advanced Features Comparison

| Feature | CCV3 | Voxta |
|---------|------|-------|
| **Multi-character Support** | ❌ | ✅ |
| **Scenario System** | ❌ | ✅ |
| **Event-driven Scripting** | ❌ | ✅ (JavaScript API) |
| **Dynamic Avatars** | ❌ | ✅ (Emotion/State based) |
| **TTS Integration** | ❌ | ✅ (Multiple services) |
| **Relationship Tracking** | ❌ | ✅ (Built-in variables) |
| **Soft Delete** | ❌ | ✅ (Books) |
| **UUID-based IDs** | ❌ | ✅ |
| **Package Versioning** | Per character | Package-level semver |

## Embedding & Distribution

### Character Card V3
- **PNG**: tEXt chunk embedding
- **JSON**: Direct file
- **CHARX**: ZIP archive

### Voxta
- **VOXPKG**: Compressed package
- Extracted folder structure for use
- No embedding in images

## Use Case Alignment

### Character Card V3 Best For:
- Simple character definitions
- Single character interactions
- Cross-platform compatibility
- Lightweight distribution
- Basic lorebook needs

### Voxta Best For:
- Complex multi-character scenarios
- Interactive storytelling
- Games and simulations
- Dynamic event-driven narratives
- Voice-enabled applications
- Relationship simulation

## Migration Considerations

### From CCV3 to Voxta:
1. Map basic character fields directly
2. Generate UUID for character ID
3. Add default values for Voxta-specific fields
4. Convert lorebook entries to Memory Book format
5. Create minimal scenario wrapper
6. Generate avatar placeholders

### From Voxta to CCV3:
1. Extract primary character only
2. Lose scenario and scripting data
3. Lose TTS configuration
4. Flatten avatar to single image
5. Convert Memory Books to lorebook
6. Lose relationship tracking

## Conclusion

Character Card V3 provides a solid foundation for single character definitions with good cross-platform support. Voxta extends far beyond this into a comprehensive interactive scenario system, trading simplicity for powerful features like scripting, multi-character support, and dynamic events. Choose based on your application's complexity needs:

- **CCV3**: When you need simple, portable character cards
- **Voxta**: When building interactive, stateful roleplay experiences with multiple characters and complex narratives