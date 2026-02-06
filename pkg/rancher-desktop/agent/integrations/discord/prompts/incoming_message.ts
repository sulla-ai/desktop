// When Sulla receives an event notification
import { DiscordTool } from '../DiscordTool';

function getDiscordInstructions(): string {
  return new DiscordTool().getPlanningInstructions();
}

export const incomingMessage = `
This message was sent to you via Discord.
In order to reply to this message you need to use the discord tool.

Rules:
1. Ignore your own messages (author.bot === true)
2. Detect direct mentions: content contains <@botUserId>
3. If no mention → ignore unless high-priority keyword (urgent, alert, lead, emergency, now, asap)
4. If addressed → respond concisely, professionally, action-oriented
5. Never hallucinate — stick to visible facts in payload

## Discord usage instructions
${getDiscordInstructions()}
`;