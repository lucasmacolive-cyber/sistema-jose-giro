export function extrairAlunosDeHtmlSUAP(html: string): Record<string, any>[] {
  const rows: Record<string, any>[] = [];
  
  // RegEx para capturar Nome e Matrícula no formato do SUAP: NOME COMPLETO (20261031610007)
  const matches = [...html.matchAll(/([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{3,100})\s*\(((?:19|20)\d{10,12})\)/g)];
  
  const vistos = new Set<string>();

  for (const m of matches) {
    const nome = m[1].trim();
    const matricula = m[2].trim();

    if (nome && matricula && !vistos.has(matricula)) {
      vistos.add(matricula);
      rows.push({
        "Nome do Aluno": nome,
        "Matrícula": matricula,
        "Situação": "Matriculado"
      });
    }
  }
  return rows;
}

// Teste rápido com trecho HTML do SUAP
const sampleHtml = `
  <tr><td>AKILLA VITORIA CORDEIRO DE ALMEIDA (20261031610002)</td><td>1</td><td>Matriculado</td></tr>
  <tr><td>ELOA NETO BENTO (20261031610007)</td><td>1</td><td>Matriculado</td></tr>
  <tr><td>MARIA EDUARDA PESSANHA (20261031610013)</td><td>1</td><td>Matriculado</td></tr>
`;

const result = extrairAlunosDeHtmlSUAP(sampleHtml);
console.log("Resultado do parser HTML do SUAP:", result);
