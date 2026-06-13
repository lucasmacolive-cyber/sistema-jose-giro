const fs = require('fs');
const path = require('path');

const routesDir = path.join(process.cwd(), 'artifacts', 'api-server', 'src', 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'));

files.forEach(f => {
  const p = path.join(routesDir, f);
  let c = fs.readFileSync(p, 'utf-8');
  
  // Regex to replace `import { Router, type IRouter } from "express";` or similar with `import { Router, type Request, type Response } from "express";`
  // Actually, some files already import Request/Response. Let's just remove `type IRouter` and `, type IRouter`.
  c = c.replace(/,\s*type IRouter/g, '');
  c = c.replace(/type IRouter,\s*/g, '');
  
  // If it was just `import { type IRouter } from "express"`, which we probably don't have
  c = c.replace(/import\s*\{\s*type IRouter\s*\}\s*from\s*"express";/g, '');
  
  // Replace `const router: IRouter = Router();` with `const router = Router();`
  c = c.replace(/const router:\s*IRouter\s*=\s*Router\(\);/g, 'const router = Router();');
  
  fs.writeFileSync(p, c);
});
console.log('Fixed IRouter in routes');
