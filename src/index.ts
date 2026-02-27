#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import { registerTools } from "./tools.js";

function createServer(): McpServer {
  const server = new McpServer(
    { name: "iz-tolk-mcp", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );

  registerTools(server);
  registerResources(server);
  registerPrompts(server);

  return server;
}

export { createServer };

const server = createServer();

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("iz-tolk-mcp server started on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
