import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadContent } from "./content.js";

export function registerPrompts(server: McpServer): void {
  // ─── Prompt 1: write_smart_contract ─────────────────────────────

  server.prompt(
    "write_smart_contract",
    "Guided workflow for writing a new Tolk smart contract on TON",
    {
      description: z.string().describe("Description of what the smart contract should do"),
      contractType: z
        .enum(["counter", "jetton", "nft", "wallet", "custom"])
        .optional()
        .describe("Type of contract to create (default: custom). Provides a relevant example as reference."),
    },
    async (args) => {
      const languageGuide = loadContent("language-guide.md");
      const contractType = args.contractType ?? "custom";

      let example = "";
      let exampleLabel = "";
      if (contractType === "counter") {
        example = loadContent("example-counter.tolk");
        exampleLabel = "Counter contract";
      } else if (contractType === "jetton") {
        example = loadContent("example-jetton.tolk");
        exampleLabel = "Jetton minter contract";
      } else {
        example = loadContent("example-counter.tolk");
        exampleLabel = "Counter contract (basic reference)";
      }

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `# Task: Write a Tolk Smart Contract`,
                "",
                `## User Requirements`,
                "",
                args.description,
                "",
                `## Tolk Language Reference`,
                "",
                languageGuide,
                "",
                `## Example: ${exampleLabel}`,
                "",
                "```tolk",
                example,
                "```",
                "",
                `## Instructions`,
                "",
                `Write a complete Tolk smart contract based on the user requirements above.`,
                "",
                `Follow these guidelines:`,
                `- Use the Tolk language syntax shown in the reference above`,
                `- Use \`getContractData()\` and \`setContractData()\` for persistent storage`,
                `- Use \`beginCell()\` / \`beginParse()\` for manual cell serialization`,
                `- Use \`onInternalMessage(myBalance: int, msgValue: int, msgFull: cell, msgBody: slice)\` as the entrypoint`,
                `- Define opcodes as constants for message routing`,
                `- Include \`get fun\` getters for off-chain queries`,
                `- Handle empty messages gracefully (simple TON transfers)`,
                `- Use error codes between 64 and 2048`,
                `- Add comments explaining key logic`,
                "",
                `After writing the contract, use the \`compile_tolk\` tool to verify it compiles successfully.`,
                `If there are compilation errors, fix them iteratively.`,
              ].join("\n"),
            },
          },
        ],
      };
    },
  );

  // ─── Prompt 2: review_smart_contract ────────────────────────────

  server.prompt(
    "review_smart_contract",
    "Security-focused review of a Tolk smart contract",
    {
      code: z.string().describe("The Tolk smart contract source code to review"),
    },
    async (args) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `# Task: Review Tolk Smart Contract`,
                "",
                `## Contract Code`,
                "",
                "```tolk",
                args.code,
                "```",
                "",
                `## Review Checklist`,
                "",
                `Perform a thorough security review of this Tolk smart contract, checking for:`,
                "",
                `### Access Control`,
                `- Are admin/owner operations properly guarded with address checks?`,
                `- Can unauthorized addresses trigger privileged operations?`,
                "",
                `### Message Handling`,
                `- Are all expected opcodes handled?`,
                `- Is there proper handling for empty messages (simple transfers)?`,
                `- Are unknown opcodes rejected with a throw?`,
                `- Are bounced messages handled to prevent state corruption?`,
                "",
                `### Integer Overflow / Underflow`,
                `- Are balance operations checked for underflow before decrementing?`,
                `- Are there potential overflow issues during arithmetic?`,
                `- Are \`coins\` values validated before use?`,
                "",
                `### Gas and Value Management`,
                `- Is there enough TON value forwarded with outgoing messages?`,
                `- Are gas costs accounted for in value calculations?`,
                `- Are storage fees considered?`,
                `- Are send modes appropriate (CARRY_ALL_REMAINING vs REGULAR)?`,
                "",
                `### Storage Integrity`,
                `- Is contract storage always saved after modifications?`,
                `- Could concurrent messages cause storage corruption?`,
                `- Are all storage fields properly initialized?`,
                "",
                `### TON-Specific Issues`,
                `- Is the contract vulnerable to "drain" attacks (sending all balance)?`,
                `- Are reserve operations used appropriately?`,
                `- Is the contract workchain-aware (basechain vs masterchain)?`,
                "",
                `## Instructions`,
                "",
                `For each issue found:`,
                `1. Describe the vulnerability`,
                `2. Rate severity (Critical / High / Medium / Low / Info)`,
                `3. Provide a concrete fix in Tolk code`,
                "",
                `Also provide an overall assessment and any suggestions for improvement.`,
                `Use the \`check_tolk_syntax\` tool to verify any proposed fixes compile correctly.`,
              ].join("\n"),
            },
          },
        ],
      };
    },
  );

  // ─── Prompt 3: debug_compilation_error ──────────────────────────

  server.prompt(
    "debug_compilation_error",
    "Help diagnose and fix a Tolk compilation error",
    {
      errorMessage: z.string().describe("The compilation error message from the Tolk compiler"),
      code: z.string().describe("The Tolk source code that failed to compile"),
    },
    async (args) => {
      const languageGuide = loadContent("language-guide.md");

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `# Task: Debug Tolk Compilation Error`,
                "",
                `## Error Message`,
                "",
                "```",
                args.errorMessage,
                "```",
                "",
                `## Source Code`,
                "",
                "```tolk",
                args.code,
                "```",
                "",
                `## Tolk Language Reference`,
                "",
                languageGuide,
                "",
                `## Instructions`,
                "",
                `Analyze the compilation error and the source code:`,
                "",
                `1. **Diagnose**: Identify the root cause of the error. Common issues include:`,
                `   - Incorrect function signatures (wrong parameter types or counts)`,
                `   - Using FunC syntax instead of Tolk syntax`,
                `   - Missing semicolons between statements inside functions`,
                `   - Type mismatches (e.g., passing \`int\` where \`int32\` is expected)`,
                `   - Missing imports for stdlib modules`,
                `   - Invalid identifiers (non-alphanumeric characters)`,
                `   - Using unsupported constructs (for loops, break, continue, i++/i--)`,
                "",
                `2. **Fix**: Provide the corrected source code`,
                "",
                `3. **Verify**: Use the \`check_tolk_syntax\` tool to confirm the fix compiles`,
                "",
                `4. **Explain**: Briefly explain what was wrong and why the fix works`,
              ].join("\n"),
            },
          },
        ],
      };
    },
  );
}
