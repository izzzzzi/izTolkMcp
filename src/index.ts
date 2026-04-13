import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import { registerTools } from "./tools.js";

let version = "0.0.0";
try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));
  version = pkg.version;
} catch {
  // package.json not found — use fallback version
}

function createServer(): McpServer {
  const server = new McpServer(
    { name: "iz-tolk-mcp", version },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );

  registerTools(server);
  registerResources(server);
  registerPrompts(server);

  return server;
}

export { createServer };
export function createSandboxServer() {
  return createServer();
}
