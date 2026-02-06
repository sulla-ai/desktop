// SlackTool.ts
// Bridge tool to call the LLM (your internal agent/LLM) from within agent reasoning

import type { ThreadState, ToolResult } from '../../types';
import { BaseTool } from '../../tools/BaseTool';
import type { ToolContext } from '../../tools/BaseTool';
import { registry } from '..';
import type { SlackClient } from './SlackClient';

export class SlackTool extends BaseTool {
  override readonly name = 'slack';

  override getPlanningInstructions(): string {
  return `["slack", "send", "#channel-or-ID", "Message text here"] - Send message via Slack bot

Examples:
["slack", "send", "C0123456789", "Hey team, quick update: lead score threshold raised to 82"]  // sendMessage (channel)
["slack", "send", "@U123ABCDEF", "Your appointment is confirmed for tomorrow 10am"] // sendMessage (DM/user)
["slack", "send", "channel", "Thread reply: thanks for the feedback", "1723489200.000100"] // replyInThread (channel + thread_ts)

["slack", "update", "channel", "1723489200.000100", "Updated: threshold now 85 – sorry for confusion"] // updateMessage (channel, ts, new text)

["slack", "react", "channel", "timestamp", "reaction"]  // addReaction
["slack", "unreact", "channel", "1723489200.000100", "thumbsup"]  // removeReaction

["slack", "list"]  // listChannels (public by default)
["slack", "join", "channel"]  // joinChannel

["slack", "history", "channel", "10"]  // getChannelHistory (channel, limit)
["slack", "thread", "channel", "1723489200.000100"]  // getThreadReplies

["slack", "user", "userid"] // getUserInfo

Use when you need to:
- Post/send messages or DMs
- Reply in threads
- Edit messages
- Add/remove emoji reactions
- Join channels
- Fetch channel/thread history or user info
`.trim();
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const help = await this.handleHelpRequest(context);
    if (help) return help;

    const args = this.getArgsArray(context);
    if (args.length < 1) {
      return { toolName: this.name, success: false, error: 'Missing subcommand' };
    }

    const subcommand = args[0].toLowerCase();
    const params = args.slice(1);

    try {
      const slack = await registry.get<SlackClient>('slack');

      switch (subcommand) {
        case 'send': {
          if (params.length < 2) throw new Error('Need channel + message');
          let channel = params[0];
          let text = params.slice(1).join(' ');
          let thread_ts: string | undefined;

          // Last arg might be thread_ts if it looks like a timestamp
          if (params.length > 2 && /^\d+\.\d+$/.test(params[params.length - 1])) {
            thread_ts = params.pop()!;
            text = params.slice(1).join(' ');
          }

          const res = await slack.sendMessage(channel, text, thread_ts);
          return {
            toolName: this.name,
            success: true,
            result: { channel: res.channel, ts: res.ts, text: text.slice(0, 80) + (text.length > 80 ? '...' : '') }
          };
        }

        case 'update': {
          if (params.length < 3) throw new Error('Need channel, ts, text');
          const [channel, ts, ...textParts] = params;
          const text = textParts.join(' ');
          const res = await slack.updateMessage(channel, ts, text);
          return { toolName: this.name, success: true, result: { ok: res.ok } };
        }

        case 'react': {
          if (params.length !== 3) throw new Error('Need channel, ts, reaction');
          const [channel, ts, reaction] = params;
          await slack.addReaction(channel, ts, reaction);
          return { toolName: this.name, success: true, result: { added: reaction } };
        }

        case 'unreact': {
          if (params.length !== 3) throw new Error('Need channel, ts, reaction');
          const [channel, ts, reaction] = params;
          await slack.removeReaction(channel, ts, reaction);
          return { toolName: this.name, success: true, result: { removed: reaction } };
        }

        case 'join': {
          if (params.length !== 1) throw new Error('Need channel ID');
          await slack.joinChannel(params[0]);
          return { toolName: this.name, success: true, result: { joined: params[0] } };
        }

        case 'list': {
          const channels = await slack.listChannels();
          return {
            toolName: this.name,
            success: true,
            result: channels.map((c: any) => ({ id: c.id, name: c.name, is_member: c.is_member }))
          };
        }

        case 'history': {
          if (params.length < 1) throw new Error('Need channel');
          const channel = params[0];
          const limit = params[1] ? parseInt(params[1], 10) : 10;
          const msgs = await slack.getChannelHistory(channel, limit);
          return { toolName: this.name, success: true, result: { count: msgs.length } };
        }

        case 'thread': {
          if (params.length !== 2) throw new Error('Need channel + ts');
          const [channel, ts] = params;
          const replies = await slack.getThreadReplies(channel, ts);
          return { toolName: this.name, success: true, result: { count: replies.length } };
        }

        case 'user': {
          if (params.length !== 1) throw new Error('Need user ID');
          const user = await slack.getUserInfo(params[0]);
          return {
            toolName: this.name,
            success: true,
            result: { id: user.id, name: user.name, real_name: user.real_name || user.profile?.real_name }
          };
        }

        default:
          return { toolName: this.name, success: false, error: `Unknown subcommand: ${subcommand}` };
      }
    } catch (err: any) {
      return { toolName: this.name, success: false, error: err.message || String(err) };
    }
  }
}