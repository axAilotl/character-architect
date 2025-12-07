# CODEX Findings

Priority order reflects expected impact and ease of mitigation for this single-user, self-hosted setup.

## P1 — Resource Safety for Image Archival
- Issue: `archive-linked-images` downloads external URLs with no timeout or size limit; a slow/large response can hang the request and consume unbounded RAM.  
- Suggested fix: Use `AbortController` with a short timeout (e.g., 10–15s) and stream with a max bytes guard; reject responses without `content-length` or above `config.limits.maxPngSizeMB`. Apply to `downloadImage` in `apps/api/src/routes/image-archival.ts`.

## P1 — Orphaned Asset Cleanup
- Issue: Deleting cards or card assets removes DB links but leaves `assets` rows and files under `/storage/{cardId}/…`, keeping deleted content readable and growing disk usage.  
- Suggested fix: On card delete, fetch linked assets, delete files from disk, then remove `assets` rows; on asset delete, remove the file and delete the `assets` row when no other card references it. Keep version snapshots untouched if desired.

## P2 — Body Size Enforcement
- Issue: `config.limits.maxCardSizeMB` is unused; Fastify `bodyLimit` is hard-coded to 50 MB. Oversized JSON payloads are not rejected based on config.  
- Suggested fix: Set `bodyLimit` from config (card limit in bytes) and/or validate `content-length` per request. Consider aligning PNG upload limit to the same config source.

## P2 — Input Validation for Pagination
- Issue: `page` is parsed without guard; non-numeric values become `NaN`, which can be bound into `LIMIT/OFFSET` in SQLite.  
- Suggested fix: Coerce to `Math.max(1, Number.parseInt(page || '1', 10) || 1)` before query execution.

## P3 — Frontend Safety Net
- Issue: Only backend Vitest suite exists; no frontend smoke to catch regressions across the monorepo.  
- Suggested fix: Add a minimal Playwright smoke test (load dashboard, open card) run via a root npm script to cover build + basic UI wiring.
