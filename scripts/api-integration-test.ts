/**
 * API Integration Tests
 *
 * Tests import/export endpoints with real card fixtures to verify:
 * 1. Data integrity across format conversions
 * 2. Asset extraction and main icon handling
 * 3. No duplicate files created
 * 4. Proper handling of edge cases
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { unzipSync } from 'fflate';

const API_BASE = 'http://localhost:3456/api';
const FIXTURES_DIR = '/mnt/samesung/ai/character-foundry/character-architect/docs/internal/testing';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  details?: string;
  error?: string;
}

interface CardMeta {
  id: string;
  name: string;
  spec: string;
  assetCount?: number;
}

interface Card {
  meta: CardMeta;
  data: unknown;
}

interface AssetInfo {
  id: string;
  type: string;
  name: string;
  ext: string;
  isMain: boolean;
  tags?: string[];
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, status: 'PASS', duration: Date.now() - start });
    console.log(`✓ ${name}`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    results.push({ name, status: 'FAIL', duration: Date.now() - start, error: errMsg });
    console.log(`✗ ${name}`);
    console.log(`  Error: ${errMsg}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function importFile(filePath: string): Promise<Card[]> {
  const buffer = await fs.readFile(filePath);
  const filename = filePath.split('/').pop()!;
  const ext = filename.split('.').pop()?.toLowerCase();

  const formData = new FormData();
  formData.append('file', new Blob([buffer]), filename);

  // Use appropriate endpoint based on file type
  let endpoint = `${API_BASE}/import`;
  if (ext === 'voxpkg') {
    endpoint = `${API_BASE}/import-voxta`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Import failed: ${response.status} - ${text}`);
  }

  const result = await response.json();

  // Handle different response formats
  // Voxta returns { success, cards: [...] }
  if (result.success && result.cards) {
    return result.cards;
  }

  // Regular import returns { card, warnings } (no success wrapper)
  if (result.card) {
    return [result.card];
  }

  // Fallback for array responses
  if (Array.isArray(result)) {
    return result;
  }

  throw new Error(`Unexpected response format: ${JSON.stringify(result).slice(0, 200)}`);
}

async function getCard(cardId: string): Promise<Card> {
  const response = await fetch(`${API_BASE}/cards/${cardId}`);
  if (!response.ok) throw new Error(`Failed to get card: ${response.status}`);
  return response.json();
}

async function getAssets(cardId: string): Promise<AssetInfo[]> {
  const response = await fetch(`${API_BASE}/cards/${cardId}/assets`);
  if (!response.ok) throw new Error(`Failed to get assets: ${response.status}`);
  return response.json();
}

async function exportCard(cardId: string, format: 'json' | 'png' | 'charx' | 'voxta'): Promise<ArrayBuffer> {
  const response = await fetch(`${API_BASE}/cards/${cardId}/export?format=${format}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Export failed: ${response.status} - ${text}`);
  }
  return response.arrayBuffer();
}

async function deleteCard(cardId: string): Promise<void> {
  await fetch(`${API_BASE}/cards/${cardId}`, { method: 'DELETE' });
}

function analyzeZipContents(buffer: ArrayBuffer): {
  files: string[];
  hasThumbnail: boolean;
  mainIconInAssets: boolean;
  characterJson: boolean;
} {
  const files: string[] = [];
  let hasThumbnail = false;
  let mainIconInAssets = false;
  let characterJson = false;

  try {
    const unzipped = unzipSync(new Uint8Array(buffer));
    for (const path of Object.keys(unzipped)) {
      files.push(path);

      // Check for Voxta thumbnail pattern (Characters/{id}/thumbnail.xxx)
      if (path.match(/Characters\/[^/]+\/thumbnail\./)) hasThumbnail = true;

      // Check for CHARX thumbnail (icon/main.xxx at root)
      if (path.match(/^icon\/main\./)) hasThumbnail = true;

      // Check for main icon duplicated in Assets/Avatars (BAD)
      if (path.includes('/Assets/Avatars/') && path.toLowerCase().includes('main.')) {
        mainIconInAssets = true;
      }

      // Check for character.json
      if (path.includes('character.json')) characterJson = true;
    }
  } catch (e) {
    console.log(`  [ZIP parse error: ${e}]`);
  }

  return { files, hasThumbnail, mainIconInAssets, characterJson };
}

// ============================================================================
// TEST CASES
// ============================================================================

async function runTests() {
  console.log('\n========================================');
  console.log('API INTEGRATION TESTS');
  console.log('========================================\n');

  const cardsToCleanup: string[] = [];

  // ---------------------------------------------------------------------------
  // TEST 1: PNG with V3 + Assets + Main Icon
  // ---------------------------------------------------------------------------
  await test('PNG Import: V3 with assets and main icon (Absolute Mother)', async () => {
    const filePath = join(FIXTURES_DIR, 'Absolute Mother (wedding).png');
    const cards = await importFile(filePath);
    assert(cards.length === 1, `Expected 1 card, got ${cards.length}`);

    const cardId = cards[0].meta.id;
    cardsToCleanup.push(cardId);

    const card = await getCard(cardId);
    assert(card.meta.spec === 'v3', `Expected v3 spec, got ${card.meta.spec}`);

    const assets = await getAssets(cardId);
    const mainIcons = assets.filter(a => a.type === 'icon' && a.isMain);
    assert(mainIcons.length === 1, `Expected exactly 1 main icon, got ${mainIcons.length}`);

    console.log(`  Card: ${card.meta.name}, Assets: ${assets.length}, Main icons: ${mainIcons.length}`);

    // List all assets by type
    const byType: Record<string, number> = {};
    for (const a of assets) {
      byType[a.type] = (byType[a.type] || 0) + 1;
    }
    console.log(`  Asset types: ${JSON.stringify(byType)}`);
  });

  // ---------------------------------------------------------------------------
  // TEST 2: PNG with V3 + Assets + NO Main Icon
  // ---------------------------------------------------------------------------
  await test('PNG Import: V3 with assets, no explicit main (Adeline)', async () => {
    const filePath = join(FIXTURES_DIR, 'Adeline.png');
    const cards = await importFile(filePath);
    assert(cards.length === 1, `Expected 1 card, got ${cards.length}`);

    const cardId = cards[0].meta.id;
    cardsToCleanup.push(cardId);

    const assets = await getAssets(cardId);
    const mainIcons = assets.filter(a => a.type === 'icon' && a.isMain);

    console.log(`  Total assets: ${assets.length}`);
    console.log(`  Main icons: ${mainIcons.length}`);

    // Should have at least one main icon (created from container or found)
    assert(mainIcons.length >= 1, `Expected at least 1 main icon, got ${mainIcons.length}`);

    if (mainIcons.length > 0) {
      console.log(`  Main icon: ${mainIcons[0].name}.${mainIcons[0].ext}`);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 3: CHARX Import (V2 converted)
  // ---------------------------------------------------------------------------
  await test('CHARX Import: V2 card (Kasumi_test)', async () => {
    const filePath = join(FIXTURES_DIR, 'Kasumi_test.charx');
    const cards = await importFile(filePath);
    assert(cards.length === 1, `Expected 1 card, got ${cards.length}`);

    const cardId = cards[0].meta.id;
    cardsToCleanup.push(cardId);

    const card = await getCard(cardId);
    const assets = await getAssets(cardId);

    console.log(`  Card: ${card.meta.name}, Spec: ${card.meta.spec}, Assets: ${assets.length}`);

    const hasMainIcon = assets.some(a => a.type === 'icon' && a.isMain);
    assert(hasMainIcon, 'CHARX should have a main icon');

    const mainIcons = assets.filter(a => a.type === 'icon' && a.isMain);
    console.log(`  Main icons: ${mainIcons.length}`);
  });

  // ---------------------------------------------------------------------------
  // TEST 4: CHARX Import (JPEG+ZIP hybrid)
  // ---------------------------------------------------------------------------
  await test('CHARX Import: JPEG+ZIP hybrid (Ailu Narukami)', async () => {
    const filePath = join(FIXTURES_DIR, 'Ailu Narukami.charx');
    const cards = await importFile(filePath);
    assert(cards.length === 1, `Expected 1 card, got ${cards.length}`);

    const cardId = cards[0].meta.id;
    cardsToCleanup.push(cardId);

    const card = await getCard(cardId);
    const assets = await getAssets(cardId);

    console.log(`  Card: ${card.meta.name}, Assets: ${assets.length}`);

    const byType: Record<string, number> = {};
    for (const a of assets) {
      byType[a.type] = (byType[a.type] || 0) + 1;
    }
    console.log(`  Asset types: ${JSON.stringify(byType)}`);
  });

  // ---------------------------------------------------------------------------
  // TEST 5: Voxta Package (Multi-character)
  // ---------------------------------------------------------------------------
  await test('Voxta Import: Multi-character package (Arcane Alley University)', async () => {
    const filePath = join(FIXTURES_DIR, 'Arcane Alley University.1.4.0.voxpkg');
    const cards = await importFile(filePath);

    console.log(`  Imported ${cards.length} cards`);
    cards.forEach(c => cardsToCleanup.push(c.meta.id));

    assert(cards.length > 1, `Expected multiple cards from package, got ${cards.length}`);

    // Sample first few cards
    for (let i = 0; i < Math.min(3, cards.length); i++) {
      const card = await getCard(cards[i].meta.id);
      const assets = await getAssets(cards[i].meta.id);
      console.log(`    - ${card.meta.name}: ${assets.length} assets`);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 6: Voxta Package (Character + Scenario)
  // ---------------------------------------------------------------------------
  await test('Voxta Import: Character + Scenario (Princess Elaria)', async () => {
    const filePath = join(FIXTURES_DIR, 'Princess Elaria Scenario.1.0.0.voxpkg');
    const cards = await importFile(filePath);

    console.log(`  Imported ${cards.length} cards`);
    cards.forEach(c => cardsToCleanup.push(c.meta.id));

    assert(cards.length >= 1, `Expected at least 1 card, got ${cards.length}`);

    for (const c of cards) {
      const assets = await getAssets(c.meta.id);
      console.log(`    - ${c.meta.name}: ${assets.length} assets`);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 7: CHARX Export - Check for duplicate main icons
  // ---------------------------------------------------------------------------
  await test('CHARX Export: No duplicate main icon', async () => {
    const filePath = join(FIXTURES_DIR, 'Kasumi_test.charx');
    const cards = await importFile(filePath);
    const cardId = cards[0].meta.id;
    cardsToCleanup.push(cardId);

    const charxBuffer = await exportCard(cardId, 'charx');
    const analysis = analyzeZipContents(charxBuffer);

    console.log(`  CHARX files: ${analysis.files.length}`);
    console.log(`  Has thumbnail/main: ${analysis.hasThumbnail}`);
    console.log(`  Files: ${analysis.files.filter(f => f.includes('icon')).join(', ')}`);

    // Check no duplicates in icon folder
    const iconFiles = analysis.files.filter(f => f.startsWith('icon/'));
    const mainCount = iconFiles.filter(f => f.toLowerCase().includes('main')).length;
    assert(mainCount <= 1, `Found ${mainCount} main icons in icon/ folder`);
  });

  // ---------------------------------------------------------------------------
  // TEST 8: Voxta Export - Thumbnail present, main NOT in Assets/Avatars
  // ---------------------------------------------------------------------------
  await test('Voxta Export: Thumbnail exists, main not duplicated in Avatars', async () => {
    const filePath = join(FIXTURES_DIR, 'Kasumi_test.charx');
    const cards = await importFile(filePath);
    const cardId = cards[0].meta.id;
    cardsToCleanup.push(cardId);

    const voxtaBuffer = await exportCard(cardId, 'voxta');
    const analysis = analyzeZipContents(voxtaBuffer);

    console.log(`  Voxta files: ${analysis.files.length}`);
    console.log(`  Has thumbnail: ${analysis.hasThumbnail}`);
    console.log(`  Main in Assets/Avatars: ${analysis.mainIconInAssets}`);
    console.log(`  Has character.json: ${analysis.characterJson}`);

    // List avatar files if any
    const avatarFiles = analysis.files.filter(f => f.includes('/Avatars/'));
    if (avatarFiles.length > 0) {
      console.log(`  Avatar files: ${avatarFiles.join(', ')}`);
    }

    assert(analysis.hasThumbnail, 'Voxta export should have thumbnail');
    assert(analysis.characterJson, 'Voxta export should have character.json');
    assert(!analysis.mainIconInAssets, 'Main icon should NOT be duplicated in Assets/Avatars');
  });

  // ---------------------------------------------------------------------------
  // TEST 9: Round-trip data integrity
  // ---------------------------------------------------------------------------
  await test('Round-trip: CHARX → Import → Export CHARX → Re-import', async () => {
    const filePath = join(FIXTURES_DIR, 'Kasumi_test.charx');
    const cards = await importFile(filePath);
    const cardId = cards[0].meta.id;
    cardsToCleanup.push(cardId);

    const originalCard = await getCard(cardId);
    const originalAssets = await getAssets(cardId);

    // Export to CHARX
    const charxBuffer = await exportCard(cardId, 'charx');

    // Re-import
    const tempPath = '/tmp/test-roundtrip.charx';
    await fs.writeFile(tempPath, Buffer.from(charxBuffer));

    const reimportedCards = await importFile(tempPath);
    const reimportedCardId = reimportedCards[0].meta.id;
    cardsToCleanup.push(reimportedCardId);

    const reimportedCard = await getCard(reimportedCardId);
    const reimportedAssets = await getAssets(reimportedCardId);

    // Compare
    const origData = (originalCard.data as Record<string, unknown>).data as Record<string, unknown>;
    const reimpData = (reimportedCard.data as Record<string, unknown>).data as Record<string, unknown>;

    console.log(`  Original: ${origData?.name}, ${originalAssets.length} assets`);
    console.log(`  Reimported: ${reimpData?.name}, ${reimportedAssets.length} assets`);

    assert(origData?.name === reimpData?.name, `Name mismatch: ${origData?.name} vs ${reimpData?.name}`);
    assert(originalAssets.length === reimportedAssets.length, `Asset count mismatch: ${originalAssets.length} vs ${reimportedAssets.length}`);

    await fs.unlink(tempPath).catch(() => {});
  });

  // ---------------------------------------------------------------------------
  // TEST 10: PNG → Voxta Export
  // ---------------------------------------------------------------------------
  await test('PNG → Voxta Export: Assets included', async () => {
    const filePath = join(FIXTURES_DIR, 'Absolute Mother (wedding).png');
    const cards = await importFile(filePath);
    const cardId = cards[0].meta.id;
    cardsToCleanup.push(cardId);

    const assets = await getAssets(cardId);
    console.log(`  Imported assets from PNG: ${assets.length}`);

    const voxtaBuffer = await exportCard(cardId, 'voxta');
    const analysis = analyzeZipContents(voxtaBuffer);

    console.log(`  Voxta export files: ${analysis.files.length}`);
    console.log(`  Has thumbnail: ${analysis.hasThumbnail}`);
    console.log(`  Has character.json: ${analysis.characterJson}`);

    assert(analysis.characterJson, 'Voxta export should have character.json');
    assert(analysis.hasThumbnail, 'Voxta export should have thumbnail');
  });

  // ---------------------------------------------------------------------------
  // TEST 11: Voxta → CHARX Export
  // ---------------------------------------------------------------------------
  await test('Voxta → CHARX Export: Data preserved', async () => {
    const filePath = join(FIXTURES_DIR, 'Princess Elaria Scenario.1.0.0.voxpkg');
    const cards = await importFile(filePath);
    const cardId = cards[0].meta.id;
    cards.forEach(c => cardsToCleanup.push(c.meta.id));

    const originalAssets = await getAssets(cardId);
    console.log(`  Original Voxta assets: ${originalAssets.length}`);

    const charxBuffer = await exportCard(cardId, 'charx');
    const analysis = analyzeZipContents(charxBuffer);

    console.log(`  CHARX files: ${analysis.files.length}`);
    console.log(`  Has icon/main: ${analysis.files.some(f => f.startsWith('icon/'))}`);

    // Re-import the CHARX
    const tempPath = '/tmp/test-voxta-to-charx.charx';
    await fs.writeFile(tempPath, Buffer.from(charxBuffer));

    const reimportedCards = await importFile(tempPath);
    cardsToCleanup.push(reimportedCards[0].meta.id);

    const reimportedAssets = await getAssets(reimportedCards[0].meta.id);
    console.log(`  Reimported CHARX assets: ${reimportedAssets.length}`);

    await fs.unlink(tempPath).catch(() => {});
  });

  // ---------------------------------------------------------------------------
  // TEST 12: Large Voxta package (Kally)
  // ---------------------------------------------------------------------------
  await test('Voxta Import: Large package (Kally)', async () => {
    const filePath = join(FIXTURES_DIR, 'Kally.1.2.0.voxpkg');
    const cards = await importFile(filePath);

    console.log(`  Imported ${cards.length} cards`);
    cards.forEach(c => cardsToCleanup.push(c.meta.id));

    for (const c of cards) {
      const assets = await getAssets(c.meta.id);
      console.log(`    - ${c.meta.name}: ${assets.length} assets`);
    }
  });

  // ---------------------------------------------------------------------------
  // CLEANUP
  // ---------------------------------------------------------------------------
  console.log('\n--- Cleanup ---');
  let cleanedUp = 0;
  for (const cardId of cardsToCleanup) {
    try {
      await deleteCard(cardId);
      cleanedUp++;
    } catch (e) {
      // Ignore
    }
  }
  console.log(`Cleaned up ${cleanedUp}/${cardsToCleanup.length} cards`);

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);

  if (failed > 0) {
    console.log('\n--- FAILURES ---');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`\n✗ ${r.name}`);
      console.log(`  ${r.error}`);
    });
  }

  console.log('\n');
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
