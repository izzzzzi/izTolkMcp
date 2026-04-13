import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadContent } from "./content.js";

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
          text: loadContent("language-guide.md"),
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
          text: loadContent("stdlib-reference.md"),
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
          text: loadContent("changelog.md"),
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
          text: loadContent("tolk-vs-func.md"),
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
          text: loadContent("example-counter.tolk"),
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
          text: loadContent("example-jetton.tolk"),
        },
      ],
    }),
  );
}
