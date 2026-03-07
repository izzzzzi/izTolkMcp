import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beginCell, Cell, contractAddress, storeStateInit } from "@ton/core";
import { getTolkCompilerVersion, runTolkCompiler } from "@ton/tolk-js";
import { z } from "zod";

const MAX_TOTAL_SIZE = 1_048_576; // 1 MB
const MAX_FILE_COUNT = 50;

function validateSources(sources: Record<string, string>, entrypointFileName: string): string | null {
  const keys = Object.keys(sources);

  if (keys.length === 0) {
    return "sources is empty. Provide at least the entrypoint file.";
  }

  if (keys.length > MAX_FILE_COUNT) {
    return `Too many source files (${keys.length}). Maximum is ${MAX_FILE_COUNT}.`;
  }

  if (!(entrypointFileName in sources)) {
    return `Entrypoint file "${entrypointFileName}" not found in sources. ` + `Available files: ${keys.join(", ")}`;
  }

  let totalSize = 0;
  for (const content of Object.values(sources)) {
    totalSize += new TextEncoder().encode(content).byteLength;
  }
  if (totalSize > MAX_TOTAL_SIZE) {
    return `Total sources size (${totalSize} bytes) exceeds limit of ${MAX_TOTAL_SIZE} bytes.`;
  }

  return null;
}

function makeFsReadCallback(sources: Record<string, string>) {
  return (path: string): string => {
    const normalized = path.startsWith("./") ? path.slice(2) : path;
    if (sources[normalized] !== undefined) return sources[normalized];
    if (sources[path] !== undefined) return sources[path];
    throw new Error(
      `File not found: ${path} (available: ${Object.keys(sources).join(", ")}). ` +
        `Note: @stdlib/* imports are resolved automatically by the compiler.`,
    );
  };
}

export function registerTools(server: McpServer): void {
  // ─── Tool 1: get_compiler_version ───────────────────────────────

  server.tool(
    "get_compiler_version",
    "Returns the version of the Tolk compiler (from @ton/tolk-js WASM). " +
      "Use this to check which compiler version is available.",
    {},
    async () => {
      try {
        const version = await getTolkCompilerVersion();
        return {
          content: [{ type: "text", text: `Tolk compiler version: ${version}` }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Failed to get compiler version: ${err.message}` }],
          isError: true,
        };
      }
    },
  );

  // ─── Tool 2: compile_tolk ───────────────────────────────────────

  server.tool(
    "compile_tolk",
    "Compiles Tolk smart contract source code using @ton/tolk-js. " +
      "Provide source files as a map of filename->content. The entrypoint file must be included. " +
      "Standard library imports (@stdlib/*) are resolved automatically. " +
      "Returns compiled Fift code, BoC (Bag of Cells) in base64, and the code hash.",
    {
      entrypointFileName: z.string().describe('The main .tolk file to compile (e.g., "main.tolk")'),
      sources: z
        .record(z.string(), z.string())
        .describe(
          "Object mapping filename -> source code content. Must include the entrypoint file. " +
            'Example: {"main.tolk": "fun main(): int { return 0; }"}',
        ),
      optimizationLevel: z.number().int().min(0).max(2).optional().describe("Optimization level 0-2 (default: 2)"),
      withStackComments: z.boolean().optional().describe("Include stack layout comments in Fift output"),
    },
    async (args) => {
      const { sources, entrypointFileName } = args;

      const validationError = validateSources(sources, entrypointFileName);
      if (validationError) {
        return {
          content: [{ type: "text", text: `Validation error: ${validationError}` }],
          isError: true,
        };
      }

      try {
        const result = await runTolkCompiler({
          entrypointFileName,
          fsReadCallback: makeFsReadCallback(sources),
          optimizationLevel: args.optimizationLevel ?? 2,
          withStackComments: args.withStackComments ?? false,
          experimentalOptions: undefined,
        });

        if (result.status === "error") {
          return {
            content: [{ type: "text", text: `Compilation error:\n\n${result.message}` }],
            isError: true,
          };
        }

        const bocBytes = Buffer.from(result.codeBoc64, "base64");
        const lines: string[] = [
          `## Compilation Successful`,
          "",
          `**Code hash:** \`${result.codeHashHex}\``,
          `**BoC size:** ${bocBytes.length} bytes`,
          "",
          "### Fift output",
          "```fift",
          result.fiftCode,
          "```",
          "",
          "### BoC (base64)",
          "```",
          result.codeBoc64,
          "```",
        ];

        if (result.stderr && result.stderr.length > 0) {
          lines.push("", "### Compiler warnings", "```", result.stderr, "```");
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Unexpected compiler error: ${err.message}` }],
          isError: true,
        };
      }
    },
  );

  // ─── Tool 3: check_tolk_syntax ─────────────────────────────────

  server.tool(
    "check_tolk_syntax",
    "Checks Tolk source code for syntax and type errors without returning full compilation output. " +
      "Faster feedback loop for iterative development. Returns OK + code hash on success, or error details on failure.",
    {
      entrypointFileName: z.string().describe('The main .tolk file to check (e.g., "main.tolk")'),
      sources: z
        .record(z.string(), z.string())
        .describe(
          "Object mapping filename -> source code content. Must include the entrypoint file. " +
            'Example: {"main.tolk": "fun main(): int { return 0; }"}',
        ),
    },
    async (args) => {
      const { sources, entrypointFileName } = args;

      const validationError = validateSources(sources, entrypointFileName);
      if (validationError) {
        return {
          content: [{ type: "text", text: `Validation error: ${validationError}` }],
          isError: true,
        };
      }

      try {
        const result = await runTolkCompiler({
          entrypointFileName,
          fsReadCallback: makeFsReadCallback(sources),
          optimizationLevel: 2,
          withStackComments: false,
          experimentalOptions: undefined,
        });

        if (result.status === "error") {
          return {
            content: [{ type: "text", text: `Syntax/type error:\n\n${result.message}` }],
            isError: true,
          };
        }

        let text = `OK — no errors found.\n\n**Code hash:** \`${result.codeHashHex}\``;
        if (result.stderr && result.stderr.length > 0) {
          text += `\n\n### Warnings\n\`\`\`\n${result.stderr}\n\`\`\``;
        }

        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Unexpected compiler error: ${err.message}` }],
          isError: true,
        };
      }
    },
  );

  // ─── Tool 4: generate_deploy_link ──────────────────────────────

  server.tool(
    "generate_deploy_link",
    "Generates a TON deployment deeplink for a compiled Tolk contract. " +
      "Accepts the compiled code BoC (base64) and optionally initial data BoC. " +
      "Computes the contract address and returns ton:// deeplinks for wallet deployment.",
    {
      codeBoc64: z.string().describe("Base64-encoded BoC of the compiled contract code (from compile_tolk output)"),
      initialDataBoc64: z
        .string()
        .optional()
        .describe("Base64-encoded BoC for the contract initial data cell (default: empty cell)"),
      workchain: z.number().optional().describe("Target workchain ID (default: 0, the basechain)"),
      amount: z
        .string()
        .regex(/^\d+$/, "amount must be a non-negative integer string (nanoTON)")
        .optional()
        .describe('Amount in nanoTON to send with deploy message (default: "50000000" = 0.05 TON)'),
    },
    async (args) => {
      const { codeBoc64, initialDataBoc64, workchain, amount } = args;
      const wc = workchain ?? 0;
      const deployAmount = amount ?? "50000000";

      let code: Cell;
      try {
        code = Cell.fromBase64(codeBoc64);
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error: invalid codeBoc64 — ${err.message}` }],
          isError: true,
        };
      }

      let data: Cell;
      if (initialDataBoc64) {
        try {
          data = Cell.fromBase64(initialDataBoc64);
        } catch (err: any) {
          return {
            content: [{ type: "text", text: `Error: invalid initialDataBoc64 — ${err.message}` }],
            isError: true,
          };
        }
      } else {
        data = beginCell().endCell();
      }

      const stateInit = { code, data };
      const address = contractAddress(wc, stateInit);
      const stateInitCell = beginCell().store(storeStateInit(stateInit)).endCell();
      const stateInitBoc64 = stateInitCell.toBoc().toString("base64");

      const tonLink = `ton://transfer/${address.toString()}?amount=${deployAmount}&stateInit=${encodeURIComponent(stateInitBoc64)}`;
      const tonkeeperLink = `https://app.tonkeeper.com/transfer/${address.toString()}?amount=${deployAmount}&stateInit=${encodeURIComponent(stateInitBoc64)}`;

      const lines: string[] = [
        `## Deployment Information`,
        "",
        `**Contract address:** \`${address.toString()}\``,
        `**Address (raw):** \`${address.toRawString()}\``,
        `**Target workchain:** ${wc}`,
        `**Deploy amount:** ${deployAmount} nanoTON (${Number(deployAmount) / 1e9} TON)`,
        "",
        "### Deployment Links",
        "",
        `**ton:// deeplink** (universal):`,
        "```",
        tonLink,
        "```",
        "",
        `**Tonkeeper link:**`,
        "```",
        tonkeeperLink,
        "```",
        "",
        "### How to deploy",
        "",
        "1. Open one of the links above in a TON wallet (Tonkeeper, Tonhub, etc.)",
        "2. Confirm the transaction — it will deploy the contract to the address shown above",
        "3. The contract address is deterministic — same code + data always produces the same address",
        "",
        `> **Note:** Different initial data produces a different contract address. ` +
          `If no initialDataBoc64 was provided, an empty cell was used.`,
        "",
        "### StateInit BoC (base64)",
        "```",
        stateInitBoc64,
        "```",
      ];

      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );
}
