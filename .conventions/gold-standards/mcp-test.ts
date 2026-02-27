// Gold standard: MCP integration test pattern
// - vitest + InMemoryTransport
// - createServer() factory for test isolation
// - Client/Server linked pair

import { describe, it, expect, beforeAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/index.js';

describe('mcp-server', () => {
  let client: Client;

  beforeAll(async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
  });

  it('lists tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it('calls a tool', async () => {
    const result = await client.callTool({
      name: 'tool_name',
      arguments: { /* params */ },
    });
    expect(result.content).toBeDefined();
  });

  it('reads a resource', async () => {
    const result = await client.readResource({
      uri: 'tolk://docs/resource-name',
    });
    expect(result.contents[0].text).toBeDefined();
  });
});
