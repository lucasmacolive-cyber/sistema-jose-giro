// @ts-nocheck
import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./routes/index.js";
import { pool } from "./lib/db/index.ts";

const PgSession = (connectPgSimple as any)(session);

const app = (express as any)();

app.use((req: any, _res: any, next: any) => {
  try {
    const u = new URL(req.url || "/", "http://localhost");
    const pathnameParam = u.searchParams.get("__pathname");
    if (
      pathnameParam ||
      u.pathname === "/src/index.ts" ||
      u.pathname === "/api/index.ts"
    ) {
      let targetPath =
        pathnameParam ||
        (req.headers["x-matched-path"] as string) ||
        (req.headers["x-invoke-path"] as string) ||
        "/";
      if (!targetPath.startsWith("/")) targetPath = "/" + targetPath;
      u.searchParams.delete("__pathname");
      const qs = u.searchParams.toString();
      req.url = targetPath + (qs ? `?${qs}` : "");
      req.originalUrl = req.url;
      delete req._parsedUrl;
      delete req._parsedOriginalUrl;
    }
  } catch {}
  next();
});

app.use(
  (pinoHttp as any)({
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(
  session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || "escola-jose-giro-faisca-secret-key-2024",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: false, 
    },
  })
);

app.use("/api", router);
app.use("/", router);

export default app;

