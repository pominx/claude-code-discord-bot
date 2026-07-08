import type { Config } from '../types/index.js';

export function validateConfig(): Config {
  const discordToken = process.env.DISCORD_TOKEN;
  const allowedUserId = process.env.ALLOWED_USER_ID;
  const baseFolder = process.env.BASE_FOLDER;

  if (!discordToken) {
    console.error("DISCORD_TOKEN environment variable is required");
    process.exit(1);
  }

  if (!allowedUserId) {
    console.warn(
      "ALLOWED_USER_ID is not set - everyone in the channel can trigger the bot"
    );
  }

  if (!baseFolder) {
    console.error("BASE_FOLDER environment variable is required");
    process.exit(1);
  }

  return {
    discordToken,
    allowedUserId,
    baseFolder,
  };
}