// @ts-nocheck
import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import alunosRouter from "./alunos.js";
import turmasRouter from "./turmas.js";
import professoresRouter from "./professores.js";
import funcionariosRouter from "./funcionarios.js";
import impressoesRouter from "./impressoes.js";
import documentosRouter from "./documentos.js";
import syncRouter from "./sync.js";
import alertasRouter from "./alertas.js";
import escolaRouter from "./escola.js";
import adminRouter from "./admin.js";
import notasPresencasRouter from "./notas-presencas.js";
import storageRouter from "./storage.js";
import arquivoMortoRouter from "./arquivo-morto.js";
import loginsExternosRouter from "./logins-externos.js";
import aniversariantesRouter from "./aniversariantes.js";
import diarioRouter from "./diario.js";
import calendarioRouter from "./calendario.js";
import roboRouter from "./robo.js";
import whatsappRouter from "./whatsapp.js";

const router = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(alunosRouter);
router.use(turmasRouter);
router.use(professoresRouter);
router.use(funcionariosRouter);
router.use(impressoesRouter);
router.use(documentosRouter);
router.use(syncRouter);
router.use(alertasRouter);
router.use(escolaRouter);
router.use(notasPresencasRouter);
router.use(storageRouter);
router.use(arquivoMortoRouter);
router.use(loginsExternosRouter);
router.use(aniversariantesRouter);
router.use(diarioRouter);
router.use(calendarioRouter);
router.use(roboRouter);
router.use(whatsappRouter);

export default router;
