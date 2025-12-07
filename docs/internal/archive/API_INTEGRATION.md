# Card Architect API Integration Guide

This guide explains how external systems can integrate with Card Architect to programmatically import character cards.

## Quick Start

Card Architect provides a REST API endpoint to import cards from URLs. This allows external systems to "push" cards into Card Architect without user interaction.

**Base URL:** `http://localhost:3456/api` (default development)

## Import from URL

### Endpoint

```
POST /api/import-url
```

### Request

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "url": "https://example.com/character-card.png"
}
```

### Response

**Success (201 Created):**
```json
{
  "card": {
    "meta": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Character Name",
      "spec": "v3",
      "tags": ["fantasy", "warrior"],
      "createdAt": "2025-11-18T10:30:00.000Z",
      "updatedAt": "2025-11-18T10:30:00.000Z"
    },
    "data": {
      "spec": "chara_card_v3",
      "spec_version": "3.0",
      "data": {
        "name": "Character Name",
        "description": "...",
        "personality": "...",
        "scenario": "...",
        "first_mes": "...",
        "mes_example": "...",
        "creator": "Creator Name",
        "character_version": "1.0",
        "tags": ["fantasy", "warrior"],
        "group_only_greetings": []
      }
    }
  },
  "warnings": [],
  "source": "https://example.com/character-card.png"
}
```

**Error (400/500):**
```json
{
  "error": "Failed to download file: 404 Not Found"
}
```

### Supported Formats

- **PNG**: Character cards embedded in PNG images (tEXt chunks)
- **JSON**: CCv2 or CCv3 format JSON files
- **CHARX**: Character card exchange format (ZIP with assets)

### Requirements

- URL must use HTTP or HTTPS protocol
- URL must point to a direct download (not a webpage)
- File must be a valid character card format
- Server must be running and accessible

## Integration Examples

### JavaScript/TypeScript

```javascript
/**
 * Import a character card from a URL
 * @param {string} cardUrl - Direct URL to PNG, JSON, or CHARX file
 * @param {string} apiBase - Card Architect API base URL
 * @returns {Promise<Object>} Import result with card data
 */
async function importCard(cardUrl, apiBase = 'http://localhost:3456/api') {
  const response = await fetch(`${apiBase}/import-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: cardUrl }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Import failed');
  }

  return await response.json();
}

// Usage
importCard('https://example.com/character.png')
  .then(result => {
    console.log('✓ Card imported:', result.card.meta.name);
    console.log('  ID:', result.card.meta.id);
    console.log('  Format:', result.card.meta.spec.toUpperCase());
    if (result.warnings.length > 0) {
      console.warn('  Warnings:', result.warnings);
    }
  })
  .catch(err => {
    console.error('✗ Import failed:', err.message);
  });
```

### Python

```python
import requests
from typing import Dict, Any

def import_card(card_url: str, api_base: str = 'http://localhost:3456/api') -> Dict[str, Any]:
    """
    Import a character card from a URL

    Args:
        card_url: Direct URL to PNG, JSON, or CHARX file
        api_base: Card Architect API base URL

    Returns:
        Dict containing import result with card data

    Raises:
        Exception: If import fails
    """
    response = requests.post(
        f'{api_base}/import-url',
        json={'url': card_url},
        headers={'Content-Type': 'application/json'}
    )

    if response.status_code != 201:
        error = response.json()
        raise Exception(error.get('error', 'Import failed'))

    return response.json()

# Usage
try:
    result = import_card('https://example.com/character.png')
    print(f"✓ Card imported: {result['card']['meta']['name']}")
    print(f"  ID: {result['card']['meta']['id']}")
    print(f"  Format: {result['card']['meta']['spec'].upper()}")
    if result['warnings']:
        print(f"  Warnings: {result['warnings']}")
except Exception as e:
    print(f"✗ Import failed: {e}")
```

### cURL

```bash
#!/bin/bash

# Simple import
curl -X POST http://localhost:3456/api/import-url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/character.png"}'

# With error handling and pretty output
curl -X POST http://localhost:3456/api/import-url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/character.png"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  | jq .
```

### PowerShell

```powershell
function Import-CharacterCard {
    param(
        [Parameter(Mandatory=$true)]
        [string]$CardUrl,

        [string]$ApiBase = "http://localhost:3456/api"
    )

    $body = @{
        url = $CardUrl
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod `
            -Uri "$ApiBase/import-url" `
            -Method Post `
            -ContentType "application/json" `
            -Body $body

        Write-Host "✓ Card imported: $($response.card.meta.name)" -ForegroundColor Green
        Write-Host "  ID: $($response.card.meta.id)"
        Write-Host "  Format: $($response.card.meta.spec.ToUpper())"

        if ($response.warnings.Count -gt 0) {
            Write-Warning "Warnings: $($response.warnings -join ', ')"
        }

        return $response
    }
    catch {
        Write-Error "✗ Import failed: $_"
        throw
    }
}

# Usage
Import-CharacterCard -CardUrl "https://example.com/character.png"
```

## Use Cases

### 1. Character Hub Integration

Allow users to import cards directly from a character database:

```javascript
// User clicks "Import to Card Architect" button on character page
function importToCardArchitect(characterId) {
  const cardUrl = `https://characterhub.example.com/cards/${characterId}/download.png`;

  fetch('http://localhost:3456/api/import-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: cardUrl })
  })
  .then(response => response.json())
  .then(result => {
    alert(`Card "${result.card.meta.name}" imported successfully!`);
    // Optionally open Card Architect window
    window.open('http://localhost:8765', '_blank');
  })
  .catch(err => alert('Import failed: ' + err.message));
}
```

### 2. Discord Bot Integration

Allow Discord users to import cards via bot commands:

```javascript
// Discord bot command: !import <url>
client.on('messageCreate', async (message) => {
  if (!message.content.startsWith('!import ')) return;

  const url = message.content.slice(8).trim();

  try {
    const response = await fetch('http://localhost:3456/api/import-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const result = await response.json();

    if (!response.ok) {
      message.reply(`❌ Import failed: ${result.error}`);
      return;
    }

    message.reply(
      `✅ Card "${result.card.meta.name}" imported successfully!\n` +
      `Format: ${result.card.meta.spec.toUpperCase()}\n` +
      `ID: ${result.card.meta.id}`
    );
  } catch (err) {
    message.reply(`❌ Error: ${err.message}`);
  }
});
```

### 3. Browser Extension

Create a browser extension to import cards from any website:

```javascript
// Content script - adds "Import to Card Architect" to card images
document.querySelectorAll('img.character-card').forEach(img => {
  const button = document.createElement('button');
  button.textContent = 'Import to Card Architect';
  button.onclick = async () => {
    try {
      const response = await fetch('http://localhost:3456/api/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: img.src })
      });

      const result = await response.json();
      alert(`✓ Imported: ${result.card.meta.name}`);
    } catch (err) {
      alert(`✗ Failed: ${err.message}`);
    }
  };
  img.parentElement.appendChild(button);
});
```

### 4. Automated Card Generation

Generate cards programmatically and import them:

```python
import json
import requests

def generate_and_import_card():
    # Generate card data
    card_data = {
        "spec": "chara_card_v3",
        "spec_version": "3.0",
        "data": {
            "name": "Generated Character",
            "description": "An AI-generated character",
            "personality": "Friendly and helpful",
            "scenario": "Modern day setting",
            "first_mes": "Hello! I'm a generated character.",
            "mes_example": "",
            "creator": "Auto Generator",
            "character_version": "1.0",
            "tags": ["generated", "test"],
            "group_only_greetings": []
        }
    }

    # Save to temporary web-accessible location
    card_url = upload_to_storage(card_data)  # Your storage service

    # Import to Card Architect
    response = requests.post(
        'http://localhost:3456/api/import-url',
        json={'url': card_url}
    )

    if response.status_code == 201:
        result = response.json()
        print(f"✓ Card imported: {result['card']['meta']['id']}")
        return result['card']['meta']['id']
    else:
        raise Exception(response.json()['error'])
```

## Error Handling

Common errors and how to handle them:

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid URL provided` | Malformed URL | Validate URL format before sending |
| `Only HTTP and HTTPS URLs are supported` | Non-HTTP protocol (ftp://, file://, etc.) | Use HTTP/HTTPS only |
| `Failed to download file: 404 Not Found` | URL doesn't exist | Verify URL is accessible |
| `Unsupported file type` | Not PNG/JSON/CHARX | Use supported formats only |
| `No character card data found in PNG` | PNG doesn't contain card metadata | Verify PNG has embedded card data |
| `Card validation failed` | Invalid card structure | Check card format matches CCv2/CCv3 spec |
| `PNG too large` | File exceeds size limit | Compress or resize image |

## Best Practices

1. **Validate URLs** before sending to avoid unnecessary API calls
2. **Handle errors gracefully** with user-friendly messages
3. **Check response status codes** (201 = success, 400/500 = error)
4. **Show warnings to users** if the response includes warnings
5. **Use HTTPS URLs** when possible for security
6. **Implement retry logic** for transient network errors
7. **Add timeout handling** for slow downloads
8. **Log failed imports** for debugging

## Security Considerations

- The API only accepts HTTP/HTTPS URLs (no file://, ftp://, etc.)
- URLs are downloaded server-side (not exposed to client)
- All cards are validated before import
- HTML in card fields is sanitized during preview
- No authentication required for local deployment
- For production: consider adding API keys or CORS restrictions

## Testing

Test the endpoint with a sample card:

```bash
# Test with a valid card URL
curl -X POST http://localhost:3456/api/import-url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/test-card.png"}' \
  -v

# Expected: 201 Created with card data
```

## Need Help?

- Check server logs for detailed error messages
- Verify Card Architect is running on the expected port
- Test URL accessibility with curl or wget
- Validate card format using the CCv2/CCv3 spec
- Report issues at: https://github.com/anthropics/card-architect/issues

## Related Endpoints

- `POST /api/import` - Import from file upload (multipart/form-data)
- `POST /api/import-multiple` - Import multiple files at once
- `GET /api/cards` - List all imported cards
- `GET /api/cards/:id` - Get specific card details
- `POST /api/cards/:id/export?format=png` - Export card as PNG
