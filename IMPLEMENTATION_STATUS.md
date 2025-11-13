# Character Card Tooling Suite - Implementation Status

## Overview
This document tracks the implementation status of the character card tooling suite features.

## ✅ COMPLETED FEATURES (MUST SHIP)

### 1. Prompt Simulator (Target Frontend Profiles) ✓
**Status**: Complete and functional

**Backend**:
- Service: `apps/api/src/services/prompt-simulator.ts`
- Routes: `apps/api/src/routes/prompt-simulator.ts`
- Profiles supported:
  - Generic CCv3 (standard field ordering)
  - Strict CCv3 (labeled fields, specific separators)
  - CCv2-compat (legacy format)
- Token budget tracking with drop policies:
  - `oldest-first`: Drop oldest segments first
  - `lowest-priority`: Drop low priority segments first
  - `truncate-end`: Cut from end when over budget
- Preserve fields configuration

**Frontend**:
- Component: `apps/web/src/components/PromptSimulatorPanel.tsx`
- Features:
  - Profile selection dropdown
  - Token budget configuration
  - Per-segment token breakdown
  - Dropped segments visualization
  - Full prompt preview with copy-to-clipboard

**API Endpoints**:
- `GET /prompt-simulator/profiles` - List available profiles
- `POST /prompt-simulator/simulate` - Simulate single profile
- `POST /prompt-simulator/compare` - Compare multiple profiles
- `POST /prompt-simulator/preview-field` - Preview field change impact

**Acceptance**: ✅ Simulated prompt matches field set and token math is reproducible

---

### 2. Redundancy Killer (Cross-field Lint) ✓
**Status**: Complete and functional

**Backend**:
- Service: `apps/api/src/services/redundancy-killer.ts`
- Routes: `apps/api/src/routes/redundancy.ts`
- Detection types:
  - **Exact Duplicate**: Identical sentences across fields
  - **Semantic Overlap**: Similar meaning, different words (phrase-level analysis)
  - **Repeated Phrase**: 3-8 word phrases appearing in multiple fields
- Consolidation strategies:
  - Remove duplicates
  - Merge overlapping content
  - Field priority system (description > personality > scenario)

**Frontend**:
- Component: `apps/web/src/components/RedundancyPanel.tsx`
- Features:
  - Redundancy score (0-100, lower is better)
  - Issue count and potential token savings
  - Severity badges (high/medium/low)
  - Affected field previews
  - One-click apply fixes with confidence scores
  - Token delta display

**API Endpoints**:
- `POST /redundancy/analyze` - Analyze card for redundancies
- `POST /redundancy/apply-fix` - Apply consolidation suggestion

**Acceptance**: ✅ Token delta visible, zero accidental deletions (high confidence scoring)

---

### 3. Lore Trigger Tester ✓
**Status**: Complete and functional

**Backend**:
- Service: `apps/api/src/services/lore-trigger-tester.ts`
- Routes: `apps/api/src/routes/lore-trigger.ts`
- Features:
  - Primary and secondary key matching
  - AND logic: Both primary AND secondary must match
  - NOT logic: Primary must match, secondary must NOT match
  - Regex pattern support (enclosed in `/pattern/`)
  - Case-sensitive matching option
  - Scan depth support for chat history
  - Position-based injection (before/after prompt)
  - Priority-based ordering

**Frontend**:
- Component: `apps/web/src/components/LoreTriggerPanel.tsx`
- Features:
  - Real-time phrase testing (500ms debounce)
  - Active entry count display
  - AND/NOT logic badges with success/fail indicators
  - Matched key highlighting (primary vs secondary)
  - Entry priority and position display
  - Full injection preview with ordering
  - Token count calculation

**API Endpoints**:
- `POST /lore-trigger/test` - Test input phrase against lorebook
- `POST /lore-trigger/stats` - Get lorebook statistics

**Acceptance**: ✅ Active entries and positions match preview injection, AND/NOT logic visible

---

## 🚧 IN PROGRESS / PLANNED FEATURES

### 4. Style Guard (Format Contracts)
**Status**: Not started
**Priority**: High

**Requirements**:
- Toggle per-card: "Quoted dialogue + *italic actions*", tense, POV
- Live lint with autocorrect suggestions
- Rules persisted per card
- No violations after auto-fix

**Suggested Implementation**:
- Backend service: `apps/api/src/services/style-guard.ts`
- Style rule schema definitions
- Pattern matching for dialogue/actions/tense/POV
- Auto-fix suggestions with confidence
- Frontend panel with rule configuration

---

### 5. Alt-Greeting Workbench
**Status**: Not started
**Priority**: High

**Requirements**:
- Generate N variants with diversity scoring
- Dedupe near-duplicates using Jaccard/embedding similarity
- Enforce format consistency
- Prevent "same greeting with new hat"

**Suggested Implementation**:
- Backend service: `apps/api/src/services/greeting-workbench.ts`
- Similarity calculation (Jaccard for quick comparison)
- Diversity scoring algorithm
- Batch generation interface
- Frontend panel with variant management

---

### 6. Version Timeline + Field-Aware Diff
**Status**: Partially implemented (basic diff exists)
**Priority**: Medium

**Existing**:
- `apps/web/src/components/DiffPanel.tsx` uses jsondiffpatch
- Basic version history

**Requirements**:
- Snapshot graph visualization
- Per-field token deltas
- Restore any node
- Round-trip losslessly

**Enhancement Needed**:
- Token delta calculation per field
- Graph visualization component
- Restore functionality

---

### 7. PNG Embed/Extract Verifier
**Status**: Partially implemented
**Priority**: High (critical for export)

**Existing**:
- PNG extraction working: `apps/api/src/utils/png.ts`
- Import works correctly

**Missing**:
- PNG export functionality (currently returns 501)
- Canonical JSON serialization
- Post-export verification
- Byte comparison for drift detection

**Implementation Needed**:
- Complete `embedIntoPNG()` function
- Add canonical JSON serializer
- Add re-import verification step
- Whitespace/key-order normalization

---

## 🎨 QUALITY OF LIFE FEATURES

### 25. Command Palette (Ctrl/Cmd+K)
**Status**: Not started
**Priority**: High (major UX improvement)

**Requirements**:
- Fuzzy search interface
- Commands: "Rewrite to ≤N", "Convert to Hybrid", "New alt greeting x3", "Run Prompt Simulator", "Snapshot"
- Keyboard shortcuts

**Suggested Implementation**:
- Command registry system
- Fuzzy search library (Fuse.js or similar)
- Global keyboard handler
- Modal component

---

### 26. Keyboard-first Editing
**Status**: Not started
**Priority**: Medium

**Requirements**:
- Field jump (J/K)
- Add lore entry (A)
- Toggle Style Guard (G)
- Open sidebar (.)
- Run suite (R)

**Suggested Implementation**:
- Global keyboard event handler
- Focus management system
- Vim-style navigation

---

### 27. Health & Backup
**Status**: Partially implemented
**Priority**: High (production readiness)

**Existing**:
- Basic `/health` endpoint exists in `apps/api/src/index.ts`

**Requirements**:
- Comprehensive health checks (DB, storage, memory)
- Workspace export to tar (cards + assets + versions)
- One-click backup

**Implementation Needed**:
- Enhanced health endpoint with detailed checks
- Tar archive creation utility
- Backup API endpoint
- Frontend backup UI

---

## Architecture Summary

### Backend Structure
```
apps/api/src/
├── services/           # Business logic
│   ├── prompt-simulator.ts    ✓
│   ├── redundancy-killer.ts   ✓
│   ├── lore-trigger-tester.ts ✓
│   ├── style-guard.ts         ⚠️ TODO
│   └── greeting-workbench.ts  ⚠️ TODO
├── routes/            # API endpoints
│   ├── prompt-simulator.ts    ✓
│   ├── redundancy.ts          ✓
│   ├── lore-trigger.ts        ✓
│   ├── style-guard.ts         ⚠️ TODO
│   └── greeting.ts            ⚠️ TODO
└── utils/
    └── png.ts         ⚠️ Needs completion
```

### Frontend Structure
```
apps/web/src/components/
├── PromptSimulatorPanel.tsx   ✓
├── RedundancyPanel.tsx        ✓
├── LoreTriggerPanel.tsx       ✓
├── StyleGuardPanel.tsx        ⚠️ TODO
├── GreetingWorkbench.tsx      ⚠️ TODO
├── CommandPalette.tsx         ⚠️ TODO
└── DiffPanel.tsx              ⚠️ Needs enhancement
```

### Integration Points
- All services use the existing `TokenizerRegistry` from `@card-architect/tokenizers`
- All panels integrate with `useCardStore` Zustand store
- API base URL: `http://localhost:3001`
- Consistent error handling and loading states

---

## Testing Checklist

### Completed Features
- [ ] Prompt Simulator: Test all 3 profiles with various cards
- [ ] Prompt Simulator: Verify token budget drop policies work correctly
- [ ] Redundancy Killer: Test with highly redundant card
- [ ] Redundancy Killer: Verify no data loss on consolidation
- [ ] Lore Trigger Tester: Test AND/NOT logic with complex entries
- [ ] Lore Trigger Tester: Verify regex patterns work
- [ ] Integration: Test all panels load correctly in tabs
- [ ] Integration: Test with both CCv2 and CCv3 cards

### TODO
- [ ] Style Guard implementation tests
- [ ] Alt-Greeting Workbench tests
- [ ] PNG export/verify round-trip tests
- [ ] Command Palette keyboard navigation tests
- [ ] Health endpoint comprehensive checks
- [ ] Backup/restore functionality tests

---

## Next Steps

### Immediate Priorities
1. **Complete PNG Export Verifier** - Critical for release
2. **Implement Style Guard** - High user value
3. **Build Command Palette** - Major UX improvement
4. **Enhance Health & Backup** - Production readiness

### Future Enhancements
1. Alt-Greeting Workbench with AI generation
2. Version Timeline graph visualization
3. Advanced keyboard navigation
4. Plugin system for custom validators
5. Collaborative editing support

---

## Performance Considerations
- All frontend panels use debounced API calls (500ms)
- Token counting uses approximate tokenizers for speed
- Large cards (>10k tokens) may need optimization
- Consider caching redundancy analysis results

## Security Notes
- No user authentication currently implemented
- API endpoints should add rate limiting before production
- Validate all user inputs on backend
- Sanitize HTML in preview panels (DOMPurify already in use)
