// DiscordTool.ts
// Bridge tool to call the LLM (your internal agent/LLM) from within agent reasoning

import type { ThreadState, ToolResult } from '../../types';
import { BaseTool } from '../../tools/BaseTool';
import type { ToolContext } from '../../tools/BaseTool';
import { registry } from '..';
import type { DiscordClient } from './DiscordClient';

export class DiscordTool extends BaseTool {
  override readonly name = 'discord';

  override getPlanningInstructions(): string {
  return `["discord", "send", "channel-id", "Message text here"] - Send message via Discord bot

Examples:
["discord", "send", "123456789012345678", "Hey team, quick update: lead score threshold raised to 82"]  // sendMessage (channel)
["discord", "send", "123456789012345678", "Your appointment is confirmed for tomorrow 10am", "987654321098765432"] // sendMessage (channel + reply to message)
["discord", "thread", "channel-id", "message-id", "Thread reply: thanks for the feedback"] // replyInThread (channel + message)

["discord", "edit", "channel-id", "message-id", "Updated: threshold now 85 – sorry for confusion"] // editMessage (channel, message-id, new text)

["discord", "react", "channel-id", "message-id", "thumbsup"]  // addReaction
["discord", "unreact", "channel-id", "message-id", "thumbsup"]  // removeReaction

["discord", "guilds"]  // getGuilds (list all servers bot is in)
["discord", "channels", "guild-id"]  // getChannels (list channels in a server)

["discord", "history", "channel-id", "10"]  // getChannelHistory (channel, limit)
["discord", "thread", "channel-id", "message-id"]  // getThreadReplies

["discord", "user", "user-id"] // getUserInfo

Use when you need to:
- Post/send messages or replies
- Reply in threads
- Edit messages
- Add/remove emoji reactions
- Fetch server/channel/thread history or user info
- List servers and channels
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
      const discord = await registry.get<DiscordClient>('discord');

      switch (subcommand) {
        case 'send': {
          if (params.length < 2) throw new Error('Need channel + message');
          const channelId = params[0];
          let content = params.slice(1).join(' ');
          let replyToMessageId: string | undefined;

          // Last arg might be message ID if it looks like a Discord snowflake
          if (params.length > 2 && /^\d{17,19}$/.test(params[params.length - 1])) {
            replyToMessageId = params.pop()!;
            content = params.slice(1).join(' ');
          }

          const res = await discord.sendMessage(channelId, content, replyToMessageId);
          return {
            toolName: this.name,
            success: true,
            result: { 
              channelId: res.channel.id, 
              messageId: res.id, 
              content: content.slice(0, 80) + (content.length > 80 ? '...' : '') 
            }
          };
        }

        case 'thread': {
          if (params.length < 3) throw new Error('Need channel, message-id, text');
          const [channelId, messageId, ...contentParts] = params;
          const content = contentParts.join(' ');
          const res = await discord.replyInThread(channelId, messageId, content);
          return { 
            toolName: this.name, 
            success: true, 
            result: { 
              channelId: res.channel.id, 
              messageId: res.id,
              content: content.slice(0, 80) + (content.length > 80 ? '...' : '') 
            } 
          };
        }

        case 'edit': {
          if (params.length < 3) throw new Error('Need channel, message-id, text');
          const [channelId, messageId, ...contentParts] = params;
          const content = contentParts.join(' ');
          const res = await discord.editMessage(channelId, messageId, content);
          return { 
            toolName: this.name, 
            success: true, 
            result: { 
              channelId: res.channel.id, 
              messageId: res.id,
              content: content.slice(0, 80) + (content.length > 80 ? '...' : '') 
            } 
          };
        }

        case 'react': {
          if (params.length !== 3) throw new Error('Need channel, message-id, reaction');
          const [channelId, messageId, reaction] = params;
          await discord.addReaction(channelId, messageId, reaction);
          return { toolName: this.name, success: true, result: { added: reaction } };
        }

        case 'unreact': {
          if (params.length !== 3) throw new Error('Need channel, message-id, reaction');
          const [channelId, messageId, reaction] = params;
          await discord.removeReaction(channelId, messageId, reaction);
          return { toolName: this.name, success: true, result: { removed: reaction } };
        }

        case 'guilds': {
          const guilds = await discord.getGuilds();
          return {
            toolName: this.name,
            success: true,
            result: guilds.map((g: any) => ({ id: g.id, name: g.name, memberCount: g.memberCount }))
          };
        }

        case 'channels': {
          if (params.length !== 1) throw new Error('Need guild ID');
          const channels = await discord.getChannels(params[0]);
          return {
            toolName: this.name,
            success: true,
            result: channels.map((c: any) => ({ id: c.id, name: c.name, type: c.type }))
          };
        }

        case 'history': {
          if (params.length < 1) throw new Error('Need channel ID');
          const channelId = params[0];
          const limit = params[1] ? parseInt(params[1], 10) : 10;
          const msgs = await discord.getChannelHistory(channelId, limit);
          return { 
            toolName: this.name, 
            success: true, 
            result: { 
              count: msgs.length,
              messages: msgs.map((m: any) => ({
                id: m.id,
                author: m.author.username,
                content: m.content.slice(0, 100) + (m.content.length > 100 ? '...' : ''),
                timestamp: m.createdTimestamp
              }))
            } 
          };
        }

        case 'thread': {
          if (params.length !== 2) throw new Error('Need channel + message-id');
          const [channelId, messageId] = params;
          const replies = await discord.getThreadReplies(channelId, messageId);
          return { 
            toolName: this.name, 
            success: true, 
            result: { 
              count: replies.length,
              messages: replies.map((m: any) => ({
                id: m.id,
                author: m.author.username,
                content: m.content.slice(0, 100) + (m.content.length > 100 ? '...' : ''),
                timestamp: m.createdTimestamp
              }))
            } 
          };
        }

        case 'user': {
          if (params.length !== 1) throw new Error('Need user ID');
          const user = await discord.getUserInfo(params[0]);
          return {
            toolName: this.name,
            success: true,
            result: { 
              id: user.id, 
              username: user.username, 
              displayName: user.displayName || user.globalName,
              bot: user.bot
            }
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