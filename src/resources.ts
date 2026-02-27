import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const currentDir = import.meta.url ? dirname(fileURLToPath(import.meta.url)) : process.cwd();
const contentDir = join(currentDir, "content");

function loadContent(filename: string): string {
  return readFileSync(join(contentDir, filename), "utf-8");
}

// Lazy-loaded content cache
let _cache: Record<string, string> | null = null;

function getContent(): Record<string, string> {
  if (!_cache) {
    _cache = {
      "language-guide": loadContent("language-guide.md"),
      "stdlib-reference": loadContent("stdlib-reference.md"),
      changelog: loadContent("changelog.md"),
      "tolk-vs-func": loadContent("tolk-vs-func.md"),
      "example-counter": loadContent("example-counter.tolk"),
      "example-jetton": loadContent("example-jetton.tolk"),
    };
  }
  return _cache;
}

export function registerResources(server: McpServer): void {
  server.resource(
    "language-guide",
    "tolk://docs/language-guide",
    { description: "Complete Tolk language syntax reference", mimeType: "text/markdown" },
    async () => ({
      contents: [
        {
          uri: "tolk://docs/language-guide",
          mimeType: "text/markdown",
          text: getContent()["language-guide"],
        },
      ],
    }),
  );

  server.resource(
    "stdlib-reference",
    "tolk://docs/stdlib-reference",
    { description: "Standard library modules and functions reference", mimeType: "text/markdown" },
    async () => ({
      contents: [
        {
          uri: "tolk://docs/stdlib-reference",
          mimeType: "text/markdown",
          text: getContent()["stdlib-reference"],
        },
      ],
    }),
  );

  server.resource(
    "changelog",
    "tolk://docs/changelog",
    { description: "Tolk compiler version history from v0.6 to latest", mimeType: "text/markdown" },
    async () => ({
      contents: [
        {
          uri: "tolk://docs/changelog",
          mimeType: "text/markdown",
          text: getContent().changelog,
        },
      ],
    }),
  );

  server.resource(
    "tolk-vs-func",
    "tolk://docs/tolk-vs-func",
    { description: "FunC to Tolk migration guide — key differences and comparison", mimeType: "text/markdown" },
    async () => ({
      contents: [
        {
          uri: "tolk://docs/tolk-vs-func",
          mimeType: "text/markdown",
          text: getContent()["tolk-vs-func"],
        },
      ],
    }),
  );

  server.resource(
    "example-counter",
    "tolk://examples/counter",
    { description: "Simple counter smart contract example in Tolk", mimeType: "text/x-tolk" },
    async () => ({
      contents: [
        {
          uri: "tolk://examples/counter",
          mimeType: "text/x-tolk",
          text: getContent()["example-counter"],
        },
      ],
    }),
  );

  server.resource(
    "example-jetton",
    "tolk://examples/jetton",
    { description: "Jetton (fungible token) minter contract example in Tolk", mimeType: "text/x-tolk" },
    async () => ({
      contents: [
        {
          uri: "tolk://examples/jetton",
          mimeType: "text/x-tolk",
          text: getContent()["example-jetton"],
        },
      ],
    }),
  );
}
