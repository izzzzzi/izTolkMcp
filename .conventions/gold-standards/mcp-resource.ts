// Gold standard: MCP resource registration pattern
// - Use server.resource() API
// - @ts-ignore for Zod type depth issue
// - tolk:// URI scheme for this project
// - Lazy content loading with caching

// @ts-ignore: MCP SDK type instantiation depth issue
server.resource(
  'resource-name',
  'tolk://docs/resource-name',
  { description: 'Clear description', mimeType: 'text/markdown' },
  async () => ({
    contents: [{
      uri: 'tolk://docs/resource-name',
      mimeType: 'text/markdown',
      text: getContent()['resource-name'],
    }],
  })
);
