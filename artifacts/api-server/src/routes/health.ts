// @ts-nocheck
import { Router } from "express";
import { HealthCheckResponse } from "../lib/api-zod/index.js";

const router = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
