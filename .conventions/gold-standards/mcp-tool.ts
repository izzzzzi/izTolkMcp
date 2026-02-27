// Gold standard: MCP tool registration pattern
// - Use server.tool() API (v1 style)
// - @ts-ignore for Zod type depth issue
// - z.any() with .describe() for complex object params
// - isError: true for domain errors (not protocol exceptions)
// - Markdown-formatted output

// @ts-ignore: MCP SDK type instantiation depth issue with Zod schemas
server.tool(
  'tool_name',
  'Clear description of what the tool does and what it returns.',
  {
    requiredParam: z.string().describe('Description of parameter'),
    optionalParam: z.number().optional().describe('Description with default'),
    complexParam: z.any().describe(
      'Object mapping key -> value. Example: {"key": "value"}'
    ),
  },
  async (args) => {
    const typed = args.complexParam as Record<string, string>;

    try {
      // ... implementation
      return {
        content: [{ type: 'text', text: `## Result\n\nFormatted output` }],
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);
