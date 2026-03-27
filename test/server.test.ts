import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { getTolkCompilerVersion, runTolkCompiler } from "@ton/tolk-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "../src/index.js";

// ─────────────────────────────────────────────────────────────────
// Helper: minimal valid Tolk contract
// ─────────────────────────────────────────────────────────────────

const MINIMAL_CONTRACT = `fun main(): int { return 0; }`;

const COUNTER_CONTRACT = `
const OP_INCREMENT = 1;

fun loadData(): int {
    val ds = getContractData().beginParse();
    return ds.loadInt(32);
}

fun saveData(counter: int) {
    setContractData(
        beginCell().storeInt(counter, 32).endCell()
    );
}

fun onInternalMessage(myBalance: int, msgValue: int, msgFull: cell, msgBody: slice) {
    if (msgBody.remainingBitsCount() < 32) { return; }
    val op = msgBody.loadUint(32);
    if (op == OP_INCREMENT) {
        var counter = loadData();
        counter += 1;
        saveData(counter);
        return;
    }
    throw 0xFFFF;
}

get fun counter(): int {
    return loadData();
}
`;

const INVALID_CODE = `fun broken(: int { return; }`;

// ─────────────────────────────────────────────────────────────────
// Group 1: Direct tolk-js compiler tests
// ─────────────────────────────────────────────────────────────────

describe("Direct tolk-js compiler", () => {
  it("returns compiler version", async () => {
    const version = await getTolkCompilerVersion();
    expect(version).toMatch(/^\d+\.\d+/);
  });

  it("compiles a minimal contract", async () => {
    const result = await runTolkCompiler({
      entrypointFileName: "main.tolk",
      fsReadCallback: () => MINIMAL_CONTRACT,
      optimizationLevel: 2,
      withStackComments: false,
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.codeHashHex).toMatch(/^[0-9a-fA-F]{64}$/);
      expect(result.codeBoc64).toBeTruthy();
      expect(result.fiftCode).toBeTruthy();
    }
  });

  it("reports compilation errors for invalid code", async () => {
    const result = await runTolkCompiler({
      entrypointFileName: "main.tolk",
      fsReadCallback: () => INVALID_CODE,
      optimizationLevel: 2,
      withStackComments: false,
    });
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toBeTruthy();
    }
  });

  it("compiles with optimization level 0", async () => {
    const result = await runTolkCompiler({
      entrypointFileName: "main.tolk",
      fsReadCallback: () => MINIMAL_CONTRACT,
      optimizationLevel: 0,
      withStackComments: false,
    });
    expect(result.status).toBe("ok");
  });

  it("compiles with stack comments enabled", async () => {
    const result = await runTolkCompiler({
      entrypointFileName: "main.tolk",
      fsReadCallback: () => MINIMAL_CONTRACT,
      optimizationLevel: 2,
      withStackComments: true,
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.fiftCode).toContain("DECLMETHOD");
    }
  });

  it("compiles multi-file contracts", async () => {
    const files: Record<string, string> = {
      "main.tolk": `import "helper.tolk"\nfun main(): int { return helperFn(); }`,
      "helper.tolk": `fun helperFn(): int { return 42; }`,
    };
    const result = await runTolkCompiler({
      entrypointFileName: "main.tolk",
      fsReadCallback: (path: string) => {
        const normalized = path.startsWith("./") ? path.slice(2) : path;
        if (files[normalized]) return files[normalized];
        if (files[path]) return files[path];
        throw new Error(`File not found: ${path}`);
      },
      optimizationLevel: 2,
      withStackComments: false,
    });
    expect(result.status).toBe("ok");
  });

  it("resolves stdlib imports", async () => {
    const code = `import "@stdlib/tvm-dicts"\nfun main(): int { return 0; }`;
    const result = await runTolkCompiler({
      entrypointFileName: "main.tolk",
      fsReadCallback: () => code,
      optimizationLevel: 2,
      withStackComments: false,
    });
    expect(result.status).toBe("ok");
  });

  it("returns tolkVersion in successful result", async () => {
    const result = await runTolkCompiler({
      entrypointFileName: "main.tolk",
      fsReadCallback: () => MINIMAL_CONTRACT,
      optimizationLevel: 2,
      withStackComments: false,
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.tolkVersion).toMatch(/^\d+\.\d+/);
    }
  });

  it("resolves @stdlib/strings import", async () => {
    const code = `import "@stdlib/strings"\nfun main(): int { return 0; }`;
    const result = await runTolkCompiler({
      entrypointFileName: "main.tolk",
      fsReadCallback: () => code,
      optimizationLevel: 2,
      withStackComments: false,
    });
    expect(result.status).toBe("ok");
  });

  it("resolves @stdlib/reflection import", async () => {
    const code = `import "@stdlib/reflection"\nfun main(): int { return 0; }`;
    const result = await runTolkCompiler({
      entrypointFileName: "main.tolk",
      fsReadCallback: () => code,
      optimizationLevel: 2,
      withStackComments: false,
    });
    expect(result.status).toBe("ok");
  });
});

// ─────────────────────────────────────────────────────────────────
// Group 2: MCP server integration tests
// ─────────────────────────────────────────────────────────────────

describe("MCP server integration", () => {
  let client: Client;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(clientTransport);

    cleanup = async () => {
      await client.close();
      await server.close();
    };
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  // ─── Tools ────────────────────────────────────────────────────

  it("lists all 4 tools", async () => {
    const result = await client.listTools();
    const toolNames = result.tools.map((t: any) => t.name).sort();
    expect(toolNames).toEqual(["check_tolk_syntax", "compile_tolk", "generate_deploy_link", "get_compiler_version"]);
  });

  it("get_compiler_version returns version", async () => {
    const result = await client.callTool({ name: "get_compiler_version", arguments: {} });
    const text = (result.content as any[])[0].text;
    expect(text).toContain("Tolk compiler version");
  });

  it("compile_tolk compiles a simple contract", async () => {
    const result = await client.callTool({
      name: "compile_tolk",
      arguments: {
        entrypointFileName: "main.tolk",
        sources: { "main.tolk": MINIMAL_CONTRACT },
      },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content as any[])[0].text;
    expect(text).toContain("Compilation Successful");
    expect(text).toContain("Code hash");
  });

  it("compile_tolk returns error for invalid code", async () => {
    const result = await client.callTool({
      name: "compile_tolk",
      arguments: {
        entrypointFileName: "main.tolk",
        sources: { "main.tolk": INVALID_CODE },
      },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as any[])[0].text;
    expect(text).toContain("error");
  });

  it("compile_tolk validates entrypoint exists", async () => {
    const result = await client.callTool({
      name: "compile_tolk",
      arguments: {
        entrypointFileName: "missing.tolk",
        sources: { "main.tolk": MINIMAL_CONTRACT },
      },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as any[])[0].text;
    expect(text).toContain("missing.tolk");
    expect(text).toContain("main.tolk");
  });

  it("compile_tolk handles multi-file sources", async () => {
    const result = await client.callTool({
      name: "compile_tolk",
      arguments: {
        entrypointFileName: "main.tolk",
        sources: {
          "main.tolk": `import "helper.tolk"\nfun main(): int { return helperFn(); }`,
          "helper.tolk": `fun helperFn(): int { return 42; }`,
        },
      },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content as any[])[0].text;
    expect(text).toContain("Compilation Successful");
  });

  it("check_tolk_syntax returns OK for valid code", async () => {
    const result = await client.callTool({
      name: "check_tolk_syntax",
      arguments: {
        entrypointFileName: "main.tolk",
        sources: { "main.tolk": MINIMAL_CONTRACT },
      },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content as any[])[0].text;
    expect(text).toContain("OK");
  });

  it("check_tolk_syntax returns error for invalid code", async () => {
    const result = await client.callTool({
      name: "check_tolk_syntax",
      arguments: {
        entrypointFileName: "main.tolk",
        sources: { "main.tolk": INVALID_CODE },
      },
    });
    expect(result.isError).toBe(true);
  });

  it("generate_deploy_link returns deployment info", async () => {
    // First compile to get a valid BoC
    const compileResult = await client.callTool({
      name: "compile_tolk",
      arguments: {
        entrypointFileName: "main.tolk",
        sources: { "main.tolk": MINIMAL_CONTRACT },
      },
    });
    const compileText = (compileResult.content as any[])[0].text;
    const bocMatch = compileText.match(/### BoC \(base64\)\n```\n(.+)\n```/);
    expect(bocMatch).toBeTruthy();

    const result = await client.callTool({
      name: "generate_deploy_link",
      arguments: { codeBoc64: bocMatch![1] },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content as any[])[0].text;
    expect(text).toContain("Deployment Information");
    expect(text).toContain("Contract address");
    expect(text).toContain("ton://transfer/");
  });

  // ─── Resources ────────────────────────────────────────────────

  it("lists all 6 resources", async () => {
    const result = await client.listResources();
    expect(result.resources).toHaveLength(6);
    const uris = result.resources.map((r: any) => r.uri).sort();
    expect(uris).toEqual([
      "tolk://docs/changelog",
      "tolk://docs/language-guide",
      "tolk://docs/stdlib-reference",
      "tolk://docs/tolk-vs-func",
      "tolk://examples/counter",
      "tolk://examples/jetton",
    ]);
  });

  it("reads language-guide resource", async () => {
    const result = await client.readResource({ uri: "tolk://docs/language-guide" });
    const text = (result.contents[0] as any).text;
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(1000);
    expect(text).toContain("Tolk");
  });

  it("reads changelog resource", async () => {
    const result = await client.readResource({ uri: "tolk://docs/changelog" });
    const text = (result.contents[0] as any).text;
    expect(text).toContain("v0.6");
    expect(text).toContain("v1.0");
    expect(text).toContain("v1.3");
  });

  it("reads stdlib-reference resource", async () => {
    const result = await client.readResource({ uri: "tolk://docs/stdlib-reference" });
    const text = (result.contents[0] as any).text;
    expect(text).toContain("beginCell");
    expect(text).toContain("@stdlib");
  });

  it("reads tolk-vs-func resource", async () => {
    const result = await client.readResource({ uri: "tolk://docs/tolk-vs-func" });
    const text = (result.contents[0] as any).text;
    expect(text).toContain("FunC");
    expect(text).toContain("Tolk");
  });

  it("reads example-counter resource", async () => {
    const result = await client.readResource({ uri: "tolk://examples/counter" });
    const text = (result.contents[0] as any).text;
    expect(text).toContain("fun");
    expect(text).toContain("counter");
  });

  it("reads example-jetton resource", async () => {
    const result = await client.readResource({ uri: "tolk://examples/jetton" });
    const text = (result.contents[0] as any).text;
    expect(text).toContain("fun");
    expect(text).toContain("jetton");
  });

  // ─── Prompts ──────────────────────────────────────────────────

  it("lists all 3 prompts", async () => {
    const result = await client.listPrompts();
    expect(result.prompts).toHaveLength(3);
    const names = result.prompts.map((p: any) => p.name).sort();
    expect(names).toEqual(["debug_compilation_error", "review_smart_contract", "write_smart_contract"]);
  });

  it("gets write_smart_contract prompt", async () => {
    const result = await client.getPrompt({
      name: "write_smart_contract",
      arguments: { description: "A simple voting contract" },
    });
    expect(result.messages).toHaveLength(1);
    const text = (result.messages[0].content as any).text;
    expect(text).toContain("voting");
    expect(text).toContain("Tolk Language Reference");
  });

  it("gets write_smart_contract prompt with contractType", async () => {
    const result = await client.getPrompt({
      name: "write_smart_contract",
      arguments: { description: "A token contract", contractType: "jetton" },
    });
    const text = (result.messages[0].content as any).text;
    expect(text).toContain("jetton");
  });

  it("gets review_smart_contract prompt", async () => {
    const result = await client.getPrompt({
      name: "review_smart_contract",
      arguments: { code: COUNTER_CONTRACT },
    });
    expect(result.messages).toHaveLength(1);
    const text = (result.messages[0].content as any).text;
    expect(text).toContain("security review");
    expect(text).toContain("Access Control");
    expect(text).toContain("Integer Overflow");
  });

  it("gets debug_compilation_error prompt", async () => {
    const result = await client.getPrompt({
      name: "debug_compilation_error",
      arguments: {
        errorMessage: "Unexpected token at line 1",
        code: INVALID_CODE,
      },
    });
    expect(result.messages).toHaveLength(1);
    const text = (result.messages[0].content as any).text;
    expect(text).toContain("Unexpected token");
    expect(text).toContain("Tolk Language Reference");
  });

  // ─── Edge Cases ───────────────────────────────────────────────

  it("compile_tolk with empty sources", async () => {
    const result = await client.callTool({
      name: "compile_tolk",
      arguments: {
        entrypointFileName: "main.tolk",
        sources: {},
      },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as any[])[0].text;
    expect(text).toContain("empty");
  });

  it("generate_deploy_link with invalid BoC", async () => {
    const result = await client.callTool({
      name: "generate_deploy_link",
      arguments: { codeBoc64: "not-a-valid-boc" },
    });
    expect(result.isError).toBe(true);
  });

  it("generate_deploy_link with custom workchain", async () => {
    const compileResult = await client.callTool({
      name: "compile_tolk",
      arguments: {
        entrypointFileName: "main.tolk",
        sources: { "main.tolk": MINIMAL_CONTRACT },
      },
    });
    const compileText = (compileResult.content as any[])[0].text;
    const bocMatch = compileText.match(/### BoC \(base64\)\n```\n(.+)\n```/);
    expect(bocMatch).toBeTruthy();

    const result = await client.callTool({
      name: "generate_deploy_link",
      arguments: { codeBoc64: bocMatch![1], workchain: -1 },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content as any[])[0].text;
    expect(text).toContain("Target workchain:** -1");
  });

  it("compile_tolk with optimizationLevel 0 via MCP tool", async () => {
    const result = await client.callTool({
      name: "compile_tolk",
      arguments: {
        entrypointFileName: "main.tolk",
        sources: { "main.tolk": MINIMAL_CONTRACT },
        optimizationLevel: 0,
      },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content as any[])[0].text;
    expect(text).toContain("Compilation Successful");
  });

  it("compile_tolk includes compiler version in output", async () => {
    const result = await client.callTool({
      name: "compile_tolk",
      arguments: {
        entrypointFileName: "main.tolk",
        sources: { "main.tolk": MINIMAL_CONTRACT },
      },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content as any[])[0].text;
    expect(text).toContain("Compiler version");
  });

  it("compile_tolk with withStackComments true via MCP tool", async () => {
    const result = await client.callTool({
      name: "compile_tolk",
      arguments: {
        entrypointFileName: "main.tolk",
        sources: { "main.tolk": MINIMAL_CONTRACT },
        withStackComments: true,
      },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content as any[])[0].text;
    expect(text).toContain("Compilation Successful");
  });

  it("compile_tolk with null sources returns validation error", async () => {
    const result = await client.callTool({
      name: "compile_tolk",
      arguments: { entrypointFileName: "main.tolk", sources: null },
    });
    expect(result.isError).toBe(true);
  });

  it("compile_tolk with empty-string entrypoint content does not report entrypoint not found", async () => {
    const result = await client.callTool({
      name: "compile_tolk",
      arguments: {
        entrypointFileName: "main.tolk",
        sources: { "main.tolk": "" },
      },
    });
    const text = (result.content as any[])[0].text;
    expect(text).not.toContain("not found");
  });

  it("compile_tolk with out-of-range optimizationLevel returns validation error", async () => {
    const result = await client.callTool({
      name: "compile_tolk",
      arguments: {
        entrypointFileName: "main.tolk",
        sources: { "main.tolk": MINIMAL_CONTRACT },
        optimizationLevel: 999,
      },
    });
    expect(result.isError).toBe(true);
  });

  it("generate_deploy_link with non-numeric amount returns validation error", async () => {
    const compileResult = await client.callTool({
      name: "compile_tolk",
      arguments: {
        entrypointFileName: "main.tolk",
        sources: { "main.tolk": MINIMAL_CONTRACT },
      },
    });
    const compileText = (compileResult.content as any[])[0].text;
    const bocMatch = compileText.match(/### BoC \(base64\)\n```\n(.+)\n```/);
    expect(bocMatch).toBeTruthy();

    const result = await client.callTool({
      name: "generate_deploy_link",
      arguments: { codeBoc64: bocMatch![1], amount: "abc" },
    });
    expect(result.isError).toBe(true);
  });
});
