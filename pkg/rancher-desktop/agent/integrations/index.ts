// registry.ts (or wherever you centralize registrations)
import { IntegrationRegistry } from './IntegrationRegistry';
import { getIntegrationService } from '../services/IntegrationService';
import { SlackClient, slackClient } from './slack/SlackClient';

export const registry = new IntegrationRegistry();

/**
 * Slack
 * 
 * 
 */
registry.register('slack', async () => {
  const svc = getIntegrationService();
  await svc.initialize(); // ensure DB tables

  const botToken  = (await svc.getIntegrationValue('slack', 'bot_token'))?.value;
  const appToken  = (await svc.getIntegrationValue('slack', 'scopes_token'))?.value;

  if (!botToken || !appToken) {
    throw new Error('Slack tokens missing in DB');
  }

  // Inject tokens into existing singleton
  slackClient.setTokens(botToken, appToken);

  await slackClient.initialize();

  return slackClient;
});

/**
 * Initialize all Sulla integrations
 * This function is called during application startup to set up all integration factories
 */
export async function SullaIntegrations(): Promise<void> {
  // Integration factories are already registered above
  // This function serves as the explicit initialization hook
  console.log('[Integrations] Sulla integrations initialized');

  try {
    const slack = await registry.get<SlackClient>('slack');
    console.log('[Integrations] Slack client retrieved successfully');
  } catch (error) {
    console.error('[Integrations] Failed to initialize Slack client:', error);
  }
}
