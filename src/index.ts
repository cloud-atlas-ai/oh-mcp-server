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

// Types for bootstrap state assessment
interface GraphNode {
  id: string;
  node_type: string;
  parent_id: string | null;
  title: string;
  description: string;
  status: string;
  created_at: string;
}

interface UserState {
  contextCount: number;
  personalContext: { id: string; title: string } | null;
  hasMission: boolean;
  missionCount: number;
  aimCount: number;
  initiativeCount: number;
  taskCount: number;
  maxDepth: number;
  recentLogCount: number;
  lastLogDate: string | null;
  missions: GraphNode[];
  aims: GraphNode[];
}

// Assess user's OH state from fetched data
function assessUserState(
  contexts: Array<{ id: string; title: string; is_owner: boolean }>,
  endeavors: GraphNode[],
  logs: Array<{ log_date: string }>
): UserState {
  const personalContext = contexts.find(c =>
    c.title === 'Personal Workspace' || c.id.includes('personal:')
  ) || null;

  const missions = endeavors.filter(e => e.node_type.toLowerCase() === 'mission');
  const aims = endeavors.filter(e => e.node_type.toLowerCase() === 'aim');
  const initiatives = endeavors.filter(e => e.node_type.toLowerCase() === 'initiative');
  const tasks = endeavors.filter(e => e.node_type.toLowerCase() === 'task');

  // Calculate max depth by checking parent chains
  let maxDepth = 0;
  if (missions.length > 0) maxDepth = 1;
  if (aims.length > 0) maxDepth = 2;
  if (initiatives.length > 0) maxDepth = 3;
  if (tasks.length > 0) maxDepth = 4;

  // Sort logs by date to find most recent
  const sortedLogs = [...logs].sort((a, b) =>
    new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
  );

  return {
    contextCount: contexts.length,
    personalContext: personalContext ? { id: personalContext.id, title: personalContext.title } : null,
    hasMission: missions.length > 0,
    missionCount: missions.length,
    aimCount: aims.length,
    initiativeCount: initiatives.length,
    taskCount: tasks.length,
    maxDepth,
    recentLogCount: logs.length,
    lastLogDate: sortedLogs.length > 0 ? sortedLogs[0].log_date : null,
    missions,
    aims
  };
}

// Generate bootstrap guidance based on user state
function generateBootstrapGuidance(
  state: UserState,
  currentWork: string | undefined,
  depth: 'quick' | 'thorough'
): string {
  // Handle no-contexts edge case
  if (state.contextCount === 0) {
    return `## Getting Started with Open Horizons

You don't have any OH contexts yet. Your Personal Workspace is created automatically when you first visit the OH app.

**Next step**: Visit [app.openhorizons.me](https://app.openhorizons.me) to set up your account, then run oh_bootstrap again.`;
  }

  const sections: string[] = [];

  // Section 1: Current State Summary
  if (depth === 'thorough') {
    const stateLines: string[] = ['## Your OH State\n'];
    if (state.personalContext) {
      stateLines.push(`**Context**: ${state.personalContext.title}`);
    }
    stateLines.push(`**Structure**: ${state.missionCount} Mission(s) → ${state.aimCount} Aim(s) → ${state.initiativeCount} Initiative(s) → ${state.taskCount} Task(s)`);
    if (state.recentLogCount > 0) {
      stateLines.push(`**Recent activity**: ${state.recentLogCount} log(s) in last 7 days (latest: ${state.lastLogDate})`);
    } else {
      stateLines.push(`**Recent activity**: No logs in the last 7 days`);
    }
    if (state.contextCount > 1) {
      stateLines.push(`\n*Tip: You have ${state.contextCount} contexts. Pass context_id to analyze a specific one.*`);
    }
    sections.push(stateLines.join('\n'));
  }

  // Section 2: Current Work Analysis (if provided)
  if (currentWork) {
    const workLines: string[] = ['\n## Connecting Your Work\n'];
    workLines.push(`You're working on: **${currentWork}**\n`);

    if (!state.hasMission) {
      workLines.push(`Before diving into "${currentWork}", consider: what larger purpose does this serve? This work is a means to an end - what's the end?\n`);
      workLines.push(`*"You're more likely to get where you want to go if you know where you're going."* (Aim With Clarity)`);
    } else if (state.aimCount === 0) {
      workLines.push(`You have a mission but no aims. Where does "${currentWork}" fit in your multi-year outcomes? Creating an aim first will help you see if this work is strategically aligned.\n`);
      workLines.push(`*"Focus on what energizes you - those are the aims you'll sustain."* (Leverage Strengths)`);
    } else {
      workLines.push(`Consider which of your ${state.aimCount} aim(s) this work serves. If it doesn't clearly connect to any, that's valuable signal - either create a new aim or question if this work serves your priorities.\n`);
      workLines.push(`*"Adaptability and momentum matter more than rigid adherence to a plan."* (Planning Over Plans)`);
    }
    sections.push(workLines.join('\n'));
  }

  // Section 3: Gap Analysis & Next Steps
  const nextSteps: string[] = ['\n## Recommended Next Steps\n'];
  const commands: string[] = ['\n## Suggested Commands\n```'];

  if (!state.hasMission) {
    nextSteps.push(`1. **Define your Mission** - What's your foundational purpose? A mission answers "why do I exist?" and makes every subsequent decision easier.`);
    nextSteps.push(`   - Example: "Build tools that help teams stay strategically aligned"`);
    commands.push(`oh_create_endeavor({ title: "Your mission here", type: "mission" })`);
  } else if (state.aimCount === 0) {
    nextSteps.push(`1. **Create 2-3 Aims** - What multi-year outcomes move you toward your mission? Limit to what you can realistically focus on.`);
    nextSteps.push(`   - Example aims: "Master distributed systems", "Build a profitable SaaS product"`);
    commands.push(`oh_create_endeavor({ title: "Your aim here", type: "aim", parent_id: "${state.missions[0]?.id || '<mission_id>'}" })`);
  } else if (state.initiativeCount === 0) {
    nextSteps.push(`1. **Create Initiatives** - What concrete projects or efforts will achieve your aims? These are your "how".`);
    commands.push(`oh_create_endeavor({ title: "Your initiative here", type: "initiative", parent_id: "${state.aims[0]?.id || '<aim_id>'}" })`);
  } else if (state.recentLogCount === 0) {
    nextSteps.push(`1. **Start logging progress** - Your structure looks solid. Now capture decisions and learnings as you work.`);
    nextSteps.push(`   *"Regular reflection and celebrating wins keeps growth dynamic."* (Sustain Momentum)`);
    commands.push(`oh_log_decision({ endeavor_id: "<endeavor_id>", content: "Completed X, decided Y because Z" })`);
  } else {
    nextSteps.push(`1. **Continue your momentum** - Your alignment is active. Keep logging decisions and surface patterns as metis candidates when you notice them.`);
    commands.push(`oh_log_decision({ endeavor_id: "<endeavor_id>", content: "..." })`);
    commands.push(`oh_create_metis_candidate({ endeavor_id: "<endeavor_id>", content: "Expected X, got Y, matters because Z" })`);
  }

  // Add a secondary recommendation based on state
  if (state.hasMission && state.recentLogCount > 0 && depth === 'thorough') {
    nextSteps.push(`\n2. **Review your logs for patterns** - Look for recurring themes that might become metis (practical wisdom) or guardrails (constraints to enforce).`);
  }

  commands.push('```');
  sections.push(nextSteps.join('\n'));
  sections.push(commands.join('\n'));

  return sections.join('\n');
}

// Instructions for Claude on when/how to use OH MCP tools
const SERVER_INSTRUCTIONS = `
Open Horizons MCP Server - Strategic Alignment for AI Agents

Use this server to align AI decision-making with strategic context from Open Horizons.

## Quick Start

Call **oh_bootstrap** at session start to get context-aware guidance. Optionally pass current_work to connect your work to strategic context.

## When to Use

1. **Starting Work Sessions**: Call oh_bootstrap with current_work to understand how your work connects to strategic context. Example: oh_bootstrap({ current_work: "building auth system" })

2. **Logging Progress**: After completing meaningful work (features, fixes, refactors), log decisions with oh_log_decision tied to relevant endeavors.

3. **Surfacing Insights**: When you discover patterns or constraints during work:
   - Use oh_create_metis_candidate for learnings/patterns (e.g., "Expected X, got Y, matters because Z")
   - Use oh_create_guardrail_candidate for rules that should never be violated

## Key Concepts

- **Contexts**: Personal or shared workspaces containing endeavors
- **Endeavors**: Hierarchical alignment structure (Mission → Aim → Initiative → Task)
- **Decision Logs**: Captured reasoning tied to endeavors for traceability
- **Candidates**: Insights surfaced for human review in OH Reflect mode

## Proactive Usage

If OH is configured, proactively:
- Call oh_bootstrap at session start to get tailored guidance
- Log important decisions after completing meaningful work
- Surface learnings when patterns emerge (metis candidates)
- Flag constraints that should be enforced (guardrail candidates)
`.trim();

// Create the MCP server
const server = new Server(
  { name: 'open-horizons', version: '0.3.1' },
  {
    capabilities: { tools: {} },
    instructions: SERVER_INSTRUCTIONS
  }
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
      // Write operations - Candidates (for Reflect mode)
      {
        name: 'oh_create_metis_candidate',
        description: 'Create a metis candidate (pattern/learning observed during work). Use this when you discover a reusable insight. The candidate will be reviewed by a human in the OH app Reflect mode, where they can promote it to full metis with structured fields (violated_expectation, observed_reality, consequence).',
        inputSchema: {
          type: 'object',
          properties: {
            endeavor_id: { type: 'string', description: 'Endeavor ID this learning belongs to' },
            context_id: { type: 'string', description: 'Context ID if not linked to a specific endeavor' },
            content: { type: 'string', description: 'The insight or pattern observed (markdown). Describe: what you expected, what actually happened, and why the difference mattered.' }
          },
          required: ['content']
        }
      },
      {
        name: 'oh_create_guardrail_candidate',
        description: 'Create a guardrail candidate (constraint/rule that should be enforced). Use this when you discover something that should NEVER happen again. The candidate will be reviewed by a human in the OH app Reflect mode, where they can promote it to full guardrail with title and override protocol.',
        inputSchema: {
          type: 'object',
          properties: {
            endeavor_id: { type: 'string', description: 'Endeavor ID this constraint applies to' },
            context_id: { type: 'string', description: 'Context ID if not linked to a specific endeavor' },
            content: { type: 'string', description: 'The constraint or rule (markdown). Should clearly state what must/must not happen and why.' }
          },
          required: ['content']
        }
      },
      // Bootstrap - context-aware onboarding and alignment
      {
        name: 'oh_bootstrap',
        description: 'Analyze your OH setup and get context-aware guidance for connecting your current work to your strategic hierarchy. Use at session start or when beginning new work to ensure alignment.',
        inputSchema: {
          type: 'object',
          properties: {
            current_work: {
              type: 'string',
              description: 'What you are currently working on (e.g., "building auth system", "refactoring the API"). Helps connect work to strategic context.'
            },
            context_id: {
              type: 'string',
              description: 'Which OH context to analyze (defaults to personal context)'
            },
            depth: {
              type: 'string',
              enum: ['quick', 'thorough'],
              description: 'Quick = summary + next step. Thorough = full state analysis + detailed guidance. Default: thorough'
            }
          },
          required: []
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
        const data = await ohFetch(`/api/contexts/${encodeURIComponent(context_id)}`, {
          method: 'DELETE'
        });
        return { content: [{ type: 'text', text: 'Context deleted' }] };
      }

      case 'oh_invite_to_context': {
        const { context_id, email, role } = args as {
          context_id: string;
          email: string;
          role?: 'editor' | 'viewer';
        };
        const data = await ohFetch(`/api/contexts/${encodeURIComponent(context_id)}/invite`, {
          method: 'POST',
          body: JSON.stringify({ email, role })
        });
        return { content: [{ type: 'text', text: `Invitation sent to ${email}` }] };
      }

      case 'oh_update_log': {
        const { log_id, content } = args as { log_id: string; content: string };
        const data = await ohFetch(`/api/logs/${encodeURIComponent(log_id)}`, {
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
        const { endeavor_id, context_id, content } = args as {
          endeavor_id?: string;
          context_id?: string;
          content: string;
        };
        if (!endeavor_id && !context_id) {
          return {
            content: [{ type: 'text', text: 'Error: Either endeavor_id or context_id is required' }],
            isError: true
          };
        }
        const data = await ohFetch('/api/candidates', {
          method: 'POST',
          body: JSON.stringify({
            type: 'metis',
            endeavor_id,
            context_id,
            content,
            source_type: 'mcp_session'
          })
        });
        return {
          content: [{
            type: 'text',
            text: `Metis candidate created. ID: ${data.candidate_id}. It will appear in OH Reflect mode for review.`
          }]
        };
      }

      case 'oh_create_guardrail_candidate': {
        const { endeavor_id, context_id, content } = args as {
          endeavor_id?: string;
          context_id?: string;
          content: string;
        };
        if (!endeavor_id && !context_id) {
          return {
            content: [{ type: 'text', text: 'Error: Either endeavor_id or context_id is required' }],
            isError: true
          };
        }
        const data = await ohFetch('/api/candidates', {
          method: 'POST',
          body: JSON.stringify({
            type: 'guardrail',
            endeavor_id,
            context_id,
            content,
            source_type: 'mcp_session'
          })
        });
        return {
          content: [{
            type: 'text',
            text: `Guardrail candidate created. ID: ${data.candidate_id}. It will appear in OH Reflect mode for review.`
          }]
        };
      }

      case 'oh_bootstrap': {
        const { current_work, context_id, depth = 'thorough' } = args as {
          current_work?: string;
          context_id?: string;
          depth?: 'quick' | 'thorough';
        };

        // Fetch current state
        const contexts = await ohFetch('/api/contexts');

        // Find target context (specified, or personal)
        let targetContext = context_id
          ? contexts.find((c: { id: string }) => c.id === context_id)
          : contexts.find((c: { id: string; title: string }) =>
              c.title === 'Personal Workspace' || c.id.includes('personal:')
            );

        if (!targetContext && contexts.length > 0) {
          targetContext = contexts[0]; // Fall back to first available
        }

        // Fetch endeavors for the target context
        let endeavors: GraphNode[] = [];
        if (targetContext) {
          try {
            const dashboard = await ohFetch(`/api/dashboard?contextId=${encodeURIComponent(targetContext.id)}`);
            endeavors = dashboard.nodes || dashboard || [];
          } catch (e) {
            console.error('Warning: Failed to fetch endeavors:', e instanceof Error ? e.message : e);
          }
        }

        // Fetch user's recent logs (last 7 days, all endeavors)
        let recentLogs: Array<{ log_date: string }> = [];
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        try {
          const logsData = await ohFetch(
            `/api/logs?start_date=${startDate}&end_date=${endDate}`
          );
          recentLogs = logsData.logs || [];
        } catch (e) {
          console.error('Warning: Failed to fetch logs:', e instanceof Error ? e.message : e);
        }

        // Assess state and generate guidance
        const state = assessUserState(contexts, endeavors, recentLogs);
        const guidance = generateBootstrapGuidance(state, current_work, depth);

        return {
          content: [{
            type: 'text',
            text: guidance
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
