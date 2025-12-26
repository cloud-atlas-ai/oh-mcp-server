# Setup Open Horizons MCP

Configure Claude Code to use the Open Horizons MCP server for strategic alignment integration.

## Prerequisites

You'll need:
- An Open Horizons account at https://app.openhorizons.me
- An API key (from Settings > API Keys)
- The `@cloud-atlas-ai/oh-mcp-server` package installed (or available globally)

## Step 1: Verify MCP Server is Available

Check if `oh-mcp` binary is available:

```bash
which oh-mcp
```

If not found:
- **Local install:** `npm install @cloud-atlas-ai/oh-mcp-server` (adds to `node_modules/.bin/`)
- **Global install:** `npm install -g @cloud-atlas-ai/oh-mcp-server`
- **From project root:** `pnpm install @cloud-atlas-ai/oh-mcp-server`

Note the full path to the binary (you'll need it in Step 3).

## Step 2: Get Your API Key

1. Go to https://app.openhorizons.me
2. Sign in to your account
3. Navigate to **Settings > API Keys**
4. Create a new API key or copy an existing one
5. Copy the key to clipboard

You'll paste this in the next step.

## Step 3: Create `.env.local` with API Key

Create or update `.env.local` in your project root:

```bash
OH_API_KEY=<paste-your-api-key-here>
OH_API_URL=https://app.openhorizons.me
```

**⚠️ Important:** Add `.env.local` to `.gitignore` if not already there:
```bash
echo ".env.local" >> .gitignore
```

## Step 4: Configure Claude Code's MCP Settings

Claude Code needs to know how to launch the OH MCP server. Edit or create `.claude/settings.json`:

**Current structure:** Check if you already have `mcpServers`:
```bash
cat .claude/settings.json | grep -A 10 mcpServers
```

**If `mcpServers` doesn't exist yet:**

Add this to `.claude/settings.json` (or create it if missing):

```json
{
  "mcpServers": {
    "oh-mcp": {
      "command": "node",
      "args": ["<PATH-TO-OH-MCP>/dist/index.js"],
      "env": {
        "OH_API_KEY": "${env:OH_API_KEY}",
        "OH_API_URL": "https://app.openhorizons.me"
      }
    }
  }
}
```

**Replace `<PATH-TO-OH-MCP>` with:**
- If installed locally: `./node_modules/@cloud-atlas-ai/oh-mcp-server`
- If installed globally: `/usr/local/lib/node_modules/@cloud-atlas-ai/oh-mcp-server`
- Or use the full path from Step 1

**If `mcpServers` already exists:**

Add the `oh-mcp` entry to the existing `mcpServers` object:

```json
{
  "mcpServers": {
    "existing-server": { ... },
    "oh-mcp": {
      "command": "node",
      "args": ["<PATH-TO-OH-MCP>/dist/index.js"],
      "env": {
        "OH_API_KEY": "${env:OH_API_KEY}",
        "OH_API_URL": "https://app.openhorizons.me"
      }
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
- Make sure you installed the package in Step 1
- Verify the path in `.claude/settings.json` is correct
- Try using absolute path: `/Users/username/.nvm/versions/node/v18.0.0/lib/node_modules/@open-horizons/mcp-server`

**"API key invalid" or "Connection failed"**
- Verify the API key in `.env.local` is correct
- Make sure `.env.local` exists and is readable by Claude Code
- Check that https://app.openhorizons.me is accessible

**"MCP server crashed" or "No tools available"**
- Check that `node_modules/@cloud-atlas-ai/oh-mcp-server/dist/index.js` exists
- Verify the `args` path in `.claude/settings.json` is correct (relative paths resolve from project root)
- Try running the MCP manually: `OH_API_KEY=<key> node ./node_modules/@cloud-atlas-ai/oh-mcp-server/dist/index.js`

**"Settings.json syntax error"**
- Use a JSON validator: `jq . .claude/settings.json`
- Make sure all quotes are straight (not curly)
- Check for trailing commas in objects/arrays

**Want to disable OH MCP temporarily?**
- Comment out the `oh-mcp` entry in `.claude/settings.json`
- Or set `OH_API_KEY=""` in `.env.local`

---

**Done!** Claude Code now has full access to your Open Horizons alignment context. Every decision Claude makes can be logged back to OH, keeping your strategic alignment and execution in sync.
