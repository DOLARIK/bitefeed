import { env } from "./env.js";
import { buildApp } from "./http/app.js";

const app = buildApp();

app.listen(env.PORT, () => {
  console.log(`Playable Certification Platform listening on ${env.PUBLIC_BASE_URL} (port ${env.PORT})`);
  console.log(`  MCP endpoint:      POST ${env.PUBLIC_BASE_URL}/mcp`);
  console.log(`  Public cert page:  GET  ${env.PUBLIC_BASE_URL}/cert/:id`);
  console.log(`  GitHub webhook:    POST ${env.PUBLIC_BASE_URL}/webhooks/github`);
});
