import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { CardRepository, AssetRepository, CardAssetRepository } from '../src/db/repository.js';
import { CardImportService } from '../src/services/card-import.service.js';
import { buildCharx } from '@character-foundry/character-foundry/charx';
import { detectSpec, type CCv2Data, type CCv3Data } from '@character-foundry/character-foundry/schemas';
import { config } from '../src/config.js';
import { runMigrations } from '../src/db/migrations.js';
import { validateCharxExport, applyExportFixes } from '../src/utils/charx-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TARGET_IDS = [
  '_c22_8zNjNbvdDOiTiE7u',
  'NOYHsM-6DOrRf21SxisjG',
  'Tkf24xeWEC5vPf4jIfcho',
  'a8S4i5rU54wzO3e5UVu7S',
  '8E1vxeuK0vZ5JOgibPES7'
];

async function runTest() {
  console.log('=== Real World Card Verification ===');
  console.log(`Database: ${config.databasePath}`);
  
  if (!config.databasePath) {
      console.error('Database path not found');
      process.exit(1);
  }

  // 1. Connect to REAL database (Read-Only mode if possible, but better-sqlite3 opens RW by default)
  const realDb = new Database(config.databasePath, { readonly: true });
  const realCardRepo = new CardRepository(realDb);
  const realCardAssetRepo = new CardAssetRepository(realDb);
  const realAssetRepo = new AssetRepository(realDb);

  // 2. Setup TEMP database for re-import verification
  const tempDb = new Database(':memory:');
  runMigrations(tempDb); // Initialize schema
  const tempCardRepo = new CardRepository(tempDb);
  const tempAssetRepo = new AssetRepository(tempDb);
  const tempCardAssetRepo = new CardAssetRepository(tempDb);
  
  // Service for importing into TEMP db
  const importService = new CardImportService(tempCardRepo, tempAssetRepo, tempCardAssetRepo);
  
  // Mock storage path for temp imports
  const tempStoragePath = join(__dirname, '../../temp_test_storage');
  await fs.mkdir(tempStoragePath, { recursive: true });

  try {
    for (const id of TARGET_IDS) {
      console.log(`
--- Testing Card: ${id} ---`);
      
      const card = realCardRepo.get(id);
      if (!card) {
        console.error(`Card ${id} not found in database!`);
        continue;
      }

      console.log(`Name: ${card.meta.name}`);
      console.log(`Spec: ${card.meta.spec}`);
      
      // Count assets
      const assets = realCardAssetRepo.listByCardWithDetails(id);
      console.log(`Asset Count: ${assets.length}`);
      assets.forEach(a => {
          console.log(`  - ${a.type}/${a.name}.${a.ext} (Main: ${a.isMain})`);
      });

      // --- EXPORT TO CHARX ---
      console.log('Exporting to CHARX...');
      
      // Prepare data for export (Conversion logic from import-export.ts)
      let charxData: CCv3Data;
      const currentSpec = detectSpec(card.data);

      if (currentSpec === 'v2') {
        const v2Data = card.data as unknown as { spec?: string; spec_version?: string; data?: CCv2Data } & CCv2Data;
        const sourceData = v2Data.data || v2Data;
        charxData = {
          spec: 'chara_card_v3',
          spec_version: '3.0',
          data: {
            name: sourceData.name || '',
            description: sourceData.description || '',
            personality: sourceData.personality || '',
            scenario: sourceData.scenario || '',
            first_mes: sourceData.first_mes || '',
            mes_example: sourceData.mes_example || '',
            creator: sourceData.creator || '',
            character_version: sourceData.character_version || '',
            tags: sourceData.tags || [],
            creator_notes: sourceData.creator_notes || '',
            system_prompt: sourceData.system_prompt || '',
            post_history_instructions: sourceData.post_history_instructions || '',
            alternate_greetings: sourceData.alternate_greetings || [],
            group_only_greetings: [],
            character_book: sourceData.character_book as CCv3Data['data']['character_book'],
            extensions: sourceData.extensions,
          },
        } as CCv3Data;
      } else {
        charxData = card.data as CCv3Data;
      }

      // Validation
      const validation = await validateCharxExport(charxData, assets, config.storagePath);
      if (validation.errors.length > 0) {
          console.error('Export Validation Errors:', validation.errors);
      }
      if (validation.warnings.length > 0) {
          console.warn('Export Validation Warnings:', validation.warnings);
      }
      
      // Fixes
      let exportAssets = assets;
      if (validation.fixes.length > 0) {
          exportAssets = applyExportFixes(assets);
          console.log(`Applied ${validation.fixes.length} fixes to assets.`);
      }

      // Read actual asset buffers for building
      const charxAssets = [];
      for (const asset of exportAssets) {
          try {
              // Resolve path relative to config.storagePath
              // asset.asset.url is like /storage/id/file.png
              const relPath = asset.asset.url.replace('/storage/', '');
              const fullPath = join(config.storagePath, relPath);
              const buffer = await fs.readFile(fullPath);
              
              charxAssets.push({
                  type: asset.type,
                  name: asset.name,
                  ext: asset.ext,
                  data: buffer,
                  isMain: asset.isMain
              });
          } catch (err) {
              console.error(`Failed to load asset ${asset.name}:`, err);
          }
      }

      // Build
      const result = buildCharx(charxData, charxAssets);
      console.log(`CHARX built. Size: ${result.totalSize} bytes. Assets in ZIP: ${result.assetCount}`);

      // --- RE-IMPORT VERIFICATION ---
      console.log('Re-importing to temp DB for verification...');
      
      // Create temp file for import service
      const tempCharxPath = join(tempStoragePath, `${id}.charx`);
      await fs.writeFile(tempCharxPath, result.buffer);

      const importResult = await importService.importCharxFromFile(tempCharxPath, {
          storagePath: tempStoragePath,
          preserveTimestamps: true,
          setAsOriginalImage: true
      });

      console.log(`Re-imported Name: ${importResult.card.meta.name}`);
      console.log(`Re-imported Spec: ${importResult.card.meta.spec}`);
      console.log(`Re-imported Assets: ${importResult.assetsImported}`);
      
      // COMPARE
      if (importResult.card.meta.name !== card.meta.name) {
          console.error(`MISMATCH: Name changed from "${card.meta.name}" to "${importResult.card.meta.name}"`);
      }
      
      // Check asset count matches (ignoring potential duplicate drops if any)
      // Note: import result counts imported assets, charx build counts exported.
      // If we had read errors, count might differ.
      if (importResult.assetsImported !== charxAssets.length) {
          console.warn(`Asset count mismatch: Exported ${charxAssets.length}, Imported ${importResult.assetsImported}`);
      }

      // Check specific fields
      const originalData = (currentSpec === 'v2' ? (card.data as any).data || card.data : (card.data as any).data);
      const newData = importResult.card.data.data;

      const originalAlts = originalData.alternate_greetings?.length || 0;
      const newAlts = newData.alternate_greetings?.length || 0;
      if (originalAlts !== newAlts) {
          console.error(`MISMATCH: Alternate greetings count ${originalAlts} -> ${newAlts}`);
      } else {
          console.log(`Alternate greetings preserved: ${newAlts}`);
      }

      // Clean up temp file
      await fs.unlink(tempCharxPath);
    }
  } catch (err) {
    console.error('Test failed with error:', err);
  } finally {
    // Cleanup
    realDb.close();
    tempDb.close();
    await fs.rm(tempStoragePath, { recursive: true, force: true });
  }
}

runTest();
