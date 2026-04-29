import fs from 'fs';
import path from 'path';

function walk(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fullPath.includes('node_modules')) continue;
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      
      // Remover a extensão .ts dos imports internos que eu criei
      // Ex: ./lib/api-zod/index.ts -> ./lib/api-zod/index
      if (content.includes('/lib/api-zod/index.ts')) {
        content = content.split('/lib/api-zod/index.ts').join('/lib/api-zod/index');
        changed = true;
      }
      if (content.includes('/lib/db/index.ts')) {
        content = content.split('/lib/db/index.ts').join('/lib/db/index');
        changed = true;
      }
      
      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log(`Cleaned extension in: ${fullPath}`);
      }
    }
  }
}

walk('./src');
