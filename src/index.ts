#!/usr/bin/env node
/**
 * Open Horizons MCP Server
 *
 * Enables AI agents to read/write alignment context from OH.
 * Uses stdio transport for Claude Code integration.
 *
 * Configuration (in order of precedence):
 * 1. Environment variables: OH_API_URL, OH_API_KEY
 * 2. Config file: ~/.config/openhorizons/config.json
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  CallToolResult
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Load config from ~/.config/openhorizons/config.json
function loadConfig(): { api_key?: string; api_url?: string } {
  const configPath = join(homedir(), '.config', 'openhorizons', 'config.json');
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.error(`Warning: Failed to parse config at ${configPath}:`, e);
    }
  }
  return {};
}

const fileConfig = loadConfig();

// Configuration: env vars take precedence over config file
const OH_API_URL = process.env.OH_API_URL || fileConfig.api_url || 'https://app.openhorizons.me';
const OH_API_KEY = process.env.OH_API_KEY || fileConfig.api_key;

if (!OH_API_KEY) {
  console.error('ERROR: OH API key not found.');
  console.error('Please either:');
  console.error('  1. Create ~/.config/openhorizons/config.json with {"api_key": "your-key", "api_url": "https://app.openhorizons.me"}');
  console.error('  2. Set OH_API_KEY environment variable');
  process.exit(1);
}

// Helper to make authenticated API calls
async function ohFetch(path: string, options: RequestInit = {}): Promise<any> {
  const url = `${OH_API_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${OH_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OH API error (${response.status}): ${error}`);
  }

  return response.json();
}

// Create the MCP server
const server = new Server(
  { name: 'open-horizons', version: '0.3.0' },
  { capabilities: { tools: {} } }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'oh_get_contexts',
        description: 'List all contexts (personal and shared spaces) the user has access to',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'oh_get_endeavors',
        description: 'Get all endeavors (missions, aims, initiatives, tasks) in a context',
        inputSchema: {
          type: 'object',
          properties: {
            context_id: {
              type: 'string',
              description: 'Context ID to fetch endeavors from'
            }
          },
          required: ['context_id']
        }
      },
      {
        name: 'oh_get_endeavor',
        description: 'Get details of a specific endeavor including its hierarchy and recent logs',
        inputSchema: {
          type: 'object',
          properties: {
            endeavor_id: {
              type: 'string',
              description: 'Endeavor ID to fetch'
            }
          },
          required: ['endeavor_id']
        }
      },
      {
        name: 'oh_log_decision',
        description: 'Log a decision or note to an endeavor. Use for strategic decisions, learnings, or progress updates.',
        inputSchema: {
          type: 'object',
          properties: {
            endeavor_id: {
              type: 'string',
              description: 'Endeavor ID to log against'
            },
            content: {
              type: 'string',
              description: 'Markdown content of the log entry'
            },
            log_date: {
              type: 'string',
              description: 'Date in YYYY-MM-DD format (defaults to today)'
            }
          },
          required: ['endeavor_id', 'content']
        }
      },
      {
        name: 'oh_get_logs',
        description: 'Get recent logs/decisions for an endeavor',
        inputSchema: {
          type: 'object',
          properties: {
            endeavor_id: {
              type: 'string',
              description: 'Endeavor ID to get logs for'
            },
            days: {
              type: 'number',
              description: 'Number of days of logs to fetch (default: 7)'
            }
          },
          required: ['endeavor_id']
        }
      },
      {
        name: 'oh_about',
        description: 'Get information about Open Horizons and how to use this MCP server effectively',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'oh_create_endeavor',
        description: 'Create a new endeavor (mission, aim, initiative, or task)',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Title of the endeavor'
            },
            type: {
              type: 'string',
              enum: ['mission', 'aim', 'initiative', 'task'],
              description: 'Type of endeavor in the hierarchy'
            },
            context_id: {
              type: 'string',
              description: 'Context ID (defaults to personal context if not specified)'
            },
            parent_id: {
              type: 'string',
              description: 'Parent endeavor ID to nest under (for aims, initiatives, tasks)'
            }
          },
          required: ['title', 'type']
        }
      },
      {
        name: 'oh_update_endeavor',
        description: 'Update an endeavor title and/or description',
        inputSchema: {
          type: 'object',
          properties: {
            endeavor_id: {
              type: 'string',
              description: 'ID of the endeavor to update'
            },
            title: {
              type: 'string',
              description: 'New title (optional)'
            },
            description: {
              type: 'string',
              description: 'New description (optional)'
            }
          },
          required: ['endeavor_id']
        }
      },
      {
        name: 'oh_archive_endeavor',
        description: 'Archive an endeavor (soft delete, can be restored)',
        inputSchema: {
          type: 'object',
          properties: {
            endeavor_id: {
              type: 'string',
              description: 'ID of the endeavor to archive'
            },
            reason: {
              type: 'string',
              description: 'Optional reason for archiving'
            }
          },
          required: ['endeavor_id']
        }
      },
      {
        name: 'oh_unarchive_endeavor',
        description: 'Restore an archived endeavor',
        inputSchema: {
          type: 'object',
          properties: {
            endeavor_id: {
              type: 'string',
              description: 'ID of the endeavor to restore'
            }
          },
          required: ['endeavor_id']
        }
      },
      {
        name: 'oh_set_parent',
        description: 'Change the parent of an endeavor (move in hierarchy)',
        inputSchema: {
          type: 'object',
          properties: {
            endeavor_id: {
              type: 'string',
              description: 'ID of the endeavor to move'
            },
            parent_id: {
              type: 'string',
              description: 'ID of the new parent endeavor (null to make root)'
            }
          },
          required: ['endeavor_id']
        }
      },
      // Write operations - Contexts
      {
        name: 'oh_create_context',
        description: 'Create a new shared context (workspace)',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Title of the context'
            },
            description: {
              type: 'string',
              description: 'Optional description'
            }
          },
          required: ['title']
        }
      },
      {
        name: 'oh_update_context',
        description: 'Update a context title and/or description',
        inputSchema: {
          type: 'object',
          properties: {
            context_id: {
              type: 'string',
              description: 'ID of the context to update'
            },
            title: {
              type: 'string',
              description: 'New title'
            },
            description: {
              type: 'string',
              description: 'New description'
            }
          },
          required: ['context_id']
        }
      },
      {
        name: 'oh_delete_endeavor',
        description: 'Permanently delete an endeavor (cannot be undone)',
        inputSchema: {
          type: 'object',
          properties: {
            endeavor_id: { type: 'string', description: 'ID of the endeavor to delete' }
          },
          required: ['endeavor_id']
        }
      },
      {
        name: 'oh_move_endeavor',
        description: 'Move an endeavor to a different context',
        inputSchema: {
          type: 'object',
          properties: {
            endeavor_id: { type: 'string', description: 'ID of the endeavor to move' },
            target_context_id: { type: 'string', description: 'ID of the target context' },
            move_subgraph: { type: 'boolean', description: 'Move children too (default: true)' }
          },
          required: ['endeavor_id', 'target_context_id']
        }
      },
      {
        name: 'oh_delete_context',
        description: 'Delete a context (cannot be undone)',
        inputSchema: {
          type: 'object',
          properties: {
            context_id: { type: 'string', description: 'ID of the context to delete' }
          },
          required: ['context_id']
        }
      },
      {
        name: 'oh_invite_to_context',
        description: 'Invite a user to a context by email',
        inputSchema: {
          type: 'object',
          properties: {
            context_id: { type: 'string', description: 'ID of the context' },
            email: { type: 'string', description: 'Email of the user to invite' },
            role: { type: 'string', enum: ['editor', 'viewer'], description: 'Role (default: editor)' }
          },
          required: ['context_id', 'email']
        }
      },
      {
        name: 'oh_update_log',
        description: 'Update a log entry content',
        inputSchema: {
          type: 'object',
          properties: {
            log_id: { type: 'string', description: 'ID of the log to update' },
            content: { type: 'string', description: 'New content (markdown)' }
          },
          required: ['log_id', 'content']
        }
      },
      {
        name: 'oh_delete_log',
        description: 'Delete a log entry',
        inputSchema: {
          type: 'object',
          properties: {
            log_id: { type: 'string', description: 'ID of the log to delete' }
          },
          required: ['log_id']
        }
      },
      {
        name: 'oh_create_metis_candidate',
        description: 'Create a metis candidate (pattern/learning observed during work). Use this when you discover a reusable insight. The candidate will be reviewed by a human in the OH app Reflect mode, where they can promote it to full metis with structured fields (violated_expectation, observed_reality, consequence).',
        inputSchema: {
          type: 'object',
          properties: {
            endeavor_id: {
              type: 'string',
              description: 'Endeavor ID this learning belongs to'
            },
            content: {
              type: 'string',
              description: 'The insight or pattern observed (markdown). Describe: what you expected, what actually happened, and why the difference mattered.'
            }
          },
          required: ['endeavor_id', 'content']
        }
      },
      {
        name: 'oh_create_guardrail_candidate',
        description: 'Create a guardrail candidate (constraint/rule that should be enforced). Use this when you discover something that should NEVER happen again. The candidate will be reviewed by a human in the OH app Reflect mode, where they can promote it to full guardrail with title and override protocol.',
        inputSchema: {
          type: 'object',
          properties: {
            endeavor_id: {
              type: 'string',
              description: 'Endeavor ID this constraint applies to'
            },
            content: {
              type: 'string',
              description: 'The constraint or rule (markdown). Should clearly state what must/must not happen and why.'
            }
          },
          required: ['endeavor_id', 'content']
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'oh_get_contexts': {
        const data = await ohFetch('/api/contexts');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(data, null, 2)
          }]
        };
      }

      case 'oh_get_endeavors': {
        const { context_id } = args as { context_id: string };
        const data = await ohFetch(`/api/dashboard?contextId=${encodeURIComponent(context_id)}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(data, null, 2)
          }]
        };
      }

      case 'oh_get_endeavor': {
        const { endeavor_id } = args as { endeavor_id: string };
        const data = await ohFetch(`/api/endeavors/${encodeURIComponent(endeavor_id)}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(data, null, 2)
          }]
        };
      }

      case 'oh_log_decision': {
        const { endeavor_id, content, log_date } = args as {
          endeavor_id: string;
          content: string;
          log_date?: string;
        };

        const today = new Date().toISOString().split('T')[0];
        const data = await ohFetch('/api/logs', {
          method: 'POST',
          body: JSON.stringify({
            entity_type: 'endeavor',
            entity_id: endeavor_id,
            content,
            content_type: 'markdown',
            log_date: log_date || today
          })
        });

        return {
          content: [{
            type: 'text',
            text: `Decision logged successfully. Log ID: ${data.log?.id}`
          }]
        };
      }

      case 'oh_get_logs': {
        const { endeavor_id, days = 7 } = args as { endeavor_id: string; days?: number };

        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const data = await ohFetch(
          `/api/logs?entity_type=endeavor&entity_id=${encodeURIComponent(endeavor_id)}&start_date=${startDate}&end_date=${endDate}`
        );

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(data, null, 2)
          }]
        };
      }

      case 'oh_about': {
        return {
          content: [{
            type: 'text',
            text: `# Open Horizons

Open Horizons is an AI-native strategic alignment system that connects high-level intent to daily execution.

## Core Model

\`\`\`
Mission (why you exist)
  └── Aim (outcome you want)
       └── Initiative (how you'll achieve it)
            └── Task (what you do today)
\`\`\`

## Key Concepts

- **Contexts**: Personal or shared spaces where endeavors live
- **Endeavors**: Any node in the hierarchy (mission, aim, initiative, task)
- **Decision logs**: Captured reasoning and progress tied to endeavors
- **Alignment**: Every task traces back to a mission, so you always know *why*

## How to Use This MCP Server

1. **Start with contexts**: Call \`oh_get_contexts\` to see available workspaces
2. **Explore endeavors**: Use \`oh_get_endeavors\` with a context_id to see the hierarchy
3. **Drill down**: Use \`oh_get_endeavor\` for details on a specific item
4. **Log progress**: Use \`oh_log_decision\` to capture decisions, learnings, or updates
5. **Review history**: Use \`oh_get_logs\` to see recent activity on an endeavor

## Best Practices

- Always trace tasks back to their parent mission to understand *why*
- Log decisions when making strategic choices, not just completions
- Use contexts to separate personal work from shared team endeavors
- When logging decisions, include reasoning and context for future reference
`
          }]
        };
      }

      case 'oh_create_endeavor': {
        const { title, type, context_id, parent_id } = args as {
          title: string;
          type: 'mission' | 'aim' | 'initiative' | 'task';
          context_id?: string;
          parent_id?: string;
        };

        const data = await ohFetch('/api/endeavors/create', {
          method: 'POST',
          body: JSON.stringify({
            title,
            type,
            contextId: context_id,
            parentId: parent_id
          })
        });

        return {
          content: [{
            type: 'text',
            text: `Endeavor created successfully. ID: ${data.endeavorId}`
          }]
        };
      }

      case 'oh_update_endeavor': {
        const { endeavor_id, title, description } = args as {
          endeavor_id: string;
          title?: string;
          description?: string;
        };

        const updates: string[] = [];

        if (title !== undefined) {
          await ohFetch(`/api/endeavors/${encodeURIComponent(endeavor_id)}/title`, {
            method: 'PUT',
            body: JSON.stringify({ title })
          });
          updates.push('title');
        }

        if (description !== undefined) {
          await ohFetch(`/api/endeavors/${encodeURIComponent(endeavor_id)}/description`, {
            method: 'PUT',
            body: JSON.stringify({ description })
          });
          updates.push('description');
        }

        if (updates.length === 0) {
          return {
            content: [{
              type: 'text',
              text: 'No updates provided. Specify title and/or description to update.'
            }]
          };
        }

        return {
          content: [{
            type: 'text',
            text: `Endeavor updated successfully. Updated: ${updates.join(', ')}`
          }]
        };
      }

      case 'oh_archive_endeavor': {
        const { endeavor_id, reason } = args as {
          endeavor_id: string;
          reason?: string;
        };

        const data = await ohFetch(`/api/endeavors/${encodeURIComponent(endeavor_id)}/archive`, {
          method: 'POST',
          body: JSON.stringify({ reason })
        });

        return {
          content: [{
            type: 'text',
            text: data.message || 'Endeavor archived successfully'
          }]
        };
      }

      case 'oh_unarchive_endeavor': {
        const { endeavor_id } = args as { endeavor_id: string };

        const data = await ohFetch(`/api/endeavors/${encodeURIComponent(endeavor_id)}/archive`, {
          method: 'DELETE'
        });

        return {
          content: [{
            type: 'text',
            text: data.message || 'Endeavor restored successfully'
          }]
        };
      }

      case 'oh_set_parent': {
        const { endeavor_id, parent_id } = args as {
          endeavor_id: string;
          parent_id?: string;
        };

        const data = await ohFetch(`/api/endeavors/${encodeURIComponent(endeavor_id)}/parent`, {
          method: 'PUT',
          body: JSON.stringify({ parentId: parent_id || null })
        });

        return {
          content: [{
            type: 'text',
            text: data.message || 'Endeavor parent updated successfully'
          }]
        };
      }

      case 'oh_create_context': {
        const { title, description } = args as {
          title: string;
          description?: string;
        };

        const data = await ohFetch('/api/contexts', {
          method: 'POST',
          body: JSON.stringify({ title, description })
        });

        return {
          content: [{
            type: 'text',
            text: `Context created successfully. ID: ${data.contextId}`
          }]
        };
      }

      case 'oh_update_context': {
        const { context_id, title, description } = args as {
          context_id: string;
          title?: string;
          description?: string;
        };

        const data = await ohFetch(`/api/contexts/${encodeURIComponent(context_id)}`, {
          method: 'PUT',
          body: JSON.stringify({ title, description })
        });

        return {
          content: [{
            type: 'text',
            text: 'Context updated successfully'
          }]
        };
      }

      case 'oh_delete_endeavor': {
        const { endeavor_id } = args as { endeavor_id: string };
        const data = await ohFetch(`/api/endeavors/${encodeURIComponent(endeavor_id)}`, {
          method: 'DELETE'
        });
        return { content: [{ type: 'text', text: data.message || 'Endeavor deleted' }] };
      }

      case 'oh_move_endeavor': {
        const { endeavor_id, target_context_id, move_subgraph = true } = args as {
          endeavor_id: string;
          target_context_id: string;
          move_subgraph?: boolean;
        };
        const data = await ohFetch(`/api/endeavors/${encodeURIComponent(endeavor_id)}/move`, {
          method: 'POST',
          body: JSON.stringify({ targetContextId: target_context_id, moveSubgraph: move_subgraph })
        });
        return { content: [{ type: 'text', text: data.message || `Moved to ${target_context_id}` }] };
      }

      case 'oh_delete_context': {
        const { context_id } = args as { context_id: string };
        await ohFetch(`/api/contexts/${encodeURIComponent(context_id)}`, {
          method: 'DELETE'
        });
        return { content: [{ type: 'text', text: 'Context deleted' }] };
      }

      case 'oh_invite_to_context': {
        return { content: [{ type: 'text', text: 'Context invitations are not supported in the OSS edition (no multi-user auth). This tool is available in the hosted product.' }] };
      }

      case 'oh_update_log': {
        const { log_id, content } = args as { log_id: string; content: string };
        await ohFetch(`/api/logs/${encodeURIComponent(log_id)}`, {
          method: 'PUT',
          body: JSON.stringify({ content })
        });
        return { content: [{ type: 'text', text: 'Log updated' }] };
      }

      case 'oh_delete_log': {
        const { log_id } = args as { log_id: string };
        const data = await ohFetch(`/api/logs/${encodeURIComponent(log_id)}`, {
          method: 'DELETE'
        });
        return { content: [{ type: 'text', text: data.message || 'Log deleted' }] };
      }

      case 'oh_create_metis_candidate': {
        const { endeavor_id, content } = args as {
          endeavor_id: string;
          content: string;
        };

        const data = await ohFetch('/api/candidates', {
          method: 'POST',
          body: JSON.stringify({
            type: 'metis',
            endeavor_id,
            content,
            source_type: 'agent'
          })
        });

        return {
          content: [{
            type: 'text',
            text: `Metis candidate created successfully. Candidate ID: ${data.candidate_id}\n\nNext: Human reviews and promotes this candidate in OH app Reflect mode (app.openhorizons.me).`
          }]
        };
      }

      case 'oh_create_guardrail_candidate': {
        const { endeavor_id, content } = args as {
          endeavor_id: string;
          content: string;
        };

        const data = await ohFetch('/api/candidates', {
          method: 'POST',
          body: JSON.stringify({
            type: 'guardrail',
            endeavor_id,
            content,
            source_type: 'agent'
          })
        });

        return {
          content: [{
            type: 'text',
            text: `Guardrail candidate created successfully. Candidate ID: ${data.candidate_id}\n\nNext: Human reviews and promotes this candidate in OH app Reflect mode (app.openhorizons.me).`
          }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{
        type: 'text',
        text: `Error: ${message}`
      }],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Open Horizons MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
