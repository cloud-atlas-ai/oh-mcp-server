# Setup Open Horizons MCP

Configure Claude Code to use the Open Horizons MCP server for strategic alignment integration.

## Prerequisites

You'll need:
- An Open Horizons account at https://app.openhorizons.me
- An API key (from Settings > API Keys)

## Step 1: Install MCP Server Globally

```bash
npm install -g @cloud-atlas-ai/oh-mcp-server
```

Verify it's installed:
```bash
which oh-mcp
```

## Step 2: Get Your API Key

1. Go to https://app.openhorizons.me
2. Sign in to your account
3. Navigate to **Settings > API Keys**
4. Create a new API key or copy an existing one
5. Copy the key to clipboard

## Step 3: Create Global Config (One-Time Setup)

Create the config directory and file:

```bash
mkdir -p ~/.config/openhorizons
```

Create `~/.config/openhorizons/config.json` with your API key:

```json
{
  "api_key": "<paste-your-api-key-here>",
  "api_url": "https://app.openhorizons.me"
}
```

**This config is shared across all your projects - you only set it up once.**

## Step 4: Configure Claude Code's MCP Settings

Add OH MCP to your **global** Claude Code settings at `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "oh-mcp": {
      "command": "oh-mcp"
    }
  }
}
```

That's it! The MCP server reads config from `~/.config/openhorizons/config.json` automatically.

**If you already have `mcpServers`**, just add the `oh-mcp` entry:

```json
{
  "mcpServers": {
    "existing-server": { ... },
    "oh-mcp": {
      "command": "oh-mcp"
    }
  }
}
```

## Step 5: Restart Claude Code

Close and reopen Claude Code (or restart the current session) for the MCP configuration to take effect.

## Step 6: Verify It Works

Ask Claude to test the connection:

```
Try calling: oh_about
```

If OH MCP tools appear and work, you're done! You now have access to:

- **Read alignment context:**
  - `oh_get_contexts` - List workspaces
  - `oh_get_endeavors` - Browse missions, aims, initiatives, tasks
  - `oh_get_logs` - Review decisions and progress

- **Write alignment context:**
  - `oh_log_decision` - Document decisions tied to endeavors
  - `oh_create_endeavor` - Add new missions, aims, initiatives, tasks
  - `oh_update_endeavor` - Update existing endeavors

- **Manage contexts:**
  - `oh_create_context` - Create shared workspaces
  - `oh_invite_to_context` - Invite team members
  - `oh_move_endeavor` - Move endeavors between contexts

## Troubleshooting

**"Cannot find oh-mcp command"**
- Run `npm install -g @cloud-atlas-ai/oh-mcp-server`
- Make sure npm global bin is in your PATH

**"API key invalid" or "Connection failed"**
- Verify your API key in `~/.config/openhorizons/config.json`
- Check that https://app.openhorizons.me is accessible

**"Config not found"**
- Create `~/.config/openhorizons/config.json` with your API key
- Make sure the JSON is valid (no trailing commas)

**"MCP server crashed" or "No tools available"**
- Check Claude Code's MCP logs for error details
- Try running manually: `oh-mcp`

**Want to disable OH MCP temporarily?**
- Remove or comment out the `oh-mcp` entry in `~/.claude/settings.json`

---

**Done!** Claude Code now has full access to your Open Horizons alignment context. Every decision Claude makes can be logged back to OH, keeping your strategic alignment and execution in sync.
