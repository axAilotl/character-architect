# Character Architect Refactoring Plan

**Created:** December 2024
**Updated:** December 9, 2024
**Status:** IN PROGRESS
**Based On:** CODE_ANALYSIS_2024-12.md, 12912_CODE_REVIEW.md (3rd Party)

---

## Latest Updates

### December 9, 2024 (Night - Continued)
- **Phase 1: Security Hardening - COMPLETED** ✅
  - Created `apps/api/src/utils/ssrf-protection.ts`:
    - URL validation for SSRF attacks
    - Private IP blocking (127.x, 10.x, 192.168.x, etc.)
    - Metadata endpoint protection (169.254.169.254)
    - Configurable allowed LLM hosts via `ALLOWED_LLM_HOSTS` env var
  - Created `apps/api/src/middleware/rate-limiter.ts`:
    - In-memory sliding window rate limiter
    - Per-IP tracking with configurable window/max
    - Proper rate limit headers (X-RateLimit-*)
    - Configurable via `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`
  - Updated `apps/api/src/config.ts`:
    - Added `security` configuration section
    - CORS origins via `CORS_ORIGINS` (default: localhost)
    - Rate limiting on by default (100 req/min)
    - SSRF protection on by default
  - Updated `apps/api/src/app.ts`:
    - Hardened CORS (no more `origin: true`)
    - Integrated rate limiter hook
  - Protected routes:
    - LLM routes: SSRF validation on provider baseURL
    - Web import: URL validation before fetching

### December 9, 2024 (Late Night)
- **Phase 3.2: Persistence Adapter - COMPLETED** ✅
  - Created `apps/web/src/adapters/persistence/` with:
    - `types.ts` - Core interface definition
    - `server-adapter.ts` - Server API implementation
    - `local-adapter.ts` - IndexedDB/localStorage implementation
    - `index.ts` - Factory and singleton export
  - Refactored `template-store.ts` as demonstration:
    - **Reduced from 552 lines to 257 lines** (-53%)
    - Eliminated 15+ deployment mode checks
    - Clean, mode-agnostic code via adapter pattern
  - All builds passing ✅

### December 9, 2024 (Evening)
- **API Integration Tests:** Created comprehensive test suite with real fixtures
  - 12/12 tests passing ✅
  - Found and fixed: Main icon duplication in Voxta exports
  - Tested: PNG, CHARX, Voxta imports; cross-format exports; round-trip integrity
  - Test script: `scripts/api-integration-test.ts`
- **Bug Fixed:** `@character-foundry/voxta` main icon duplication
  - Was duplicating in both `thumbnail.png` and `Assets/Avatars/Default/main.webp`
  - Fix applied to source - awaiting package publish
- **Gap Identified:** Scenario data lost on Voxta import
  - Primitives being updated to support scenarios without package.json
  - **ON HOLD** until primitive updates complete
- **All package tests passing:** 22 tasks, 180+ tests ✅

### December 9, 2024 (Earlier)
- **ComfyUI:** Scrapped and replaced with iframe approach (completed separately)
- **Security packages:** Updated all @character-foundry packages to security versions
- **GitHub Issues:** All 4 primitive package issues filed (#6-#9)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Guiding Principles](#2-guiding-principles)
3. [Dependency Graph](#3-dependency-graph)
4. [Phase 0: Primitive Package Requests](#phase-0-primitive-package-requests)
5. [Phase 1: Security Hardening](#phase-1-security-hardening)
6. [Phase 2: Backend Consolidation](#phase-2-backend-consolidation)
7. [Phase 3: Frontend Consolidation](#phase-3-frontend-consolidation)
8. [Phase 4: Infrastructure Improvements](#phase-4-infrastructure-improvements)
9. [Phase 5: Cleanup & Optimization](#phase-5-cleanup--optimization)
10. [Testing Strategy](#testing-strategy)
11. [Progress Tracking](#progress-tracking)

---

## 1. Executive Summary

This plan addresses findings from two independent code reviews:
- **Internal Analysis:** Focused on duplication, complexity, and shared primitives
- **3rd Party Review:** Focused on architecture, UI patterns, and security

### Total Scope
| Category | Estimated Lines Affected | Risk Level |
|----------|-------------------------|------------|
| Security Hardening | ~500 new lines | HIGH |
| Backend Consolidation | ~2,500 lines refactored | MEDIUM |
| Frontend Consolidation | ~1,500 lines refactored | MEDIUM |
| Infrastructure | ~800 lines refactored | LOW |
| Cleanup (ComfyUI) | ~1,841 lines removed | LOW |

### Critical Path
```
Phase 0 (Primitives) ──┬──> Phase 1 (Security) ──> Phase 2 (Backend)
                       │
                       └──> Phase 3 (Frontend) ──> Phase 4 (Infrastructure)
                                                          │
                                                          v
                                                   Phase 5 (Cleanup)
```

---

## 2. Guiding Principles

### Code Quality Standards
- [ ] **No `any` types** - All code must be properly typed
- [ ] **No shortcuts** - Proper abstractions over quick fixes
- [ ] **Test first** - Write tests before refactoring
- [ ] **Incremental** - Each change must leave codebase in working state
- [ ] **Backwards compatible** - Deprecate before removing

### Definition of Done (per task)
1. Implementation complete
2. Unit tests passing (>80% coverage for new code)
3. Integration tests passing
4. E2E tests passing (no regressions)
5. TypeScript strict mode passing
6. Lint passing
7. Code reviewed
8. Documentation updated

---

## 3. Dependency Graph

### Blocking Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRIMITIVE PACKAGES                            │
│  @character-foundry/core, @character-foundry/schemas            │
│  (Must be updated BEFORE any refactoring)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY (Phase 1)                            │
│  Auth, CORS, Rate Limiting, SSRF Protection                     │
│  (Must complete BEFORE feature work)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│   BACKEND (Phase 2)      │    │   FRONTEND (Phase 3)     │
│   CardService            │    │   EditPanel refactor     │
│   Format Handlers        │    │   Store consolidation    │
│   Normalization          │    │   Persistence adapter    │
└──────────────────────────┘    └──────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 INFRASTRUCTURE (Phase 4)                         │
│  Repository patterns, Transaction support                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLEANUP (Phase 5)                             │
│  ComfyUI removal, Dead code elimination                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Primitive Package Requests

**Status:** NOT STARTED
**Blocking:** All other phases
**Owner:** TBD

### Rationale
Before refactoring, we must ensure shared primitives exist in `@character-foundry/*` packages. This prevents:
1. Duplicating work that will be replaced by primitives
2. Creating abstractions that conflict with future primitive APIs
3. Having to refactor twice

### GitHub Issues to Create

#### Issue 0.1: @character-foundry/core - Utility Functions

**Repository:** character-foundry/character-foundry
**Package:** @character-foundry/core
**Priority:** HIGH

```markdown
## Feature Request: Add Utility Functions to @character-foundry/core

### Background
Character Architect has identified several utility functions that are duplicated
across the codebase and would benefit other projects (hosting platform, archive tool).

### Requested Functions

#### 1. UUID Generation
```typescript
/**
 * Generate a UUID v4 that works in both Node.js and browser environments
 * Falls back gracefully in non-secure contexts (HTTP)
 */
export function generateUUID(): string;
```

**Current duplicates:**
- `character-architect/apps/web/src/lib/client-import.ts:17-27`
- `@character-foundry/voxta/src/writer.ts:13-19`

#### 2. Data URL Utilities
```typescript
/**
 * Convert Uint8Array to data URL (chunk-safe for large buffers)
 * Handles buffers >1MB without stack overflow
 */
export function toDataURL(buffer: Uint8Array, mimeType: string): string;

/**
 * Parse data URL back to buffer and mime type
 */
export function fromDataURL(dataUrl: string): {
  buffer: Uint8Array;
  mimeType: string;
};
```

**Current duplicates:**
- `character-architect/apps/web/src/lib/client-import.ts:84-94`
- Various inline implementations

#### 3. Base64 Utilities (chunk-safe)
```typescript
/**
 * Encode Uint8Array to base64 string (chunk-safe for large buffers)
 */
export function uint8ArrayToBase64(buffer: Uint8Array): string;

/**
 * Decode base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array;
```

### Acceptance Criteria
- [ ] All functions work in Node.js and browser environments
- [ ] Functions handle large buffers (>10MB) without stack overflow
- [ ] Full TypeScript types (no `any`)
- [ ] Unit tests with >90% coverage
- [ ] JSDoc documentation

### Benefits
- Eliminates 4+ duplicate implementations across projects
- Consistent behavior across all character-foundry tools
- Tested edge cases (large files, non-secure contexts)
```

---

#### Issue 0.2: @character-foundry/schemas - CardNormalizer

**Repository:** character-foundry/character-foundry
**Package:** @character-foundry/schemas
**Priority:** HIGH

```markdown
## Feature Request: Add CardNormalizer to @character-foundry/schemas

### Background
Card normalization logic is currently duplicated in 5+ locations across Character
Architect. This logic handles malformed data from various sources (ChubAI,
CharacterTavern, RisuAI, etc.) and should be centralized.

### Requested API

```typescript
/**
 * Normalizes card data to conform to CCv2 or CCv3 schema
 * Handles common issues from various export sources
 */
export class CardNormalizer {
  /**
   * Normalize card data to valid schema format
   * - Fixes spec/spec_version values
   * - Moves misplaced fields to correct locations
   * - Adds missing required fields with defaults
   * - Handles hybrid formats (fields at root AND in data object)
   */
  static normalize(data: unknown, spec: 'v2' | 'v3'): CCv2Data | CCv3Data;

  /**
   * Normalize lorebook entries specifically
   * - Ensures required fields exist (keys, content, enabled, insertion_order)
   * - Converts numeric position values to string enums
   * - Moves V3-only fields to extensions for V2 compatibility
   */
  static normalizeLorebookEntries(book: CharacterBook): CharacterBook;

  /**
   * Fix CharacterTavern timestamp format (milliseconds -> seconds)
   * CCv3 spec requires Unix timestamp in seconds
   */
  static fixTimestamps(data: CCv3Data): CCv3Data;

  /**
   * Normalize a single lorebook entry
   */
  static normalizeEntry(entry: unknown): LorebookEntry;
}
```

### Current Duplicates
1. `apps/api/src/routes/import-export.ts:36-203` (main implementation)
2. `apps/api/src/routes/cards.ts` (inline calls)
3. `apps/api/src/services/web-import/utils.ts` (partial)
4. `apps/api/src/services/web-import/handlers/character-tavern.ts` (format-specific)
5. Various client-side normalizations

### Known Edge Cases to Handle
1. ChubAI exports with `spec: "chara_card_v2"` but fields at root level
2. CharacterTavern timestamps in milliseconds instead of seconds
3. Numeric `position` values (0, 1, 2) instead of string enums
4. V3 fields in V2 cards (should move to extensions)
5. `character_book: null` (should be deleted, not null)
6. Missing `extensions` object on lorebook entries

### Acceptance Criteria
- [ ] Handles all known edge cases from various sources
- [ ] Pure functions (no side effects)
- [ ] Full TypeScript types (no `any`)
- [ ] Unit tests covering each edge case
- [ ] Does not throw on malformed input (returns best-effort result)

### Benefits
- Single source of truth for normalization
- All character-foundry tools get consistent import behavior
- New edge cases fixed in one place benefit all tools
```

---

#### Issue 0.3: @character-foundry/schemas - Spec Detection Enhancement

**Repository:** character-foundry/character-foundry
**Package:** @character-foundry/schemas
**Priority:** MEDIUM

```markdown
## Feature Request: Enhanced Spec Detection

### Background
Current `detectSpec()` function exists but may not handle all edge cases found
in the wild. Need to ensure robust detection for normalization pipeline.

### Requested Enhancement

```typescript
/**
 * Detect card specification version from raw data
 * Returns null if data is not a valid card format
 */
export function detectSpec(data: unknown): 'v1' | 'v2' | 'v3' | null;

/**
 * Detailed spec detection with confidence and reasoning
 */
export function detectSpecDetailed(data: unknown): {
  spec: 'v1' | 'v2' | 'v3' | null;
  confidence: 'high' | 'medium' | 'low';
  indicators: string[];  // What fields/values indicated this spec
  warnings: string[];    // Anomalies detected
};
```

### Detection Criteria

**V3 Indicators:**
- `spec === 'chara_card_v3'`
- `spec_version` starts with '3'
- Has V3-only fields: `group_only_greetings`, `creation_date`, `modification_date`

**V2 Indicators:**
- `spec === 'chara_card_v2'`
- `spec_version` starts with '2'
- Has wrapped format with `data` object
- Has `character_book` with V2 schema

**V1 Indicators:**
- No `spec` field
- Has flat structure with `name`, `description`, `personality` at root
- No `data` wrapper

### Acceptance Criteria
- [ ] Correctly identifies spec from all known sources
- [ ] Returns `null` for non-card data (not throws)
- [ ] Detailed function provides debugging info
- [ ] Unit tests for each source format
```

---

#### Issue 0.4: @character-foundry/media - Image Utilities (New Package)

**Repository:** character-foundry/character-foundry
**Package:** @character-foundry/media (NEW)
**Priority:** MEDIUM

```markdown
## Feature Request: New @character-foundry/media Package

### Background
Image processing utilities are duplicated across Character Architect. These would
benefit hosting platform and archive tool.

### Requested API

```typescript
/**
 * Options for thumbnail creation
 */
export interface ThumbnailOptions {
  maxSize?: number;        // Default: 400
  format?: 'webp' | 'jpeg' | 'png';  // Default: 'webp'
  quality?: number;        // Default: 0.8
  fallbackFormat?: 'jpeg' | 'png';   // If primary format unsupported
}

/**
 * Create a thumbnail from image data
 * Works in both Node.js (sharp) and browser (canvas) environments
 */
export function createThumbnail(
  imageData: Uint8Array,
  options?: ThumbnailOptions
): Promise<Uint8Array>;

/**
 * Get image dimensions without decoding full image
 */
export function getImageDimensions(
  buffer: Uint8Array
): { width: number; height: number; format: string } | null;

/**
 * Detect image format from magic bytes
 */
export function detectImageFormat(
  buffer: Uint8Array
): 'png' | 'jpeg' | 'webp' | 'gif' | 'avif' | null;
```

### Current Duplicates
- `apps/web/src/lib/client-import.ts:100-187` (88 lines)
- `apps/web/src/lib/web-import-handler.ts:49-111` (62 lines)

### Implementation Notes
- Browser: Use Canvas API with WebP/JPEG fallback
- Node.js: Use sharp (already a dependency)
- Must handle large images without memory issues
- Timeout protection for slow operations

### Acceptance Criteria
- [ ] Works in Node.js and browser
- [ ] Handles images up to 50MB
- [ ] Graceful fallback when WebP unsupported
- [ ] No `any` types
- [ ] Unit tests with real image fixtures
```

---

### Phase 0 Checklist

| Issue | Package | Status | Issue Link | PR Link | Merged |
|-------|---------|--------|------------|---------|--------|
| 0.1 | @character-foundry/core | FILED | [#6](https://github.com/character-foundry/character-foundry/issues/6) | - | - |
| 0.2 | @character-foundry/schemas | FILED | [#7](https://github.com/character-foundry/character-foundry/issues/7) | - | - |
| 0.3 | @character-foundry/schemas | FILED | [#8](https://github.com/character-foundry/character-foundry/issues/8) | - | - |
| 0.4 | @character-foundry/media | FILED | [#9](https://github.com/character-foundry/character-foundry/issues/9) | - | - |

**Issues filed:** December 9, 2024
**Phase 0 Complete When:** All issues merged (or explicitly deferred with workaround documented)

---

## Phase 1: Security Hardening

**Status:** NOT STARTED
**Blocking:** Phase 0 complete
**Priority:** CRITICAL
**Estimated Effort:** 2-3 weeks

### Rationale
The 3rd party review identified critical security vulnerabilities that must be addressed before any feature work. An insecure application should not receive new features.

### Tasks

#### 1.1 Authentication & Authorization

**Files Affected:**
- `apps/api/src/app.ts` (new middleware)
- `apps/api/src/routes/*.ts` (all routes)
- `apps/api/src/middleware/auth.ts` (new file)

**Implementation:**
```typescript
// apps/api/src/middleware/auth.ts

export interface AuthConfig {
  /** Routes that don't require authentication */
  publicRoutes: string[];
  /** Enable authentication (can be disabled for local-only mode) */
  enabled: boolean;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    roles: string[];
  };
}

/**
 * Authentication middleware
 * Supports: API key, session token, or local-only mode
 */
export function authMiddleware(config: AuthConfig): FastifyPluginCallback;
```

**Testing Plan:**
- [ ] Unit: Auth middleware rejects unauthenticated requests
- [ ] Unit: Auth middleware allows public routes
- [ ] Unit: Auth middleware validates tokens correctly
- [ ] Integration: Protected routes return 401 without auth
- [ ] Integration: Protected routes work with valid auth
- [ ] E2E: Full authentication flow

**Acceptance Criteria:**
- [ ] All write endpoints require authentication
- [ ] Read endpoints configurable (public/private)
- [ ] Local-only mode can disable auth
- [ ] No hardcoded secrets

---

#### 1.2 CORS Hardening

**Files Affected:**
- `apps/api/src/app.ts:35-88`
- `apps/api/src/config.ts`

**Current Problem:**
```typescript
// DANGEROUS: Current implementation
origin: true,  // Allows ANY origin
credentials: true
```

**Fix:**
```typescript
// apps/api/src/config.ts
export interface CorsConfig {
  /** Allowed origins (use array, not wildcard) */
  allowedOrigins: string[];
  /** Allow credentials */
  credentials: boolean;
}

// Default for development
const defaultCorsConfig: CorsConfig = {
  allowedOrigins: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
};
```

**Testing Plan:**
- [ ] Unit: CORS rejects disallowed origins
- [ ] Unit: CORS allows configured origins
- [ ] Integration: Cross-origin requests from allowed origin succeed
- [ ] Integration: Cross-origin requests from disallowed origin fail
- [ ] E2E: Web app can communicate with API

---

#### 1.3 SSRF Protection

**Files Affected:**
- `apps/api/src/routes/llm.ts:44-194`
- `apps/api/src/services/web-import/utils.ts`
- `apps/api/src/services/web-import/index.ts:112-279`
- `apps/api/src/utils/url-validator.ts` (new file)

**Implementation:**
```typescript
// apps/api/src/utils/url-validator.ts

export interface UrlValidationOptions {
  /** Allowed protocols */
  allowedProtocols: string[];  // Default: ['https:']
  /** Blocked hosts (private IPs, localhost, etc.) */
  blockedHosts: string[];
  /** Allowed host patterns (optional allowlist) */
  allowedHostPatterns?: RegExp[];
  /** Maximum redirects to follow */
  maxRedirects: number;
  /** Request timeout in ms */
  timeout: number;
  /** Maximum response size in bytes */
  maxResponseSize: number;
}

/**
 * Validate URL is safe for server-side fetch
 * Throws UrlValidationError if unsafe
 */
export function validateUrl(url: string, options: UrlValidationOptions): void;

/**
 * Safe fetch wrapper with SSRF protection
 */
export async function safeFetch(
  url: string,
  options: RequestInit & { validation?: UrlValidationOptions }
): Promise<Response>;
```

**Blocked by Default:**
- `localhost`, `127.0.0.1`, `::1`
- Private IP ranges: `10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`
- Link-local: `169.254.x.x`
- Metadata endpoints: `169.254.169.254`

**Testing Plan:**
- [ ] Unit: Rejects localhost URLs
- [ ] Unit: Rejects private IP URLs
- [ ] Unit: Rejects metadata endpoint URLs
- [ ] Unit: Allows legitimate external URLs
- [ ] Unit: Respects timeout
- [ ] Unit: Respects max response size
- [ ] Integration: LLM proxy validates URLs
- [ ] Integration: Web import validates URLs

---

#### 1.4 Rate Limiting

**Files Affected:**
- `apps/api/src/app.ts`
- `apps/api/src/middleware/rate-limit.ts` (new file)

**Implementation:**
```typescript
// apps/api/src/middleware/rate-limit.ts

export interface RateLimitConfig {
  /** Window size in ms */
  windowMs: number;
  /** Max requests per window */
  max: number;
  /** Key generator (default: IP address) */
  keyGenerator?: (request: FastifyRequest) => string;
}

export interface RateLimitTiers {
  /** Default rate limit */
  default: RateLimitConfig;
  /** Write operations (POST, PUT, DELETE) */
  write: RateLimitConfig;
  /** Expensive operations (LLM, image processing) */
  expensive: RateLimitConfig;
}

const defaultTiers: RateLimitTiers = {
  default: { windowMs: 60000, max: 100 },   // 100/min
  write: { windowMs: 60000, max: 30 },       // 30/min
  expensive: { windowMs: 60000, max: 10 },   // 10/min
};
```

**Testing Plan:**
- [ ] Unit: Rate limiter tracks requests correctly
- [ ] Unit: Rate limiter resets after window
- [ ] Integration: Returns 429 when limit exceeded
- [ ] Integration: Different tiers have different limits

---

#### 1.5 Upload Security

**Files Affected:**
- `apps/api/src/routes/assets.ts:25-192`
- `apps/api/src/utils/upload-validator.ts` (new file)

**Current Problems:**
- 300MB upload limit (too high)
- Weak MIME type validation
- SVG/HTML can contain scripts (XSS)
- Files served from static directory

**Fix:**
```typescript
// apps/api/src/utils/upload-validator.ts

export interface UploadValidationOptions {
  /** Maximum file size in bytes */
  maxSize: number;
  /** Allowed MIME types */
  allowedMimeTypes: string[];
  /** Allowed extensions */
  allowedExtensions: string[];
  /** Validate magic bytes match extension */
  validateMagicBytes: boolean;
}

const imageUploadConfig: UploadValidationOptions = {
  maxSize: 10 * 1024 * 1024,  // 10MB
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
  validateMagicBytes: true,
};

// SVG explicitly NOT allowed for untrusted uploads
// If SVG needed, sanitize with DOMPurify and serve with CSP
```

**Testing Plan:**
- [ ] Unit: Rejects oversized files
- [ ] Unit: Rejects disallowed MIME types
- [ ] Unit: Rejects mismatched magic bytes
- [ ] Unit: Rejects SVG uploads
- [ ] Integration: Upload flow with valid file succeeds
- [ ] Integration: Upload flow with invalid file fails

---

### Phase 1 Testing Summary

| Category | Test Count | Coverage Target |
|----------|------------|-----------------|
| Auth Unit Tests | 15+ | 95% |
| CORS Unit Tests | 8+ | 90% |
| SSRF Unit Tests | 20+ | 95% |
| Rate Limit Unit Tests | 10+ | 90% |
| Upload Unit Tests | 12+ | 95% |
| Integration Tests | 25+ | Key flows |
| E2E Security Tests | 10+ | Critical paths |

---

## Phase 2: Backend Consolidation

**Status:** NOT STARTED
**Blocking:** Phase 1 complete, Issues 0.1-0.3 merged
**Priority:** HIGH
**Estimated Effort:** 3-4 weeks

### Tasks

#### 2.1 CardService Implementation

**Goal:** Single service handling all card operations (create, update, normalize, validate)

**Files Affected:**
- `apps/api/src/services/card.service.ts` (new file)
- `apps/api/src/routes/cards.ts` (simplify)
- `apps/api/src/routes/import-export.ts` (simplify)

**Implementation:**
```typescript
// apps/api/src/services/card.service.ts

import { CardNormalizer, detectSpec } from '@character-foundry/schemas';

export interface CardServiceDependencies {
  cardRepo: CardRepository;
  assetRepo: AssetRepository;
  cardAssetRepo: CardAssetRepository;
}

export class CardService {
  constructor(private deps: CardServiceDependencies) {}

  /**
   * Create a card from raw data
   * Handles: spec detection, normalization, validation, storage
   */
  async createCard(
    rawData: unknown,
    options?: { originalImage?: Buffer }
  ): Promise<Card>;

  /**
   * Update card data
   * Handles: normalization, validation, version snapshot
   */
  async updateCard(
    cardId: string,
    updates: Partial<CardData>
  ): Promise<Card>;

  /**
   * Import card from various sources
   * Unified entry point for all import types
   */
  async importCard(
    source: ImportSource
  ): Promise<ImportResult>;
}

type ImportSource =
  | { type: 'png'; buffer: Buffer }
  | { type: 'charx'; buffer: Buffer }
  | { type: 'voxta'; buffer: Buffer }
  | { type: 'json'; data: unknown }
  | { type: 'url'; url: string };
```

**Testing Plan:**
- [ ] Unit: CardService.createCard normalizes data
- [ ] Unit: CardService.createCard validates data
- [ ] Unit: CardService.createCard handles V2 and V3
- [ ] Unit: CardService.updateCard creates version snapshot
- [ ] Unit: CardService.importCard handles all source types
- [ ] Integration: Import flow end-to-end
- [ ] Integration: CRUD flow end-to-end

---

#### 2.2 Format Handler Pattern

**Goal:** Break up 1,985-line import-export.ts into modular handlers

**Files Affected:**
- `apps/api/src/handlers/format-handler.interface.ts` (new)
- `apps/api/src/handlers/png-handler.ts` (new)
- `apps/api/src/handlers/charx-handler.ts` (new)
- `apps/api/src/handlers/voxta-handler.ts` (new)
- `apps/api/src/handlers/json-handler.ts` (new)
- `apps/api/src/routes/import-export.ts` (simplify to ~200 lines)

**Implementation:**
```typescript
// apps/api/src/handlers/format-handler.interface.ts

export interface FormatHandler<TOptions = unknown> {
  /** Format identifier */
  readonly format: string;

  /** File extensions this handler supports */
  readonly extensions: string[];

  /** MIME types this handler supports */
  readonly mimeTypes: string[];

  /**
   * Check if this handler can process the given data
   */
  canHandle(buffer: Buffer, filename?: string): boolean;

  /**
   * Import card data from buffer
   */
  import(
    buffer: Buffer,
    options?: TOptions
  ): Promise<FormatImportResult>;

  /**
   * Export card to this format
   */
  export(
    card: Card,
    assets: CardAssetWithDetails[],
    options?: TOptions
  ): Promise<FormatExportResult>;
}

export interface FormatImportResult {
  card: CardData;
  assets: ExtractedAsset[];
  originalImage?: Buffer;
  warnings: string[];
}

export interface FormatExportResult {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}
```

**Handler Registry:**
```typescript
// apps/api/src/handlers/index.ts

export class FormatHandlerRegistry {
  private handlers: Map<string, FormatHandler> = new Map();

  register(handler: FormatHandler): void;

  /**
   * Find handler for given buffer/filename
   */
  findHandler(buffer: Buffer, filename?: string): FormatHandler | null;

  /**
   * Get handler by format name
   */
  getHandler(format: string): FormatHandler | null;
}

// Default registry with all handlers
export const formatHandlers = new FormatHandlerRegistry()
  .register(new PngHandler())
  .register(new CharxHandler())
  .register(new VoxtaHandler())
  .register(new JsonHandler());
```

**Testing Plan:**
- [ ] Unit: Each handler's canHandle() detects correctly
- [ ] Unit: Each handler's import() parses correctly
- [ ] Unit: Each handler's export() generates valid output
- [ ] Unit: Registry finds correct handler
- [ ] Integration: Import with each format
- [ ] Integration: Export to each format
- [ ] E2E: Round-trip for each format

---

#### 2.3 Migrate Existing Import Logic

**Goal:** Move code from import-export.ts to handlers without changing behavior

**Process:**
1. Write comprehensive tests for current behavior
2. Extract code to handlers
3. Verify tests still pass
4. Remove old code

**Migration Checklist:**
- [ ] PNG import logic → PngHandler.import()
- [ ] PNG export logic → PngHandler.export()
- [ ] CHARX import logic → CharxHandler.import()
- [ ] CHARX export logic → CharxHandler.export()
- [ ] Voxta import logic → VoxtaHandler.import()
- [ ] Voxta export logic → VoxtaHandler.export()
- [ ] JSON import logic → JsonHandler.import()
- [ ] JSON export logic → JsonHandler.export()
- [ ] URL download logic → Shared utility
- [ ] Normalization logic → Use CardNormalizer from schemas package

---

### Phase 2 Testing Summary

| Category | Test Count | Coverage Target |
|----------|------------|-----------------|
| CardService Unit | 30+ | 90% |
| Format Handler Unit | 40+ | 95% |
| Handler Registry Unit | 10+ | 90% |
| Integration Tests | 30+ | Key flows |
| E2E Import/Export | 20+ | All formats |

---

## Phase 3: Frontend Consolidation

**Status:** NOT STARTED
**Blocking:** Issue 0.4 merged (for thumbnail), Phase 1 complete
**Priority:** HIGH
**Estimated Effort:** 3-4 weeks

### Tasks

#### 3.1 Schema-Driven EditPanel

**Goal:** Replace 800+ line hardcoded editor with configuration-driven forms

**Files Affected:**
- `apps/web/src/features/editor/components/EditPanel.tsx` (major refactor)
- `apps/web/src/features/editor/config/field-definitions.ts` (new)
- `apps/web/src/features/editor/components/DynamicField.tsx` (new)
- `apps/web/src/features/editor/components/FieldRenderer.tsx` (new)

**Implementation:**
```typescript
// apps/web/src/features/editor/config/field-definitions.ts

export interface FieldDefinition {
  /** Unique field identifier */
  id: string;
  /** Display label */
  label: string;
  /** Path in card data (dot notation) */
  path: string;
  /** Field type determines renderer */
  type: FieldType;
  /** Which specs this field applies to */
  specs: Array<'v2' | 'v3'>;
  /** Validation rules */
  validation?: ValidationRules;
  /** Help text */
  description?: string;
  /** Is field required */
  required?: boolean;
  /** Default value for new cards */
  defaultValue?: unknown;
  /** Conditional visibility */
  visibleWhen?: VisibilityCondition;
}

export type FieldType =
  | 'text'           // Single line input
  | 'textarea'       // Multi-line text
  | 'markdown'       // Markdown editor
  | 'number'
  | 'select'
  | 'multiselect'
  | 'tags'           // Tag input
  | 'array'          // Array of items
  | 'lorebook'       // Special lorebook editor
  | 'assets'         // Asset manager
  | 'custom';        // Custom component

export const cardFieldDefinitions: FieldDefinition[] = [
  {
    id: 'name',
    label: 'Name',
    path: 'data.name',
    type: 'text',
    specs: ['v2', 'v3'],
    required: true,
    validation: { maxLength: 100 },
  },
  {
    id: 'description',
    label: 'Description',
    path: 'data.description',
    type: 'markdown',
    specs: ['v2', 'v3'],
    required: true,
  },
  // ... 20+ more fields
];
```

**Component Structure:**
```typescript
// apps/web/src/features/editor/components/FieldRenderer.tsx

interface FieldRendererProps {
  definition: FieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  errors?: string[];
}

export function FieldRenderer({ definition, value, onChange, errors }: FieldRendererProps) {
  switch (definition.type) {
    case 'text':
      return <TextField {...props} />;
    case 'textarea':
      return <TextAreaField {...props} />;
    case 'markdown':
      return <MarkdownField {...props} />;
    // ... etc
  }
}
```

**Testing Plan:**
- [ ] Unit: FieldRenderer renders correct component for each type
- [ ] Unit: DynamicField handles value changes
- [ ] Unit: Validation rules are enforced
- [ ] Unit: Visibility conditions work
- [ ] Integration: Full form renders from definitions
- [ ] Integration: Form changes update store
- [ ] E2E: Edit card end-to-end

---

#### 3.2 Persistence Adapter

**Goal:** Abstract Web/Lite mode differences into single interface

**Files Affected:**
- `apps/web/src/adapters/persistence/index.ts` (new)
- `apps/web/src/adapters/persistence/server-adapter.ts` (new)
- `apps/web/src/adapters/persistence/local-adapter.ts` (new)
- `apps/web/src/store/card-store.ts` (simplify)
- `apps/web/src/store/template-store.ts` (simplify)
- `apps/web/src/store/llm-store.ts` (simplify)
- `apps/web/src/store/settings-store.ts` (simplify)

**Implementation:**
```typescript
// apps/web/src/adapters/persistence/index.ts

export interface PersistenceAdapter {
  // Cards
  listCards(query?: string): Promise<CardMeta[]>;
  getCard(id: string): Promise<Card | null>;
  saveCard(card: Card): Promise<Card>;
  deleteCard(id: string): Promise<void>;

  // Assets
  listAssets(cardId: string): Promise<Asset[]>;
  saveAsset(cardId: string, asset: AssetData): Promise<Asset>;
  deleteAsset(cardId: string, assetId: string): Promise<void>;

  // Templates
  listTemplates(): Promise<Template[]>;
  saveTemplate(template: Template): Promise<Template>;
  deleteTemplate(id: string): Promise<void>;

  // Settings
  getSettings<T>(key: string): Promise<T | null>;
  saveSettings<T>(key: string, value: T): Promise<void>;
}

// Factory function selects adapter based on deployment mode
export function createPersistenceAdapter(): PersistenceAdapter {
  const config = getDeploymentConfig();
  if (config.mode === 'light' || config.mode === 'static') {
    return new LocalPersistenceAdapter();
  }
  return new ServerPersistenceAdapter();
}

// Singleton for app-wide use
export const persistence = createPersistenceAdapter();
```

**Testing Plan:**
- [ ] Unit: ServerAdapter makes correct API calls
- [ ] Unit: LocalAdapter uses IndexedDB correctly
- [ ] Unit: Factory selects correct adapter
- [ ] Integration: Store operations work with both adapters
- [ ] E2E: Full flow in server mode
- [ ] E2E: Full flow in light mode

---

#### 3.3 Generic Entity Store Factory

**Goal:** Eliminate duplicate CRUD patterns in template/snippet stores

**Files Affected:**
- `apps/web/src/store/utils/create-entity-store.ts` (new)
- `apps/web/src/store/template-store.ts` (refactor)
- `apps/web/src/store/snippet-store.ts` (new, extracted)

**Implementation:**
```typescript
// apps/web/src/store/utils/create-entity-store.ts

export interface EntityStoreConfig<T extends { id: string }> {
  /** Storage key for persistence */
  storageKey: string;
  /** Default entities */
  defaults: T[];
  /** Validate entity before save */
  validate?: (entity: T) => string | null;
}

export interface EntityStore<T extends { id: string }> {
  entities: T[];
  loading: boolean;
  error: string | null;

  load(): Promise<void>;
  create(entity: Omit<T, 'id'>): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  reset(): Promise<void>;
  export(): Promise<string>;
  import(json: string): Promise<void>;
}

export function createEntityStore<T extends { id: string }>(
  config: EntityStoreConfig<T>
): UseBoundStore<StoreApi<EntityStore<T>>>;
```

**Usage:**
```typescript
// apps/web/src/store/template-store.ts
export const useTemplateStore = createEntityStore<Template>({
  storageKey: 'templates',
  defaults: defaultTemplates,
});

// apps/web/src/store/snippet-store.ts
export const useSnippetStore = createEntityStore<Snippet>({
  storageKey: 'snippets',
  defaults: defaultSnippets,
});
```

**Testing Plan:**
- [ ] Unit: Factory creates working store
- [ ] Unit: CRUD operations work correctly
- [ ] Unit: Export/import work correctly
- [ ] Unit: Reset restores defaults
- [ ] Integration: Templates persist across sessions
- [ ] Integration: Snippets persist across sessions

---

#### 3.4 Extract Shared Image Utilities

**Goal:** Consolidate duplicate thumbnail/image code

**Files Affected:**
- `apps/web/src/lib/image-utils.ts` (new, or use @character-foundry/media)
- `apps/web/src/lib/client-import.ts` (remove duplicate)
- `apps/web/src/lib/web-import-handler.ts` (remove duplicate)

**If using primitive package:**
```typescript
// After @character-foundry/media is available
import { createThumbnail } from '@character-foundry/media';
```

**If primitive not ready (interim solution):**
```typescript
// apps/web/src/lib/image-utils.ts

export interface ThumbnailOptions {
  maxSize?: number;
  format?: 'webp' | 'jpeg';
  quality?: number;
}

/**
 * Create thumbnail from image data URL
 * Uses canvas API with WebP/JPEG fallback
 */
export async function createThumbnail(
  imageDataUrl: string,
  options?: ThumbnailOptions
): Promise<string>;

/**
 * Convert Uint8Array to data URL (chunk-safe)
 */
export function uint8ArrayToDataURL(
  buffer: Uint8Array,
  mimeType: string
): string;
```

**Testing Plan:**
- [ ] Unit: createThumbnail resizes correctly
- [ ] Unit: createThumbnail handles WebP fallback
- [ ] Unit: uint8ArrayToDataURL handles large buffers
- [ ] Integration: Import flow creates thumbnails

---

### Phase 3 Testing Summary

| Category | Test Count | Coverage Target |
|----------|------------|-----------------|
| Field Definitions Unit | 25+ | 95% |
| FieldRenderer Unit | 15+ | 90% |
| Persistence Adapter Unit | 30+ | 95% |
| Entity Store Factory Unit | 20+ | 95% |
| Image Utils Unit | 10+ | 90% |
| Integration Tests | 25+ | Key flows |
| E2E Editor Tests | 15+ | All field types |

---

## Phase 4: Infrastructure Improvements

**Status:** NOT STARTED
**Blocking:** Phase 2 and Phase 3 substantially complete
**Priority:** MEDIUM
**Estimated Effort:** 2-3 weeks

### Tasks

#### 4.1 Base Repository Pattern

**Goal:** Reduce repository code duplication, add consistency

**Files Affected:**
- `apps/api/src/db/base-repository.ts` (new)
- `apps/api/src/db/repository.ts` (refactor)

**Implementation:**
```typescript
// apps/api/src/db/base-repository.ts

export abstract class BaseRepository<
  TEntity extends { id: string },
  TCreateInput extends Omit<TEntity, 'id' | 'createdAt' | 'updatedAt'>,
  TRow
> {
  constructor(
    protected db: Database.Database,
    protected tableName: string
  ) {}

  protected abstract rowToEntity(row: TRow): TEntity;
  protected abstract entityToRow(entity: TEntity): Partial<TRow>;

  get(id: string): TEntity | null {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
    const row = stmt.get(id) as TRow | undefined;
    return row ? this.rowToEntity(row) : null;
  }

  create(input: TCreateInput): TEntity {
    const id = nanoid();
    const now = new Date().toISOString();
    // ... generic insert logic
  }

  update(id: string, updates: Partial<TEntity>): TEntity | null {
    // ... generic update logic
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  list(options?: ListOptions): TEntity[] {
    // ... generic list with pagination
  }
}
```

**Testing Plan:**
- [ ] Unit: BaseRepository.get works
- [ ] Unit: BaseRepository.create works
- [ ] Unit: BaseRepository.update works
- [ ] Unit: BaseRepository.delete works
- [ ] Unit: BaseRepository.list with pagination works
- [ ] Integration: CardRepository extends BaseRepository
- [ ] Integration: AssetRepository extends BaseRepository

---

#### 4.2 Transaction Support

**Goal:** Atomic operations for import/export to prevent partial failures

**Files Affected:**
- `apps/api/src/db/transaction.ts` (new)
- `apps/api/src/services/card.service.ts` (use transactions)
- `apps/api/src/services/card-import.service.ts` (use transactions)

**Implementation:**
```typescript
// apps/api/src/db/transaction.ts

export class Transaction {
  private operations: Array<() => void> = [];
  private committed = false;

  constructor(private db: Database.Database) {}

  /**
   * Execute operations atomically
   */
  commit(): void {
    if (this.committed) {
      throw new Error('Transaction already committed');
    }

    const transaction = this.db.transaction(() => {
      for (const operation of this.operations) {
        operation();
      }
    });

    transaction();
    this.committed = true;
  }

  /**
   * Add operation to transaction
   */
  add(operation: () => void): this {
    if (this.committed) {
      throw new Error('Cannot add to committed transaction');
    }
    this.operations.push(operation);
    return this;
  }
}

// Usage in service
async importCard(source: ImportSource): Promise<Card> {
  const transaction = new Transaction(this.db);

  // Parse card data
  const { cardData, assets } = await this.parseSource(source);

  // Add operations to transaction
  let cardId: string;
  transaction.add(() => {
    const card = this.cardRepo.create(cardData);
    cardId = card.meta.id;
  });

  for (const asset of assets) {
    transaction.add(() => {
      this.assetRepo.create({ ...asset, cardId });
    });
  }

  // Atomic commit - all or nothing
  transaction.commit();

  return this.cardRepo.get(cardId!)!;
}
```

**Testing Plan:**
- [ ] Unit: Transaction commits all operations
- [ ] Unit: Transaction rolls back on error
- [ ] Unit: Cannot add to committed transaction
- [ ] Integration: Import creates card and assets atomically
- [ ] Integration: Failed import leaves no partial data

---

#### 4.3 Settings Store Split

**Goal:** Break up 589-line settings store into focused stores

**Files Affected:**
- `apps/web/src/store/settings-store.ts` (reduce to core)
- `apps/web/src/store/theme-store.ts` (new)
- `apps/web/src/store/wwwyzzerdd-store.ts` (new)

**Note:** ComfyUI settings will be removed in Phase 5

**Testing Plan:**
- [ ] Unit: Each store manages its own state
- [ ] Unit: Settings persist correctly
- [ ] Integration: Theme changes apply immediately
- [ ] E2E: Settings persist across sessions

---

### Phase 4 Testing Summary

| Category | Test Count | Coverage Target |
|----------|------------|-----------------|
| BaseRepository Unit | 15+ | 95% |
| Transaction Unit | 10+ | 95% |
| Store Split Unit | 15+ | 90% |
| Integration Tests | 15+ | Key flows |

---

## Phase 5: Cleanup & Optimization

**Status:** NOT STARTED
**Blocking:** All previous phases complete
**Priority:** LOW
**Estimated Effort:** 1-2 weeks

### Tasks

#### 5.1 ComfyUI Removal

**Goal:** Remove 1,841 lines of ComfyUI code, replace with iframe stub

**Files to Delete/Stub:**
- `apps/api/src/routes/comfyui.ts` (1,206 lines → stub)
- `apps/api/src/services/comfyui-client.ts` (635 lines → delete)
- `apps/web/src/store/settings-store.ts` (remove ComfyUI section)
- `apps/web/src/features/comfyui/*` (if exists)

**Stub Implementation:**
```typescript
// apps/api/src/routes/comfyui.ts

import type { FastifyInstance } from 'fastify';

/**
 * ComfyUI Integration - DEPRECATED
 *
 * The full ComfyUI integration has been removed.
 * Future implementation will use:
 * 1. Iframe embedding for ComfyUI UI
 * 2. Simple API to fetch images from ComfyUI output directory
 *
 * See: docs/CODE_ANALYSIS_2024-12.md
 */
export async function comfyuiRoutes(fastify: FastifyInstance) {
  // Stub endpoint for backwards compatibility
  fastify.get('/comfyui/status', async () => {
    return {
      status: 'deprecated',
      message: 'ComfyUI integration has been replaced. See documentation.',
      migrationGuide: '/docs/comfyui-migration.md',
    };
  });
}
```

**Testing Plan:**
- [ ] Unit: Stub endpoint returns deprecation message
- [ ] E2E: Application works without ComfyUI
- [ ] Manual: Verify no ComfyUI references remain

---

#### 5.2 Dead Code Elimination

**Goal:** Remove unused code identified during refactoring

**Process:**
1. Run TypeScript compiler with `noUnusedLocals` and `noUnusedParameters`
2. Review each warning
3. Remove truly unused code
4. Add `_` prefix to intentionally unused parameters

**Testing Plan:**
- [ ] All existing tests still pass
- [ ] No new TypeScript errors
- [ ] Bundle size reduced

---

#### 5.3 Documentation Update

**Goal:** Update documentation to reflect new architecture

**Files:**
- `README.md` - Update architecture overview
- `docs/ARCHITECTURE.md` (new) - Detailed architecture docs
- `docs/CONTRIBUTING.md` (new) - How to add features
- `docs/API.md` - Update API documentation

---

### Phase 5 Testing Summary

| Category | Test Count | Coverage Target |
|----------|------------|-----------------|
| Deprecation Stubs | 5+ | 100% |
| Regression Tests | All existing | No failures |

---

## Testing Strategy

### Test Categories

#### 1. Unit Tests
- **Location:** `apps/*/src/**/*.test.ts`
- **Framework:** Vitest
- **Coverage Target:** 80% overall, 95% for new code
- **Run:** `npm test` in each app

#### 2. Integration Tests
- **Location:** `apps/api/src/**/*.integration.test.ts`
- **Framework:** Vitest + Supertest
- **Coverage:** API endpoints, database operations
- **Run:** `npm run test:integration`

#### 3. E2E Tests
- **Location:** `e2e/`
- **Framework:** Playwright
- **Coverage:** Critical user flows
- **Run:** `npm run test:e2e`

### Test Requirements by Phase

| Phase | Unit Tests | Integration | E2E | Security |
|-------|------------|-------------|-----|----------|
| 1 | 65+ | 25+ | 10+ | 20+ |
| 2 | 80+ | 30+ | 20+ | - |
| 3 | 70+ | 25+ | 15+ | - |
| 4 | 40+ | 15+ | - | - |
| 5 | 5+ | - | Regression | - |

### Test Writing Standards

```typescript
// Example: Well-structured unit test
describe('CardNormalizer', () => {
  describe('normalize', () => {
    it('should fix ChubAI hybrid format', () => {
      // Arrange
      const input = {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        name: 'Test',  // Field at root (wrong)
        data: { description: 'Desc' },
      };

      // Act
      const result = CardNormalizer.normalize(input, 'v2');

      // Assert
      expect(result.data.name).toBe('Test');
      expect((result as Record<string, unknown>).name).toBeUndefined();
    });

    it('should convert numeric position to string enum', () => {
      // ... specific test case
    });

    // More specific test cases...
  });
});
```

### Coverage Enforcement

```json
// vitest.config.ts coverage settings
{
  "coverage": {
    "provider": "v8",
    "reporter": ["text", "html", "lcov"],
    "thresholds": {
      "statements": 80,
      "branches": 75,
      "functions": 80,
      "lines": 80
    },
    "exclude": [
      "**/*.test.ts",
      "**/test/**",
      "**/mocks/**"
    ]
  }
}
```

---

## Progress Tracking

### Phase Status Overview

| Phase | Status | Notes |
|-------|--------|-------|
| 0 - Primitives | ISSUES FILED | #6-#9 awaiting review. Scenario support in progress. |
| 1 - Security | **COMPLETE** ✅ | CORS, rate limiting, SSRF protection implemented |
| 2 - Backend | BLOCKED | Waiting on Phase 0 primitives (CardNormalizer, etc.) |
| 3 - Frontend | **3.2 COMPLETE** | Persistence Adapter done. Other tasks blocked on primitives. |
| 4 - Infrastructure | NOT STARTED | Depends on Phase 2/3 |
| 5 - Cleanup | PARTIAL | ComfyUI done. Voxta scenario fix ON HOLD. |

### Completed This Session (Phase 3.2: Persistence Adapter)

Files created:
- `apps/web/src/adapters/persistence/types.ts` - Interface definition (160 lines)
- `apps/web/src/adapters/persistence/server-adapter.ts` - Server API impl (280 lines)
- `apps/web/src/adapters/persistence/local-adapter.ts` - IndexedDB impl (300 lines)
- `apps/web/src/adapters/persistence/index.ts` - Factory/singleton (75 lines)

**Result:** `template-store.ts` reduced 552 → 257 lines (-53%) by removing 15+ mode checks

### Security Priority Clarifications (Dec 9, 2024)

| Item | Status | Rationale |
|------|--------|-----------|
| **Authentication** | DEFERRED | App runs local-only; revisit if multi-user needed |
| **Upload Security** | DEFERRED | Web runs local, PWA uses local storage |
| **Federation Endpoints** | NEEDS CONFIG | Currently used for sync testing; should be default OFF via config |
| **EditPanel.tsx Refactor** | ✅ UNBLOCKED | Can proceed now - no primitive dependencies |

### Next Steps (Recommended Order)

1. ~~**Phase 1: Security Hardening**~~ ✅ **COMPLETED** (partial)
   - ✅ CORS hardening (configurable origins)
   - ✅ SSRF protection (private IP blocking, metadata endpoint protection)
   - ✅ Rate limiting (100 req/min default, sliding window)
   - ✅ LLM route protection (baseURL validation)
   - ✅ Web import URL validation
   - ⏸️ Auth middleware - DEFERRED (local-only app)
   - ⏸️ Upload security - DEFERRED (local storage)
   - 🔧 Federation default OFF - TODO (add config flag)

2. **Phase 3.1: Schema-Driven EditPanel** - ✅ UNBLOCKED, HIGH PRIORITY
   - Refactor 800+ line EditPanel.tsx to config-driven forms
   - Create field definitions for all CCv2/CCv3 fields
   - Implement FieldRenderer and DynamicField components
   - Expected: ~80% code reduction

3. **Phase 2.2: Format Handler Pattern** - Can start now (doesn't need primitives)
   - Break up `import-export.ts` (1,985 lines) into modular handlers
   - Create handler interface and registry
   - Extract PNG, CHARX, JSON handlers

4. ~~**Phase 3.2: Persistence Adapter**~~ ✅ **COMPLETED**
   - Adapter interface + ServerAdapter + LocalAdapter created
   - template-store refactored as demo (552 → 257 lines)
   - Remaining: Refactor card-store, llm-store to use adapter

### Package Versions (Security Update - Dec 9, 2024)

| Package | Version |
|---------|---------|
| @character-foundry/core | 0.0.2-security.0 |
| @character-foundry/png | 0.0.3-security.0 |
| @character-foundry/charx | 0.0.3-security.0 |
| @character-foundry/voxta | 0.1.3-security.0 |
| @character-foundry/loader | 0.1.5-security.0 |
| @character-foundry/federation | 0.1.2-security.0 |

**Build Status:** PASSING
**@character-foundry/* Package Tests:** ALL PASSING ✅ (22 tasks, 180+ tests)
**API Integration Tests:** 12/12 PASSING ✅ (but shallow - see gaps below)

### Integration Test Coverage (December 9, 2024)

| Test | Fixture | Result |
|------|---------|--------|
| PNG Import V3 + assets + main | Absolute Mother (wedding).png | ✅ 236 assets, 1 main |
| PNG Import V3 + assets, no main | Adeline.png | ✅ 205 assets, auto-main |
| CHARX Import V2 | Kasumi_test.charx | ✅ 35 assets |
| CHARX Import JPEG+ZIP | Ailu Narukami.charx | ✅ 170 assets |
| Voxta Import Multi-char | Arcane Alley University.voxpkg | ✅ 16 cards |
| Voxta Import Char+Scenario | Princess Elaria Scenario.voxpkg | ✅ 1 card |
| CHARX Export no dupe main | Kasumi_test → export | ✅ No duplication |
| Voxta Export no dupe main | Kasumi_test → voxta | ✅ Fixed: main in thumbnail only |
| CHARX Round-trip | Kasumi_test → export → reimport | ✅ 35 assets preserved |
| PNG → Voxta | Absolute Mother → voxta | ✅ 237 files, thumbnail present |
| Voxta → CHARX | Princess Elaria → charx | ✅ Data preserved |
| Large Voxta | Kally.1.2.0.voxpkg | ✅ 2 cards, 333 assets |

### Known Gap: Scenario Data Loss (ON HOLD) ⚠️

**Status:** ON HOLD - Primitives being updated to support scenarios without package.json

**Problem:** Voxta packages with scenarios lose scenario data on import.
- `readVoxta()` correctly extracts scenarios
- `voxta-import.service.ts` only imports characters, ignores scenarios
- Scenario Actions, Scripts, Events, Roles, Template, Messages are lost

**Resolution:** Awaiting primitive updates, then Character Architect will be updated to handle scenarios

### Detailed Task Tracking

#### Phase 0: Primitive Package Requests
- [x] Issue 0.1: @character-foundry/core utilities - FILED [#6](https://github.com/character-foundry/character-foundry/issues/6)
- [x] Issue 0.2: @character-foundry/schemas CardNormalizer - FILED [#7](https://github.com/character-foundry/character-foundry/issues/7)
- [x] Issue 0.3: @character-foundry/schemas detectSpec enhancement - FILED [#8](https://github.com/character-foundry/character-foundry/issues/8)
- [x] Issue 0.4: @character-foundry/media package - FILED [#9](https://github.com/character-foundry/character-foundry/issues/9)
- [ ] Wait for issues to be reviewed/merged before proceeding to Phase 1

#### Phase 1: Security Hardening
- [ ] 1.1 Authentication & Authorization
  - [ ] Design auth middleware
  - [ ] Implement auth middleware
  - [ ] Add auth to all routes
  - [ ] Write unit tests
  - [ ] Write integration tests
- [ ] 1.2 CORS Hardening
  - [ ] Update CORS configuration
  - [ ] Write tests
- [ ] 1.3 SSRF Protection
  - [ ] Create URL validator
  - [ ] Create safe fetch wrapper
  - [ ] Update LLM routes
  - [ ] Update web-import
  - [ ] Write tests
- [ ] 1.4 Rate Limiting
  - [ ] Create rate limit middleware
  - [ ] Configure tiers
  - [ ] Apply to routes
  - [ ] Write tests
- [ ] 1.5 Upload Security
  - [ ] Create upload validator
  - [ ] Update asset routes
  - [ ] Write tests

#### Phase 2: Backend Consolidation
- [ ] 2.1 CardService Implementation
  - [ ] Design service interface
  - [ ] Implement createCard
  - [ ] Implement updateCard
  - [ ] Implement importCard
  - [ ] Write unit tests
  - [ ] Write integration tests
- [ ] 2.2 Format Handler Pattern
  - [ ] Design handler interface
  - [ ] Implement PngHandler
  - [ ] Implement CharxHandler
  - [ ] Implement VoxtaHandler
  - [ ] Implement JsonHandler
  - [ ] Implement handler registry
  - [ ] Write tests
- [ ] 2.3 Migrate Existing Logic
  - [ ] Write behavior tests for current code
  - [ ] Extract to handlers
  - [ ] Verify tests pass
  - [ ] Remove old code

#### Phase 3: Frontend Consolidation
- [ ] 3.1 Schema-Driven EditPanel
  - [ ] Design field definition schema
  - [ ] Create field definitions for all fields
  - [ ] Implement FieldRenderer
  - [ ] Implement DynamicField
  - [ ] Refactor EditPanel
  - [ ] Write tests
- [x] 3.2 Persistence Adapter ✅ **COMPLETED Dec 9, 2024**
  - [x] Design adapter interface (`types.ts`)
  - [x] Implement ServerAdapter (`server-adapter.ts`)
  - [x] Implement LocalAdapter (`local-adapter.ts`)
  - [x] Create factory function (`index.ts`)
  - [x] Refactor template-store as demo (552 → 257 lines, -53%)
  - [ ] Refactor remaining stores (card-store, llm-store)
  - [ ] Write tests
- [ ] 3.3 Generic Entity Store Factory
  - [ ] Design factory API
  - [ ] Implement createEntityStore
  - [ ] Refactor template-store
  - [ ] Create snippet-store
  - [ ] Write tests
- [ ] 3.4 Extract Image Utilities
  - [ ] Create image-utils.ts (or use primitive)
  - [ ] Remove duplicates
  - [ ] Write tests

#### Phase 4: Infrastructure Improvements
- [ ] 4.1 Base Repository Pattern
  - [ ] Design base class
  - [ ] Implement BaseRepository
  - [ ] Refactor CardRepository
  - [ ] Refactor AssetRepository
  - [ ] Refactor CardAssetRepository
  - [ ] Write tests
- [ ] 4.2 Transaction Support
  - [ ] Design transaction API
  - [ ] Implement Transaction class
  - [ ] Update services to use transactions
  - [ ] Write tests
- [ ] 4.3 Settings Store Split
  - [ ] Extract theme-store
  - [ ] Extract wwwyzzerdd-store
  - [ ] Simplify settings-store
  - [ ] Write tests

#### Phase 5: Cleanup & Optimization
- [ ] 5.1 ComfyUI Removal
  - [ ] Create stub routes
  - [ ] Delete comfyui-client.ts
  - [ ] Remove ComfyUI settings
  - [ ] Verify no references remain
- [ ] 5.2 Dead Code Elimination
  - [ ] Run unused code analysis
  - [ ] Remove dead code
  - [ ] Verify tests pass
- [ ] 5.3 Documentation Update
  - [ ] Update README
  - [ ] Create ARCHITECTURE.md
  - [ ] Create CONTRIBUTING.md
  - [ ] Update API docs

---

## Appendix A: File Impact Summary

### Files to Create
| File | Phase | Lines (est.) |
|------|-------|--------------|
| `apps/api/src/middleware/auth.ts` | 1 | 150 |
| `apps/api/src/middleware/rate-limit.ts` | 1 | 100 |
| `apps/api/src/utils/url-validator.ts` | 1 | 150 |
| `apps/api/src/utils/upload-validator.ts` | 1 | 100 |
| `apps/api/src/services/card.service.ts` | 2 | 300 |
| `apps/api/src/handlers/format-handler.interface.ts` | 2 | 50 |
| `apps/api/src/handlers/png-handler.ts` | 2 | 150 |
| `apps/api/src/handlers/charx-handler.ts` | 2 | 200 |
| `apps/api/src/handlers/voxta-handler.ts` | 2 | 200 |
| `apps/api/src/handlers/json-handler.ts` | 2 | 100 |
| `apps/web/src/features/editor/config/field-definitions.ts` | 3 | 200 |
| `apps/web/src/features/editor/components/FieldRenderer.tsx` | 3 | 150 |
| `apps/web/src/adapters/persistence/index.ts` | 3 | 50 |
| `apps/web/src/adapters/persistence/server-adapter.ts` | 3 | 150 |
| `apps/web/src/adapters/persistence/local-adapter.ts` | 3 | 150 |
| `apps/web/src/store/utils/create-entity-store.ts` | 3 | 150 |
| `apps/api/src/db/base-repository.ts` | 4 | 150 |
| `apps/api/src/db/transaction.ts` | 4 | 100 |

### Files to Significantly Modify
| File | Phase | Current Lines | Target Lines |
|------|-------|---------------|--------------|
| `apps/api/src/routes/import-export.ts` | 2 | 1,985 | ~200 |
| `apps/web/src/features/editor/components/EditPanel.tsx` | 3 | 800+ | ~200 |
| `apps/web/src/store/template-store.ts` | 3 | 552 | ~100 |
| `apps/web/src/store/settings-store.ts` | 4 | 589 | ~200 |
| `apps/api/src/db/repository.ts` | 4 | 618 | ~300 |

### Files to Delete
| File | Phase | Lines Removed |
|------|-------|---------------|
| `apps/api/src/services/comfyui-client.ts` | 5 | 635 |
| `apps/api/src/routes/comfyui.ts` (most of it) | 5 | ~1,150 |

---

## Appendix B: Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Primitive packages not updated in time | Medium | High | Create interim implementations, plan migration |
| Security changes break existing clients | Medium | Medium | Deprecation period, clear documentation |
| Format handler changes break import | Low | High | Comprehensive test suite before refactoring |
| Store refactoring loses user data | Low | High | Migration scripts, backup prompts |
| EditPanel refactor breaks editing | Medium | High | Feature flag for gradual rollout |

---

## Appendix C: Success Metrics

### Code Quality
- [ ] TypeScript strict mode enabled with no errors
- [ ] No `any` types (except justified exceptions)
- [ ] Test coverage ≥80%
- [ ] No ESLint errors/warnings

### Performance
- [ ] Bundle size reduced by ≥10%
- [ ] Import/export time unchanged or improved
- [ ] No memory leaks introduced

### Maintainability
- [ ] Largest file ≤500 lines
- [ ] No function >50 lines
- [ ] Cyclomatic complexity <10 for all functions
- [ ] Documentation coverage for public APIs

### Security
- [ ] All OWASP Top 10 mitigated
- [ ] No high/critical vulnerabilities in `npm audit`
- [ ] Rate limiting active on all write endpoints
- [ ] SSRF protection verified
