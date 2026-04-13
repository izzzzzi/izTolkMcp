#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./index.js";

const server = createServer();
const transport = new StdioServerTransport();
server.connect(transport).then(
  () => console.error("iz-tolk-mcp server started on stdio"),
  (err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  },
);
