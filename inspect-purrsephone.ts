
import yauzl from 'yauzl';
import fs from 'fs';

const zipPath = 'voxpkg/Purrsephone.1.0.6.voxpkg';

yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
  if (err) throw err;
  
  zipfile.on('entry', (entry) => {
    if (entry.fileName.endsWith('character.json')) {
      console.log(`Reading ${entry.fileName}...`);
      zipfile.openReadStream(entry, (err, stream) => {
        if (err) throw err;
        const chunks: Buffer[] = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const text = buffer.toString('utf8');
          console.log(`Raw text length: ${text.length}`);
          
          try {
            const json = JSON.parse(text);
            console.log('Name:', json.Name);
            console.log('Label:', json.Label);
            console.log('Description length:', json.Description?.length);
            console.log('Profile length:', json.Profile?.length);
            console.log('Profile value sample (last 100):', JSON.stringify(json.Profile?.slice(-100)));
            
            // Check if it looks like it was cut off in the JSON itself
            // (Unlikely if JSON.parse succeeded, but possible if the string content was truncated before saving)
            
          } catch (e) {
            console.error('Failed to parse JSON:', e);
          }
        });
      });
    } else {
      zipfile.readEntry();
    }
  });
  zipfile.readEntry();
});
