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
      
      // Encontrar a profundidade do arquivo para calcular o caminho relativo para src/lib
      const relativeToSrc = path.relative(path.dirname(fullPath), 'src/lib');
      const prefix = relativeToSrc.startsWith('..') ? relativeToSrc : './' + relativeToSrc;
      
      // Substituir os imports relativos externos pelos internos
      // Os arquivos em src/routes por exemplo usavam ../../lib/api-zod/src/index.ts
      // Agora devem usar ../lib/api-zod/index.ts (se estiverem em src/routes)
      
      const newApiZod = prefix.replace(/\\/g, '/') + '/api-zod/index.ts';
      const newDb = prefix.replace(/\\/g, '/') + '/db/index.ts';

      if (content.includes('../../lib/api-zod/src/index.ts')) {
        content = content.replace(/\.\.\/\.\.\/lib\/api-zod\/src\/index\.ts/g, newApiZod);
        changed = true;
      }
      if (content.includes('../../lib/db/src/index.ts')) {
        content = content.replace(/\.\.\/\.\.\/lib\/db\/src\/index\.ts/g, newDb);
        changed = true;
      }
      
      // Também tratar imports do workspace que podem ter sobrado
      if (content.includes('@workspace/api-zod')) {
        content = content.replace(/@workspace\/api-zod/g, newApiZod);
        changed = true;
      }
      if (content.includes('@workspace/db')) {
        content = content.replace(/@workspace\/db/g, newDb);
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated to internal: ${fullPath} -> ${newApiZod}`);
      }
    }
  }
}

walk('./src');
