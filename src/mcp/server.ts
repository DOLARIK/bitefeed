import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { submitForValidationInputShape, submitForValidationHandler } from "./tools/submitForValidation.js";
import { getCertificateInputShape, getCertificateHandler } from "./tools/getCertificate.js";
import { getPlayableSpecsInputShape, getPlayableSpecsHandler } from "./tools/getPlayableSpecs.js";
import { connectRepoInputShape, connectRepoHandler } from "./tools/connectRepo.js";

/**
 * Builds a fresh McpServer instance. Called once per HTTP request in
 * stateless mode (see src/http/app.ts) — tool registration is cheap and this
 * avoids any cross-request state leaking through a shared server instance.
 */
export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: "playable-certification-platform", version: "0.1.0" });

  server.registerTool(
    "submit_for_validation",
    {
      title: "Submit a playable bundle for validation",
      description:
        "Runs server-side packaging and manifest-consistency checks against a playable ad bundle and, on pass, issues a signed certificate tied to the commit hash in the manifest. Requires Authorization: Bearer <api_key>.",
      inputSchema: submitForValidationInputShape,
    },
    submitForValidationHandler,
  );

  server.registerTool(
    "get_certificate",
    {
      title: "Get certificate status",
      description:
        "Publicly resolves a certificate's current status (valid/stale/failed), commit hash, network, and timestamps. No authentication required.",
      inputSchema: getCertificateInputShape,
    },
    getCertificateHandler,
  );

  server.registerTool(
    "get_playable_specs",
    {
      title: "Get current playable ad specs",
      description:
        "Returns the current packaging limits and requirements for a given ad network, served live so callers don't need to keep a local copy in sync. Requires Authorization: Bearer <api_key>.",
      inputSchema: getPlayableSpecsInputShape,
    },
    getPlayableSpecsHandler,
  );

  server.registerTool(
    "connect_repo",
    {
      title: "Connect a GitHub repo for drift monitoring",
      description:
        "Registers a GitHub repo + branch to watch for a certificate, so the service can flag the certificate as stale when the branch moves past the certified commit. Requires Authorization: Bearer <api_key>.",
      inputSchema: connectRepoInputShape,
    },
    connectRepoHandler,
  );

  return server;
}
