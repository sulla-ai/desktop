// SlackClient.ts
// Singleton wrapper around @slack/bolt (Socket Mode) for desktop/local AI agent
// Exposes high-level methods for sending messages, reacting, fetching users/history/etc.
// Handles connection lifecycle, graceful shutdown, reconnection

import { App, LogLevel } from '@slack/bolt';
import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt';
import type { ChatPostMessageResponse } from '@slack/web-api';
import type { WebAPICallResult } from '@slack/web-api';
import { SlackTool } from './SlackTool';
import {
  WebSocketClientService,
  type WebSocketMessage,
} from '../../services/WebSocketClientService';

import {
  getIntegrationService,
  type IntegrationValue,
} from '../../services/IntegrationService';
import { incomingMessage } from './prompts/incoming_message';

function getSlackInstructions(): string {
  return new SlackTool().getPlanningInstructions();
}

const INTEGRATION_ID = 'slack';
const TOKEN_PROPERTY = 'bot_token';
const APP_TOKEN_PROPERTY = 'scopes_token';

const WS_SERVICE = WebSocketClientService.getInstance();
const SLACK_EVENTS_CHANNEL = 'dreaming-protocol';

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

function extractMessageFacts(args: any): string[] {
  const facts: string[] = [];
  const event = args.event;
  const message = args.message;
  
  facts.push(`Event Type: ${event.type}`);
  facts.push(`User ID: ${event.user}`);
  facts.push(`Channel: ${event.channel}`);
  facts.push(`Channel Type: ${event.channel_type || 'unknown'}`);
  facts.push(`Timestamp: ${event.ts}`);
  facts.push(`Message Text: "${event.text || 'No text'}"`);
  
  if (event.thread_ts) {
    facts.push(`Thread Timestamp: ${event.thread_ts}`);
  }
  
  if (message.subtype) {
    facts.push(`Message Subtype: ${message.subtype}`);
  }
  
  if (message.blocks && message.blocks.length > 0) {
    facts.push(`Has Blocks: Yes (${message.blocks.length} blocks)`);
  }
  
  return facts;
}

export class SlackClient {
  private app: App | null = null;
  private connected = false;

  private static instance: SlackClient | null = null;

  private constructor() {}

  public static getInstance(): SlackClient {
    if (!SlackClient.instance) {
      SlackClient.instance = new SlackClient();
    }
    return SlackClient.instance;
  }
  private botToken?: string;
  private appToken?: string;

  setTokens(botToken: string, appToken: string): void {
    this.botToken = botToken;
    this.appToken = appToken;
  }

  async initialize(): Promise<boolean> {
    if (this.connected) return true;

    const service = getIntegrationService();
    await service.initialize();

    // Prefer injected tokens → fallback to DB → fallback to env vars
    let botToken = this.botToken;
    let appToken = this.appToken;

    if (!botToken || !appToken) {
        const [botRow, appRow] = await Promise.all([
            service.getIntegrationValue(INTEGRATION_ID, TOKEN_PROPERTY),
            service.getIntegrationValue(INTEGRATION_ID, APP_TOKEN_PROPERTY),
        ]);

        botToken = botRow?.value;
        appToken = appRow?.value;
    }

    if (!botToken || !appToken) {
        console.error('[SlackClient] No Slack tokens available (injected or DB)');
        return false;
    }

    this.app = new App({
        token: botToken,
        appToken: appToken,
        socketMode: true,
        logLevel: LogLevel.INFO,
    });

    this.app.error(async (error) => {
      console.error('[SlackClient] Bolt error:', error);
    });

    WS_SERVICE.connect(SLACK_EVENTS_CHANNEL);

    try {
      await this.app.start();
      this.connected = true;
      console.log('[SlackClient] Socket Mode connected → forwarding to internal WS');

      // Forward events
      this.app.event(/.*/, async (args) => {
        console.log('[SlackClient] Event received:', args.event.type, args.event);
        WS_SERVICE.send(SLACK_EVENTS_CHANNEL, {
          type: 'slack_event',
          data: {
            type: args.event.type || 'unknown',
            event: args.event,
            context: args.context,
          },
          id: generateUUID(),
          timestamp: Date.now(),
          channel: SLACK_EVENTS_CHANNEL,
        });
      });

      this.app.message(async (args) => {
        const event: any = args.event;
        console.log('[SlackClient] Message landed', event.text);
        if (args.message.subtype === 'bot_message') return;
        
        // Extract key facts from the message
        const facts = extractMessageFacts(args);
        const factsText = facts.map(fact => `- ${fact}`).join('\n');
        
        // Create the complete message with facts + prompt
        const fullMessage = `${factsText}\n\n${incomingMessage}\n\n${getSlackInstructions()}`;
        
        WS_SERVICE.send(SLACK_EVENTS_CHANNEL, {
          type: 'user_message',
          data: { 
            content: fullMessage 
          },
          id: generateUUID(),
          timestamp: Date.now(),
          channel: SLACK_EVENTS_CHANNEL,
        });
      });

      // Optional: set status in DB on successful connect
      await service.setConnectionStatus(INTEGRATION_ID, true);

      return true;
    } catch (err) {
      console.error('[SlackClient] Startup failed:', err);
      await service.setConnectionStatus(INTEGRATION_ID, false);
      this.connected = false;
      return false;
    }
  }

  // ────────────────────────────────────────────────
  // Core send methods (most common for AI agent)
  // ────────────────────────────────────────────────

  async sendMessage(
    channel: string,
    text: string,
    thread_ts?: string,
    blocks?: any[]
  ): Promise<ChatPostMessageResponse & { ts: string }> {
    await this.ensureConnected();
    const result = await this.app!.client.chat.postMessage({
      channel,
      text,
      thread_ts,
      blocks,
      mrkdwn: true,
    });
    
    if (!result.ts) {
      throw new Error('Slack API did not return a timestamp for the message');
    }
    
    return result as ChatPostMessageResponse & { ts: string };
  }

  async replyInThread(
    channel: string,
    thread_ts: string,
    text: string,
    blocks?: any[]
  ): Promise<WebAPICallResult & { ts: string }> {
    return this.sendMessage(channel, text, thread_ts, blocks);
  }

  async updateMessage(
    channel: string,
    ts: string,
    text: string,
    blocks?: any[]
  ): Promise<WebAPICallResult> {
    await this.ensureConnected();
    return this.app!.client.chat.update({ channel, ts, text, blocks });
  }

  async addReaction(channel: string, ts: string, reaction: string): Promise<WebAPICallResult> {
    await this.ensureConnected();
    return this.app!.client.reactions.add({ channel, timestamp: ts, name: reaction });
  }

  async removeReaction(channel: string, ts: string, reaction: string): Promise<WebAPICallResult> {
    await this.ensureConnected();
    return this.app!.client.reactions.remove({ channel, timestamp: ts, name: reaction });
  }

  async joinChannel(channelId: string): Promise<WebAPICallResult> {
    await this.ensureConnected();
    return this.app!.client.conversations.join({ channel: channelId });
  }

  // ────────────────────────────────────────────────
  // Fetch / read methods
  // ────────────────────────────────────────────────

  async listChannels(types: ('public_channel' | 'private_channel' | 'im' | 'mpim')[] = ['public_channel']): Promise<any[]> {
    await this.ensureConnected();
    let channels: any[] = [];
    let cursor: string | undefined;

    do {
        const response = await this.app!.client.conversations.list({
        types: types.join(','),
        limit: 1000,
        cursor,
        });

        channels = channels.concat(response.channels ?? []);
        cursor = response.response_metadata?.next_cursor;
    } while (cursor);

    return channels;
  }

  async getUserInfo(userId: string): Promise<any> {
    await this.ensureConnected();
    const res = await this.app!.client.users.info({ user: userId });
    return res.user;
  }

  async getChannelHistory(
    channel: string,
    limit = 50,
    oldest?: string,
    latest?: string
  ): Promise<any[]> {
    await this.ensureConnected();
    const res = await this.app!.client.conversations.history({
      channel,
      limit,
      oldest,
      latest,
      inclusive: true,
    });
    return res.messages ?? [];
  }

  async getThreadReplies(channel: string, ts: string): Promise<any[]> {
    await this.ensureConnected();
    const res = await this.app!.client.conversations.replies({ channel, ts });
    return res.messages ?? [];
  }

  // ────────────────────────────────────────────────
  // Event registration (for your AI agent to hook into)
  // Call these in your main app init after initialize()
  // ────────────────────────────────────────────────

  onMessage(
    callback: (args: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs) => Promise<void>
  ): void {
    this.app!.message(async (args) => {
      // Filter out bot messages if desired
      if (args.message.subtype === 'bot_message') return;
      await callback(args);
    });
  }

  onMention(
    callback: (args: SlackEventMiddlewareArgs<'app_mention'> & AllMiddlewareArgs) => Promise<void>
  ): void {
    this.app!.event('app_mention', callback);
  }

  onDM(
    callback: (args: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs) => Promise<void>
  ): void {
    this.app!.message(/./, async (args) => {  // all messages
      if (args.message.channel_type !== 'im') return;
      await callback(args);
    });
  }

  // Add more: app.event('channel_joined'), app.event('reaction_added'), etc.

  async close(): Promise<void> {
    if (!this.connected) return;
    try {
      // Bolt Socket Mode doesn't have explicit .stop(), but we can disconnect
      // Future versions may add cleaner shutdown; for now just mark
      this.connected = false;
      console.log('[SlackClient] Socket Mode connection marked closed');
    } catch (err) {
      console.error('[SlackClient] Shutdown error:', err);
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      const ok = await this.initialize();
      if (!ok) throw new Error('[SlackClient] Not connected');
    }
  }
}

export const slackClient = SlackClient.getInstance();