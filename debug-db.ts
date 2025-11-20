
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'apps/api/data/cards.db');
const db = new Database(dbPath);

const cards = db.prepare('SELECT data, tags FROM cards').all();

console.log(`Found ${cards.length} cards.`);

cards.forEach((card: any) => {
  const data = JSON.parse(card.data);
  const tags = JSON.parse(card.tags || '[]');
  
  if (tags.includes('voxta')) {
    console.log(`\nVoxta Card: ${data.data.name}`);
    
    const description = data.data.description || '';
    const appearance = data.data.extensions?.voxta?.appearance || '';
    
    console.log(`Description (Profile) length: ${description.length}`);
    console.log(`Description start: ${description.slice(0, 50)}...`);
    console.log(`Description end: ...${description.slice(-50)}`);
    
    console.log(`Appearance (Description) length: ${appearance.length}`);
    console.log(`Appearance start: ${appearance.slice(0, 50)}...`);
    console.log(`Appearance end: ...${appearance.slice(-50)}`);
  }
});
