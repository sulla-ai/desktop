// When Sulla receives an event notification
import { SlackTool } from '../SlackTool';

function getSlackInstructions(): string {
  return new SlackTool().getPlanningInstructions();
}

export const incomingMessage = `
This message was sent to you via Slack.
In order to reply to this message you need to use the slack tool.

Rules:
1. Ignore your own messages (botUserId in text or subtype === 'bot_message')
2. Detect direct mentions: text contains <@botUserId>
3. If no mention → ignore unless high-priority keyword (urgent, alert, lead, emergency, now, asap)
4. If addressed → respond concisely, professionally, action-oriented
5. Never hallucinate — stick to visible facts in payload

## Slack usage instructions
${getSlackInstructions()}
`;