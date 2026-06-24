import { db } from "../lib/db/src/index.js";
import { diarioAulasTable, diarioPresencasTable } from "../lib/db/src/schema/diario.js";
import { alunosTable } from "../lib/db/src/schema/alunos.js";
import { filaWhatsappTable } from "../lib/db/src/schema/fila-whatsapp.js";
import { eq, inArray } from "drizzle-orm";

async function main() {
  try {
    const targetNumber = "5522992189033"; // User's personal phone number formatted for WhatsApp

    // 1. Get all students of 1AT02
    console.log("Fetching students...");
    const students = await db.select({
      id: alunosTable.id,
      nomeCompleto: alunosTable.nomeCompleto,
    })
      .from(alunosTable)
      .where(eq(alunosTable.turmaAtual, "1AT02"));

    // 2. Get all classes of 1AT02
    console.log("Fetching classes...");
    const classes = await db.select()
      .from(diarioAulasTable)
      .where(eq(diarioAulasTable.turmaNome, "1AT02"))
      .orderBy(diarioAulasTable.data);

    const classIds = classes.map(c => c.id);

    // 3. Get all presences for those classes
    console.log("Fetching presences...");
    let presences: any[] = [];
    if (classIds.length > 0) {
      presences = await db.select()
        .from(diarioPresencasTable)
        .where(inArray(diarioPresencasTable.aulaId, classIds));
    }

    // Map presences by student and class
    const presenceMap: Record<number, Record<number, string>> = {};
    for (const p of presences) {
      if (!presenceMap[p.alunoId]) presenceMap[p.alunoId] = {};
      presenceMap[p.alunoId][p.aulaId] = p.status;
    }

    // 4. Calculate stats for each student
    const studentStats = students.map(student => {
      let presencesCount = 0;
      let absencesCount = 0;
      
      for (const cls of classes) {
        const status = presenceMap[student.id]?.[cls.id] || "P"; // Default to present if not marked
        if (status === "P") presencesCount++;
        else if (status === "F") absencesCount++;
      }

      const total = presencesCount + absencesCount;
      const freqPct = total > 0 ? Math.round((presencesCount / total) * 100) : 100;

      return {
        nome: student.nomeCompleto,
        presencas: presencesCount,
        faltas: absencesCount,
        freqPct,
      };
    });

    // Sort students by name
    studentStats.sort((a, b) => a.nome.localeCompare(b.nome));

    // Calculate general class statistics
    const totalP = studentStats.reduce((sum, s) => sum + s.presencas, 0);
    const totalF = studentStats.reduce((sum, s) => sum + s.faltas, 0);
    const totalPresencesRegistered = totalP + totalF;
    const avgFreq = totalPresencesRegistered > 0 ? ((totalP / totalPresencesRegistered) * 100).toFixed(2) : "100.00";

    // 5. Compile the message
    let msg = `*DIÁRIO DE CLASSE - 1º ANO TARDE (1AT02)*\n`;
    msg += `🏫 Escola Municipal José Giro Faísca\n\n`;
    msg += `*Resumo Geral da Turma:*\n`;
    msg += `• Total de Alunos: ${students.length}\n`;
    msg += `• Aulas Registradas: ${classes.length}\n`;
    msg += `• Total de Presenças (P): ${totalP}\n`;
    msg += `• Total de Faltas (F): ${totalF}\n`;
    msg += `• Frequência Média da Turma: *${avgFreq}%*\n\n`;

    msg += `*Lista de Alunos e Frequência (%):*\n`;
    studentStats.forEach((s, idx) => {
      msg += `${idx + 1}. ${s.nome}: *${s.freqPct}%* (${s.presencas} pres. / ${s.faltas} faltas)\n`;
    });

    msg += `\n*Últimas 5 Aulas Registradas:*\n`;
    const lastClasses = [...classes].reverse().slice(0, 5);
    lastClasses.forEach(c => {
      msg += `• ${c.data}: Aula Normal (${c.numeroAulas} aula(s))\n`;
    });

    msg += `\n*Status do Envio:* Teste de integração do WhatsApp.`;

    console.log("------------------------");
    console.log(msg);
    console.log("------------------------");

    // 6. Insert into queue
    console.log("Inserting message into fila_whatsapp...");
    await db.insert(filaWhatsappTable).values({
      numero: targetNumber,
      mensagem: msg,
      status: "Pendente",
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    });
    console.log("Successfully queued message!");

  } catch (err) {
    console.error("Error generating/queuing diary test:", err);
  }
  process.exit(0);
}

main();
