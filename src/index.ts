#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import { registerTools } from "./tools.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8")) as { version: string };

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

const isDirectRun = process.argv[1] && (process.argv[1].endsWith("/index.js") || process.argv[1].endsWith("/index.ts"));

if (isDirectRun) {
  const server = createServer();
  const transport = new StdioServerTransport();
  server.connect(transport).then(
    () => console.error("iz-tolk-mcp server started on stdio"),
    (err) => {
      console.error("Fatal error:", err);
      process.exit(1);
    },
  );
}
