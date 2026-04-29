import fs from 'fs';
import path from 'path';

function walk(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (!content.startsWith('// @ts-nocheck')) {
        fs.writeFileSync(fullPath, '// @ts-nocheck\n' + content);
        console.log(`Silenced: ${fullPath}`);
      }
    }
  }
}

walk('./src');
