# Voxta Package Format Specification v1.0

## Overview

The Voxta Package Format (`.voxpkg`) is a comprehensive character and scenario format designed for interactive AI roleplay and storytelling. It extends beyond simple character cards to include full scenarios with scripting, events, multiple characters, lorebooks, and assets. This specification documents the structure and components of Voxta packages.

## Package Structure

A Voxta package is typically distributed as a `.voxpkg` file, which when extracted reveals the following directory structure:

```
package_name.version/
├── package.json           # Package metadata
├── Characters/            # Character definitions
│   └── {character-id}/
│       ├── character.json
│       ├── thumbnail.png
│       └── Assets/
│           └── Avatars/
│               └── Default/
│                   ├── {Emotion}_{State}_{Variant}.webp
│                   └── ...
├── Scenarios/             # Scenario definitions
│   └── {scenario-id}/
│       └── scenario.json
└── Books/                # Lorebooks/Memory books
    └── {book-id}/
        └── book.json
```

## File Formats

### 1. Package Metadata (`package.json`)

The root package.json file contains metadata about the entire package:

```json
{
  "$type": "package",
  "Id": "uuid-v4",
  "Name": "string",
  "Version": "semver (e.g., 1.2.0)",
  "Description": "string",
  "Creator": "string",
  "ExplicitContent": boolean,
  "EntryResource": {
    "Kind": integer,  // Resource type (1=Character, 3=Scenario)
    "Id": "uuid-v4"   // References character or scenario ID
  },
  "ThumbnailResource": {
    "Kind": integer,
    "Id": "uuid-v4"
  },
  "DateCreated": "ISO 8601 datetime",
  "DateModified": "ISO 8601 datetime"
}
```

### 2. Character Definition (`character.json`)

Characters are the core entities in Voxta, containing comprehensive personality and configuration data:

```json
{
  "$type": "character",
  "Id": "uuid-v4",
  "Name": "string",
  "Version": "semver",
  "PackageId": "uuid-v4",  // Optional, links to parent package

  // Core Character Info
  "Description": "string",  // Physical description
  "Personality": "string",  // Personality traits
  "Profile": "string",      // Detailed character profile/backstory
  "Scenario": "string",     // Initial scenario context
  "FirstMessage": "string", // Character's opening message
  "MessageExamples": "string", // Example dialogue

  // Metadata
  "Creator": "string",
  "CreatorNotes": "string",
  "Tags": ["string", ...],
  "ExplicitContent": boolean,
  "Culture": "locale (e.g., en-US)",

  // References
  "MemoryBooks": ["book-id", ...],  // Associated lorebooks
  "DefaultScenarios": ["scenario-id", ...],

  // Text-to-Speech Configuration
  "TextToSpeech": [
    {
      "Voice": {
        "parameters": {
          "VoiceBackend": "string",
          "VoiceId": "string",
          "Gender": "string",
          "Filename": "string",
          "FinetuneVoice": "string"
        },
        "label": "string"
      },
      "Service": {
        "ServiceName": "string",
        "ServiceId": "uuid-v4"
      }
    }
  ],

  // AI Generation Settings
  "ChatStyle": integer,  // 0=Default, 1=?, 2=?
  "EnableThinkingSpeech": boolean,
  "NotifyUserAwayReturn": boolean,
  "TimeAware": boolean,
  "UseMemory": boolean,
  "MaxTokens": integer,
  "MaxSentences": integer,
  "SystemPromptOverrideType": integer,

  // Advanced Features
  "Scripts": [],  // Character-specific scripts
  "Augmentations": [],

  // Thumbnail
  "Thumbnail": {
    "RandomizedETag": "string",
    "ContentType": "mime-type"
  },

  // Timestamps
  "DateCreated": "ISO 8601 datetime",
  "DateModified": "ISO 8601 datetime"
}
```

### 3. Scenario Definition (`scenario.json`)

Scenarios define interactive experiences with multiple characters, events, and scripting:

```json
{
  "$type": "scenario",
  "Id": "uuid-v4",
  "Name": "string",
  "Version": "semver",
  "ParentId": "uuid-v4",  // Optional parent scenario
  "PackageId": "uuid-v4",
  "Client": "string (e.g., Voxta.Talk)",

  // Basic Info
  "Creator": "string",
  "Description": "string",

  // Scripting System
  "SharedScripts": [
    {
      "Name": "string",
      "Content": "JavaScript/TypeScript code"
    }
  ],

  // Event System
  "Actions": [
    {
      "Name": "string",
      "Layer": "string",
      "Arguments": [],
      "FinalLayer": boolean,
      "Timing": integer,
      "Description": "string",
      "Disabled": boolean,
      "Once": boolean,
      "FlagsFilter": "string",  // Condition flags
      "Effect": {
        "SetFlags": ["flag", "!flag", ...],
        "MaxSentences": integer,
        "MaxTokens": integer
      }
    }
  ],

  // Additional scenario configuration...
}
```

### 4. Lorebook/Memory Book (`book.json`)

Books contain contextual information and world-building elements:

```json
{
  "$type": "book",
  "Id": "uuid-v4",
  "Name": "string",
  "Version": "semver",
  "PackageId": "uuid-v4",
  "Description": "string",
  "ExplicitContent": boolean,
  "Creator": "string",

  "Items": [
    {
      "Id": "uuid-v4",
      "Keywords": ["string", ...],
      "Text": "string",
      "Weight": number,
      "Deleted": boolean,  // Soft delete flag
      "CreatedAt": "ISO 8601 datetime",
      "LastUpdated": "ISO 8601 datetime",
      "DeletedAt": "ISO 8601 datetime"  // Optional
    }
  ],

  "DateCreated": "ISO 8601 datetime",
  "DateModified": "ISO 8601 datetime"
}
```

## Asset Organization

### Character Avatars

Character avatars are organized by emotion and state:

**Naming Convention:** `{Emotion}_{State}_{Variant}.webp`

**Emotions:**
- Neutral
- Smile
- Laugh
- Love
- Horny
- Angry
- Unhappy
- Cry
- Fear
- Question
- Surprise

**States:**
- Idle
- Talking
- Thinking

**Variants:** 01, 02, 03, etc.

**Example:** `Smile_Talking_02.webp`

## Scripting System

Voxta includes a JavaScript/TypeScript-based scripting system for dynamic scenarios:

### Core API

```javascript
import { chat } from "@voxta";

// Event Handling
chat.addEventListener("start", (e) => {
  // Initialize scenario
});

// Variables
chat.variables.varName = value;
chat.get("varName");
chat.set("varName", value);

// Flags (Boolean states)
chat.setFlag("flagName");
chat.unsetFlag("flagName");
chat.hasFlag("flagName");

// Roles (Character management)
chat.setRoleEnabled("roleName", boolean);

// Messaging
chat.secret("message");  // Hidden AI context
```

### Common Patterns

1. **Character Presence Management:**
   - Use flags like `p_{character}` to track presence
   - Use `m_{character}` for first meeting flags

2. **Relationship Tracking:**
   - Variables like `rm_{character}` for relationship meters
   - Flags like `r_{character}_f` for friendship status

3. **Event Triggers:**
   - Mean Time To Happen (MTTH) for probabilistic events
   - Cooldown flags (`cd_{character}`) for timed restrictions

## Resource Types

The `Kind` field in resource references indicates the resource type:

- `1` = Character
- `3` = Scenario

## Data Types

- **UUID**: Version 4 UUID strings
- **Datetime**: ISO 8601 format with timezone
- **Version**: Semantic versioning (X.Y.Z)
- **Locale**: Standard locale codes (e.g., "en-US")

## File Size Considerations

- Character thumbnails: Typically PNG format, ~500KB-1MB
- Avatar sprites: WebP format for efficiency, ~50-100KB each
- Scenarios can be large (>70KB JSON) due to extensive scripting

## Compatibility Notes

1. The format shares some similarities with Character Card V3 (.charx) but includes significant extensions
2. Voxta packages support multiple characters per package
3. Advanced features include event systems, scripting, and TTS configuration
4. The format is designed for interactive, stateful roleplay scenarios

## Version History

- v1.0.0 - Initial specification based on analysis of Voxta packages

---

*This specification is derived from analysis of Voxta package files and may not represent all possible features or fields in the format.*