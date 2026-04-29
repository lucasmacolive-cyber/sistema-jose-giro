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
      
      // Remover a extensão .ts de QUALQUER import que termine em .ts
      const regex = /import\s+.*?\s+from\s+["'](\..*?)\.ts["']/g;
      const matches = content.matchAll(regex);
      
      for (const match of matches) {
        const fullImport = match[0];
        const pathWithoutExt = fullImport.replace('.ts"', '"').replace(".ts'", "'");
        content = content.replace(fullImport, pathWithoutExt);
        changed = true;
      }
      
      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log(`Cleaned all extensions in: ${fullPath}`);
      }
    }
  }
}

walk('./src');
