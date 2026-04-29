import fs from 'fs';
import path from 'path';

function walk(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      
      // Substituir imports do workspace por caminhos relativos para forçar o bundling pelo esbuild
      if (content.includes('@workspace/api-zod')) {
        content = content.replace(/@workspace\/api-zod/g, '../../lib/api-zod/src/index.ts');
        changed = true;
      }
      if (content.includes('@workspace/db')) {
        content = content.replace(/@workspace\/db/g, '../../lib/db/src/index.ts');
        changed = true;
      }
      
      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated imports: ${fullPath}`);
      }
    }
  }
}

walk('./src');
