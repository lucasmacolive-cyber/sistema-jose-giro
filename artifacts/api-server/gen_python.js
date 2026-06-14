import fs from 'fs';
import { readFileSync } from 'fs';

// Read the TS file and extract the python string
const content = readFileSync('./src/routes/impressoes.ts', 'utf-8');
const match = content.match(/function gerarPython\(apiBase: string\) \{([\s\S]*?)export default router;/);

if (match) {
  let pythonStr = match[1].trim();
  // remove return ` and `;}
  pythonStr = pythonStr.replace(/^return `/, '').replace(/`;\n\}$/, '');
  pythonStr = pythonStr.replace(/\$\{apiBase\}/g, "https://sistema-jose-giro-escola.vercel.app");
  
  fs.writeFileSync('C:/Users/kjvtr/SistemaImpressao/impressora_escola.py', pythonStr);
  console.log("Python script written!");
} else {
  console.log("Regex match failed");
}
