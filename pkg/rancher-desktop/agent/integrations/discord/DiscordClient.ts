// DiscordClient.ts
// Singleton wrapper around discord.js for desktop/local AI agent
// Exposes high-level methods for sending messages, reacting, fetching users/history/etc.
// Handles connection lifecycle, graceful shutdown, reconnection

import { Client, GatewayIntentBits } from 'discord.js';
import { ReactionEmoji } from 'discord.js';
import { ChannelType } from 'discord.js';
import type { WebSocketMessage } from '../../services/WebSocketClientService';
import {
  WebSocketClientService,
} from '../../services/WebSocketClientService';
import {
  getIntegrationService,
  type IntegrationValue,
} from '../../services/IntegrationService';
import { incomingMessage } from './prompts/incoming_message';

const INTEGRATION_ID = 'discord';
const TOKEN_PROPERTY = 'bot_token';

const WS_SERVICE = WebSocketClientService.getInstance();
const DISCORD_EVENTS_CHANNEL = 'chat-controller-backend';

function generateUUID(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback random fill
    for (let i = 0; i < 16; i++) {
      bytes[i] = (Math.random() * 256) | 0;
    }
  }

  // Set version 4 bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Set variant bits
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

function extractMessageFacts(message: Message): string[] {
  const facts: string[] = [];
  
  facts.push(`Message ID: ${message.id}`);
  facts.push(`Author ID: ${message.author.id}`);
  facts.push(`Author Username: ${message.author.username}`);
  facts.push(`Channel ID: ${message.channel.id}`);
  facts.push(`Channel Type: ${message.channel.type}`);
  facts.push(`Timestamp: ${message.createdTimestamp}`);
  facts.push(`Message Content: "${message.content || 'No content'}"`);
  
  if (message.reference?.messageId) {
    facts.push(`Replying to Message ID: ${message.reference.messageId}`);
  }
  
  if (message.attachments.size > 0) {
    facts.push(`Attachments: ${message.attachments.size} files`);
  }
  
  if (message.embeds.length > 0) {
    facts.push(`Embeds: ${message.embeds.length} embeds`);
  }
  
  if (message.mentions.users.size > 0) {
    facts.push(`Mentions: ${message.mentions.users.size} users`);
  }
  
  return facts;
}

export class DiscordClient {
  private client: Client | null = null;
  private connected = false;

  private static instance: DiscordClient | null = null;

  private constructor() {}

  public static getInstance(): DiscordClient {
    if (!DiscordClient.instance) {
      DiscordClient.instance = new DiscordClient();
    }
    return DiscordClient.instance;
  }

  private botToken?: string;

  setToken(botToken: string): void {
    this.botToken = botToken;
  }

  async initialize(): Promise<boolean> {
    if (this.connected) return true;

    const service = getIntegrationService();
    await service.initialize();

    // Prefer injected token → fallback to DB → fallback to env vars
    let botToken = this.botToken;

    if (!botToken) {
      const tokenRow = await service.getIntegrationValue(INTEGRATION_ID, TOKEN_PROPERTY);
      botToken = tokenRow?.value;
    }

    if (!botToken) {
      console.error('[DiscordClient] No Discord token available (injected or DB)');
      return false;
    }

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
      ],
    });

    this.client.on('error', (error) => {
      console.error('[DiscordClient] Client error:', error);
    });

    WS_SERVICE.connect(DISCORD_EVENTS_CHANNEL);

    try {
      await this.client.login(botToken);
      this.connected = true;
      console.log('[DiscordClient] Connected to Discord → forwarding events to internal WS');

      // Forward events
      this.client.on(Events.MessageCreate, async (message) => {
        console.log('[DiscordClient] Message received:', message.content);
        
        // Ignore bot messages
        if (message.author.bot) return;
        
        // Extract key facts from the message
        const facts = extractMessageFacts(message);
        const factsText = facts.map(fact => `- ${fact}`).join('\n');
        
        // Create the complete message with facts + prompt
        const fullMessage = `${factsText}\n\n${incomingMessage}`;
        
        WS_SERVICE.send(DISCORD_EVENTS_CHANNEL, {
          type: 'user_message',
          data: { 
            content: fullMessage 
          },
          id: generateUUID(),
          timestamp: Date.now(),
          channel: DISCORD_EVENTS_CHANNEL,
        });
      });

      // Forward other events
      this.client.on(Events.GuildCreate, (guild) => {
        WS_SERVICE.send(DISCORD_EVENTS_CHANNEL, {
          type: 'discord_event',
          data: {
            type: 'guild_join',
            guild: {
              id: guild.id,
              name: guild.name,
              memberCount: guild.memberCount,
            },
          },
          id: generateUUID(),
          timestamp: Date.now(),
          channel: DISCORD_EVENTS_CHANNEL,
        });
      });

      // Optional: set status in DB on successful connect
      await service.setConnectionStatus(INTEGRATION_ID, true);

      return true;
    } catch (err) {
      console.error('[DiscordClient] Startup failed:', err);
      await service.setConnectionStatus(INTEGRATION_ID, false);
      this.connected = false;
      return false;
    }
  }

  // ────────────────────────────────────────────────
  // Core send methods (most common for AI agent)
  // ────────────────────────────────────────────────

  async sendMessage(
    channelId: string,
    content: string,
    replyToMessageId?: string
  ): Promise<Message> {
    await this.ensureConnected();
    const channel = await this.client!.channels.fetch(channelId);
    
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${channelId} not found or is not text-based`);
    }

    const options: any = { content };
    
    if (replyToMessageId) {
      const replyMessage = await (channel as TextChannel).messages.fetch(replyToMessageId);
      if (replyMessage) {
        options.reply = { messageReference: replyMessage.id };
      }
    }

    return (channel as TextChannel).send(options);
  }

  async replyInThread(
    channelId: string,
    messageId: string,
    content: string
  ): Promise<Message> {
    await this.ensureConnected();
    const channel = await this.client!.channels.fetch(channelId);
    
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${channelId} not found or is not text-based`);
    }

    const message = await (channel as TextChannel).messages.fetch(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    return message.reply({ content });
  }

  async editMessage(
    channelId: string,
    messageId: string,
    content: string
  ): Promise<Message> {
    await this.ensureConnected();
    const channel = await this.client!.channels.fetch(channelId);
    
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${channelId} not found or is not text-based`);
    }

    const message = await (channel as TextChannel).messages.fetch(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    return message.edit(content);
  }

  async addReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
    await this.ensureConnected();
    const channel = await this.client!.channels.fetch(channelId);
    
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${channelId} not found or is not text-based`);
    }

    const message = await (channel as TextChannel).messages.fetch(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    await message.react(emoji);
  }

  async removeReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
    await this.ensureConnected();
    const channel = await this.client!.channels.fetch(channelId);
    
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${channelId} not found or is not text-based`);
    }

    const message = await (channel as TextChannel).messages.fetch(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    await message.reactions.cache.get(emoji)?.users.remove(this.client!.user!.id);
  }

  async joinGuild(guildId: string): Promise<Guild> {
    await this.ensureConnected();
    // Discord bots don't "join" guilds via API - they must be invited
    // This method will return the guild if the bot is already a member
    const guild = this.client!.guilds.cache.get(guildId);
    if (!guild) {
      throw new Error(`Bot is not a member of guild ${guildId}. Use an invite link to add the bot.`);
    }
    return guild;
  }

  // ────────────────────────────────────────────────
  // Fetch / read methods
  // ────────────────────────────────────────────────

  async getGuilds(): Promise<Guild[]> {
    await this.ensureConnected();
    return Array.from(this.client!.guilds.cache.values());
  }

  async getChannels(guildId: string): Promise<any[]> {
    await this.ensureConnected();
    const guild = this.client!.guilds.cache.get(guildId);
    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }

    return Array.from(guild.channels.cache.values())
      .filter(channel => channel.isTextBased())
      .map(channel => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        guildId: channel.guild.id,
      }));
  }

  async getUserInfo(userId: string): Promise<User> {
    await this.ensureConnected();
    const user = await this.client!.users.fetch(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    return user;
  }

  async getChannelHistory(
    channelId: string,
    limit = 50
  ): Promise<Message[]> {
    await this.ensureConnected();
    const channel = await this.client!.channels.fetch(channelId);
    
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${channelId} not found or is not text-based`);
    }

    const messages = await (channel as TextChannel).messages.fetch({ limit });
    return Array.from(messages.values());
  }

  async getThreadReplies(channelId: string, messageId: string): Promise<Message[]> {
    await this.ensureConnected();
    const channel = await this.client!.channels.fetch(channelId);
    
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${channelId} not found or is not text-based`);
    }

    const message = await (channel as TextChannel).messages.fetch(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    if (!message.thread) {
      return [];
    }

    const threadMessages = await message.thread.messages.fetch();
    return Array.from(threadMessages.values());
  }

  async close(): Promise<void> {
    if (!this.connected) return;
    try {
      this.client!.destroy();
      this.connected = false;
      console.log('[DiscordClient] Connection closed');
    } catch (err) {
      console.error('[DiscordClient] Shutdown error:', err);
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      const ok = await this.initialize();
      if (!ok) throw new Error('[DiscordClient] Not connected');
    }
  }
}

export const discordClient = DiscordClient.getInstance();