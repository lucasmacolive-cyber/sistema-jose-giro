const fs = require('fs');
let code = fs.readFileSync('artifacts/escola/src/components/CabecalhoTimbrado.tsx', 'utf-8');
const b64 = fs.readFileSync('brasao_b64.txt', 'utf-8');
const newUrl = `data:image/png;base64,${b64}`;
code = code.replace(/export const BRASAO_URL = ".*?";/, `export const BRASAO_URL = "${newUrl}";`);
fs.writeFileSync('artifacts/escola/src/components/CabecalhoTimbrado.tsx', code);
