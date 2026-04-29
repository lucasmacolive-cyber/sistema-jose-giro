import fs from 'fs';
import path from 'path';

function walk(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fullPath.includes('node_modules') || fullPath.includes('.git')) continue;
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      
      // Corrigir os caminhos que ficaram errados como /index.ts/schema
      if (content.includes('index.ts/schema')) {
        content = content.replace(/index\.ts\/schema/g, 'index.ts');
        changed = true;
      }
      
      // Remover a extensão .ts dos imports, o esbuild prefere sem ou resolve sozinho
      // Mas o erro principal era o /schema no final do arquivo
      
      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log(`Fixed import in: ${fullPath}`);
      }
    }
  }
}

walk('./src');
