# Open Horizons MCP Server

[![npm version](https://badge.fury.io/js/@cloud-atlas-ai%2Foh-mcp-server.svg)](https://www.npmjs.com/package/@cloud-atlas-ai/oh-mcp-server)

Model Context Protocol (MCP) server for [Open Horizons](https://app.openhorizons.me) - enables AI agents to read and write strategic alignment context.

## What is This?

Open Horizons MCP Server connects AI coding assistants (like Claude Code) to your strategic alignment framework. Instead of making isolated technical decisions, AI agents can:

- **Read your strategic context**: Query missions, aims, initiatives, and tasks
- **Log decisions back**: Document why choices were made, tied to strategic goals
- **Stay aligned**: Every code change traces back to a mission

**The result:** AI that doesn't just code fast—it codes in alignment with your strategy.

## Quick Start

### 1. Install

```bash
npm install -g @cloud-atlas-ai/oh-mcp-server
```

Or locally in your project:

```bash
npm install @cloud-atlas-ai/oh-mcp-server
```

### 2. Get Your API Key

1. Sign up at [app.openhorizons.me](https://app.openhorizons.me)
2. Go to **Settings > API Keys**
3. Create a new API key

### 3. Configure Environment

Add to your `.env` or `.env.local`:

```bash
OH_API_KEY=your_api_key_here
OH_API_URL=https://app.openhorizons.me
```

### 4. Configure Claude Code

For Claude Code users, run:

```bash
/oh-mcp:setup
```

This will guide you through configuring the MCP server in Claude Code's settings.

Or manually add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "oh-mcp": {
      "command": "node",
      "args": ["./node_modules/@cloud-atlas-ai/oh-mcp-server/dist/index.js"],
      "env": {
        "OH_API_KEY": "${env:OH_API_KEY}",
        "OH_API_URL": "https://app.openhorizons.me"
      }
    }
  }
}
```

### 5. Verify

Ask Claude to test the connection:

```
Try calling: oh_about
```

If it works, you'll see OH MCP tools available!

## Available Tools

### Read Operations

- **`oh_get_contexts`** - List all contexts (personal and shared workspaces)
- **`oh_get_endeavors`** - Get endeavors (missions, aims, initiatives, tasks) in a context
- **`oh_get_endeavor`** - Get details of a specific endeavor with hierarchy
- **`oh_get_logs`** - Get recent logs/decisions for an endeavor
- **`oh_about`** - Get information about Open Horizons and this MCP server

### Write Operations (Endeavors)

- **`oh_create_endeavor`** - Create new mission, aim, initiative, or task
- **`oh_update_endeavor`** - Update endeavor title and/or description
- **`oh_archive_endeavor`** - Archive endeavor (soft delete)
- **`oh_unarchive_endeavor`** - Restore an archived endeavor
- **`oh_set_parent`** - Change parent of an endeavor (move in hierarchy)
- **`oh_delete_endeavor`** - Permanently delete an endeavor

### Write Operations (Logging)

- **`oh_log_decision`** - Log decision, note, or progress to an endeavor
- **`oh_update_log`** - Update a log entry's content
- **`oh_delete_log`** - Delete a log entry

### Write Operations (Contexts)

- **`oh_create_context`** - Create new shared context (workspace)
- **`oh_update_context`** - Update context title and/or description
- **`oh_move_endeavor`** - Move endeavor to different context
- **`oh_delete_context`** - Permanently delete a context
- **`oh_invite_to_context`** - Invite user by email with role (editor or viewer)

## Core Concepts

Open Horizons uses a four-level alignment hierarchy:

```
Mission (why you exist)
  └── Aim (outcome you want)
       └── Initiative (how you'll achieve it)
            └── Task (what you do today)
```

**Key Ideas:**
- **Contexts**: Personal or shared spaces where endeavors live
- **Endeavors**: Any node in the hierarchy (mission, aim, initiative, task)
- **Decision logs**: Captured reasoning and progress tied to endeavors
- **Alignment**: Every task traces back to a mission, so you always know *why*

## Use Cases

### 1. Strategic Coding with Claude Code

Install [superego](https://github.com/cloud-atlas-ai/superego) + OH MCP:

```bash
# Install superego (metacognitive advisor)
/plugin marketplace add cloud-atlas-ai/superego
/plugin install superego@superego
/superego:init

# Install OH MCP (strategic alignment)
/plugin marketplace add cloud-atlas-ai/oh-mcp-server
/plugin install oh-mcp@oh-mcp-server
/oh-mcp:setup
```

Now Claude Code has metacognitive feedback (superego) tied to strategic context (OH MCP). Every decision gets logged back to your alignment framework.

### 2. AI Swarm Coordination

Use OH MCP in multi-agent systems to:
- Fetch alignment packages before execution
- Log decisions from each agent run
- Maintain governance constraints across swarms
- Create an audit trail of all AI decisions

See the [Swarm Alignment architecture](https://github.com/cloud-atlas-ai/open-horizons/blob/main/docs/ideas/swarm-alignment-mcp.md) for details.

### 3. Custom AI Tools

Integrate OH MCP into your own AI tools:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Your MCP server can call OH API via the oh-mcp tools
// to read context and log decisions
```

## Environment Variables

- `OH_API_KEY` - Your Open Horizons API key (required)
- `OH_API_URL` - OH API base URL (default: `https://app.openhorizons.me`)

## Development

```bash
# Clone the repo
git clone https://github.com/cloud-atlas-ai/oh-mcp-server.git
cd oh-mcp-server

# Install dependencies
npm install

# Build
npm run build

# Run in dev mode
npm run dev

# Test manually
OH_API_KEY=your_key npm start
```

## Troubleshooting

**"API key invalid"**
- Verify your API key is correct in `.env.local`
- Make sure you're using a key from https://app.openhorizons.me/settings/api-keys

**"Connection failed"**
- Check that https://app.openhorizons.me is accessible
- Verify your firewall/proxy isn't blocking the connection

**"MCP server crashed"**
- Check that the `dist/index.js` file exists (run `npm run build` if missing)
- Look at Claude Code's MCP logs for error details
- Try running manually: `OH_API_KEY=<key> node dist/index.js`

## Related Projects

- **[Superego](https://github.com/cloud-atlas-ai/superego)** - Metacognitive advisor for Claude Code (pairs perfectly with OH MCP)
- **[Open Horizons](https://app.openhorizons.me)** - The strategic alignment platform (proprietary)

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- **Documentation**: [Open Horizons Docs](https://docs.openhorizons.me)
- **Issues**: [GitHub Issues](https://github.com/cloud-atlas-ai/oh-mcp-server/issues)
- **Email**: hello@cloudatlas.ai
