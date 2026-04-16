import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import http from "http";
import router from "./routes/index.js";

const app: Express = express();

app.set("trust proxy", true);

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  const frontendDist = path.resolve(__dirname, "public");
  const indexPath = path.join(frontendDist, "index.html");
  const dirExists = fs.existsSync(frontendDist);
  const indexExists = fs.existsSync(indexPath);
  console.log("[startup] __dirname:", __dirname);
  console.log("[startup] frontendDist:", frontendDist, "exists:", dirExists);
  console.log("[startup] index.html:", indexPath, "exists:", indexExists);

  if (indexExists) {
    const indexHtml = fs.readFileSync(indexPath, "utf-8");
    console.log("[startup] index.html loaded, size:", indexHtml.length, "bytes");
    app.use(express.static(frontendDist));
    app.get("/{*splat}", (_req, res) => {
      res.type("html").send(indexHtml);
    });
  } else {
    console.warn("[startup] index.html not found — serving 503 for all frontend routes");
    app.get("/{*splat}", (_req, res) => {
      res.status(503).send(`Frontend unavailable. Dir exists: ${dirExists}, index exists: ${indexExists}, path: ${indexPath}`);
    });
  }
} else {
  const BRAND_OS_PORT = process.env.BRAND_OS_DEV_PORT ?? "18565";
  app.use((req, res) => {
    const options = {
      hostname: "localhost",
      port: parseInt(BRAND_OS_PORT),
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `localhost:${BRAND_OS_PORT}` },
    };
    const proxy = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });
    req.pipe(proxy, { end: true });
    proxy.on("error", () => {
      if (!res.headersSent) res.status(502).send("Frontend dev server unavailable — start the brand-os workflow");
    });
  });
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[unhandled-error]", err?.code, err?.status, err?.message);
  if (!res.headersSent) {
    res.status(err?.status || 500).send(err?.message || "Internal Server Error");
  }
});

export default app;
