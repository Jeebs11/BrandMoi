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
  const frontendDist = path.resolve(__dirname, "../../brand-os/dist/public");
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(frontendDist, "index.html"));
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

export default app;
