# Docket

Agent-native task and project management. No dashboard. Agents read/write via MCP, humans interact through Claude.

> "What's on the docket?"

## Quick Start

```bash
# Install dependencies
npm install

# Run the worker locally
cd worker && npm run dev

# Set environment variables for MCP server
export DOCKET_WORKER_URL=http://localhost:8787
export DOCKET_API_TOKEN=your-token

# Build the MCP server
cd mcp-server && npm run build
```

## Architecture

See [docs/architecture.md](docs/architecture.md) for the full picture.

```
Claude Code agents ──┐
                     ├──> MCP Server (stdio) ──> CF Worker ──> Durable Object (SQLite)
Humans via Claude ───┘
```

## MCP Config for Claude Code

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "docket": {
      "command": "node",
      "args": ["path/to/docket/mcp-server/dist/index.js"],
      "env": {
        "DOCKET_WORKER_URL": "https://docket.your-subdomain.workers.dev",
        "DOCKET_API_TOKEN": "your-token"
      }
    }
  }
}
```

## Development

```bash
npm run check    # lint + typecheck + test
npm run lint:fix # auto-fix lint issues
npm run test     # run tests
```

## License

MIT
