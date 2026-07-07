export function escapeShellString(str: string): string {
  // Replace ' with '\'' and wrap in single quotes
  return `'${str.replace(/'/g, "'\\''")}'`;
}

export interface DiscordContext {
  channelId: string;
  channelName: string;
  userId: string;
  messageId?: string;
}

export function buildClaudeCommand(
  workingDir: string,
  prompt: string,
  sessionId?: string,
  discordContext?: DiscordContext
): string {
  const escapedPrompt = escapeShellString(prompt);
  const mcpConfigJson = JSON.stringify(buildMcpConfig(discordContext));

  const commandParts = [
    `cd ${workingDir}`,
    "&&",
    "claude",
    "--output-format",
    "stream-json",
    "--model",
    "sonnet",
    "-p",
    escapedPrompt,
    "--verbose",
    // Claude Code 2.x accepts the MCP config inline as a JSON string; the
    // permission server is reached over HTTP directly (no stdio bridge).
    "--mcp-config",
    escapeShellString(mcpConfigJson),
    "--strict-mcp-config",
    "--permission-prompt-tool",
    "mcp__discord-permissions__approve_tool",
    "--allowedTools",
    "mcp__discord-permissions",
  ];

  if (sessionId) {
    commandParts.splice(3, 0, "--resume", sessionId);
  }

  return commandParts.join(" ");
}

/**
 * MCP config pointing Claude Code at the bot's HTTP permission server.
 * Discord context travels as HTTP headers, which the server reads to route
 * approval prompts back to the right channel.
 */
function buildMcpConfig(discordContext?: DiscordContext): object {
  const port = process.env.MCP_SERVER_PORT || "3001";

  const server: Record<string, unknown> = {
    type: "http",
    url: `http://localhost:${port}/mcp`,
  };

  if (discordContext) {
    const headers: Record<string, string> = {
      "X-Discord-Channel-Id": discordContext.channelId,
      "X-Discord-Channel-Name": discordContext.channelName,
      "X-Discord-User-Id": discordContext.userId,
    };
    if (discordContext.messageId) {
      headers["X-Discord-Message-Id"] = discordContext.messageId;
    }
    server.headers = headers;
  }

  return {
    mcpServers: {
      "discord-permissions": server,
    },
  };
}
