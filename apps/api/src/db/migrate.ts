#!/usr/bin/env node
import { initDatabase, createTables } from './schema.js';
import { config } from '../config.js';

console.log('Running database migrations...');
console.log(`Database path: ${config.databasePath}`);

const db = initDatabase(config.databasePath);
createTables(db);
db.close();

console.log('Migrations complete!');
