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
      
      // Substituir imports que terminam em /index ou caminhos relativos sem extensão por .js
      // Node.js em modo ESM na Vercel EXIGE .js para arquivos locais
      
      // Regex para encontrar imports de arquivos locais (que começam com .)
      const regex = /from\s+["'](\.\.?\/.*?)["']/g;
      const matches = content.matchAll(regex);
      
      for (const match of matches) {
        const fullImport = match[0];
        const importPath = match[1];
        
        // Se o path não tem extensão, adicionamos .js
        if (!importPath.endsWith('.js') && !importPath.endsWith('.json') && !importPath.endsWith('.css')) {
           const newImport = fullImport.replace(importPath, importPath + '.js');
           content = content.replace(fullImport, newImport);
           changed = true;
        }
      }
      
      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log(`Added .js extension to imports in: ${fullPath}`);
      }
    }
  }
}

walk('./src');
