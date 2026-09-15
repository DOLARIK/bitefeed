import express, { type Express, type Request, type ErrorRequestHandler } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMcpServer } from "../mcp/server.js";
import { authMiddleware } from "./authMiddleware.js";
import { getCertificateById } from "../services/certificates.js";
import { renderCertificatePage, renderNotFoundPage, publicSigningKeyResponse } from "./certPage.js";
import { handleGithubWebhook } from "./githubWebhook.js";

export function buildApp(): Express {
  const app = express();

  app.use(
    express.json({
      limit: "10mb", // bundles can be a few MB; keep headroom over the 5MB spec ceiling
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: string }).rawBody = buf.toString("utf8");
      },
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // MCP endpoint — stateless: a fresh server + transport per request, since
  // this service does not need session-scoped MCP state across calls.
  app.post("/mcp", authMiddleware(), async (req, res) => {
    const server = buildMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/.well-known/certification-signing-key", (_req, res) => {
    res.json(publicSigningKeyResponse());
  });

  // Public read path — no auth. This is the entire point of a certificate.
  app.get("/cert/:id", async (req, res) => {
    const certificate = await getCertificateById(req.params.id);
    if (!certificate) {
      res.status(404).type("html").send(renderNotFoundPage(req.params.id));
      return;
    }
    res.type("html").send(renderCertificatePage(certificate));
  });

  app.get("/api/certificates/:id", async (req, res) => {
    const certificate = await getCertificateById(req.params.id);
    if (!certificate) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({
      id: certificate.id,
      status: certificate.status,
      commit_hash: certificate.commitHash,
      network: certificate.network,
      issued_at: certificate.issuedAt.toISOString(),
      checked_at: certificate.lastCheckedAt.toISOString(),
    });
  });

  app.post("/webhooks/github", handleGithubWebhook);

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    if (res.headersSent) return;
    res.status(500).json({ error: "internal_error" });
  };
  app.use(onError);

  return app;
}
