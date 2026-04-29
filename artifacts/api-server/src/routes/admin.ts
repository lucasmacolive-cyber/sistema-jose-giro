// @ts-nocheck
import { Router, type IRouter } from "express";
import { pool } from "../../lib/db/src/index.ts";

const router: IRouter = Router();

const TABELAS_PERMITIDAS = ["alunos", "turmas", "professores", "funcionarios", "usuarios"];

function requireMaster(req: any, res: any, next: any) {
  const perfil = req.session?.perfil;
  if (!perfil) {
    res.status(401).json({ erro: "nao_autenticado" });
    return;
  }
  if (perfil !== "Master" && perfil !== "Direção") {
    res.status(403).json({ erro: "sem_permissao" });
    return;
  }
  next();
}

// GET /api/admin/:tabela
router.get("/admin/:tabela", requireMaster, async (req, res) => {
  const { tabela } = req.params;
  if (!TABELAS_PERMITIDAS.includes(tabela)) {
    res.status(400).json({ erro: "tabela_invalida" });
    return;
  }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"))));
  const offset = (page - 1) * limit;
  const search = String(req.query.search ?? "").trim();

  try {
    let whereClause = "";
    const params: any[] = [limit, offset];

    if (search) {
      const colRes = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = $1 AND data_type IN ('text','character varying')
         ORDER BY ordinal_position`,
        [tabela]
      );
      const cols = colRes.rows.map((r: any) => r.column_name);
      if (cols.length > 0) {
        params.push(`%${search}%`);
        const conditions = cols.map((c: string) => `CAST(${c} AS text) ILIKE $${params.length}`).join(" OR ");
        whereClause = `WHERE ${conditions}`;
      }
    }

    const dataRes = await pool.query(
      `SELECT * FROM ${tabela} ${whereClause} ORDER BY id LIMIT $1 OFFSET $2`,
      params
    );

    const countParams = search ? [params[params.length - 1]] : [];
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM ${tabela} ${whereClause.replace(/\$\d+/g, search ? `$1` : "")}`,
      countParams
    );

    res.json({ rows: dataRes.rows, total: parseInt(countRes.rows[0].count), page, limit });
  } catch (e: any) {
    res.status(500).json({ erro: "erro_consulta", mensagem: e.message });
  }
});

// GET /api/admin/:tabela/colunas
router.get("/admin/:tabela/colunas", requireMaster, async (req, res) => {
  const { tabela } = req.params;
  if (!TABELAS_PERMITIDAS.includes(tabela)) {
    res.status(400).json({ erro: "tabela_invalida" });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = $1
       ORDER BY ordinal_position`,
      [tabela]
    );
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ erro: "erro_colunas", mensagem: e.message });
  }
});

// POST /api/admin/:tabela
router.post("/admin/:tabela", requireMaster, async (req, res) => {
  const { tabela } = req.params;
  if (!TABELAS_PERMITIDAS.includes(tabela)) {
    res.status(400).json({ erro: "tabela_invalida" });
    return;
  }

  const dados = { ...req.body };
  delete dados.id;

  const campos = Object.keys(dados).filter((k) => dados[k] !== "" && dados[k] !== null && dados[k] !== undefined);
  if (campos.length === 0) {
    res.status(400).json({ erro: "sem_dados" });
    return;
  }

  const placeholders = campos.map((_, i) => `$${i + 1}`).join(", ");
  const valores = campos.map((c) => dados[c] ?? null);

  try {
    const result = await pool.query(
      `INSERT INTO ${tabela} (${campos.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      valores
    );
    res.json(result.rows[0]);
  } catch (e: any) {
    res.status(500).json({ erro: "erro_insercao", mensagem: e.message });
  }
});

// PUT /api/admin/:tabela/:id
router.put("/admin/:tabela/:id", requireMaster, async (req, res) => {
  const { tabela, id } = req.params;
  if (!TABELAS_PERMITIDAS.includes(tabela)) {
    res.status(400).json({ erro: "tabela_invalida" });
    return;
  }

  const dados = { ...req.body };
  delete dados.id;

  const campos = Object.keys(dados);
  if (campos.length === 0) {
    res.status(400).json({ erro: "sem_dados" });
    return;
  }

  const sets = campos.map((c, i) => `${c} = $${i + 1}`).join(", ");
  const valores: any[] = campos.map((c) => (dados[c] === "" ? null : dados[c]));
  valores.push(id);

  try {
    await pool.query(`UPDATE ${tabela} SET ${sets} WHERE id = $${valores.length}`, valores);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ erro: "erro_atualizacao", mensagem: e.message });
  }
});

// DELETE /api/admin/:tabela/:id
router.delete("/admin/:tabela/:id", requireMaster, async (req, res) => {
  const { tabela, id } = req.params;
  if (!TABELAS_PERMITIDAS.includes(tabela)) {
    res.status(400).json({ erro: "tabela_invalida" });
    return;
  }

  try {
    await pool.query(`DELETE FROM ${tabela} WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ erro: "erro_exclusao", mensagem: e.message });
  }
});

export default router;
