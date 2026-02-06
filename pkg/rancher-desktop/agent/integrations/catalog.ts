export interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  sort: number;
  beta: boolean;
  comingSoon: boolean;
  connected: boolean;
  version: string;
  lastUpdated: string;
  developer: string;
  formGuide?: string;
  installationGuide?: {
    title: string;
    description: string;
    steps: Array<{
      title: string;
      content: string;
    }>;
    importantNotes?: string[];
  };
  media?: Array<{
    type: 'youtube' | 'image';
    url: string;
    alt: string;
    caption?: string;
  }>;
  features?: Array<{
    title: string;
    description: string;
  }>;
  guideLinks?: Array<{
    title: string;
    description: string;
    url: string;
  }>;
  properties?: Array<{
    key: string;
    title: string;
    hint: string;
    type: 'text' | 'password' | 'url';
    required: boolean;
    placeholder: string;
    validation?: {
      pattern?: string;
      minLength?: number;
      maxLength?: number;
    };
  }>;
}

export const integrations: Record<string, Integration> = {

  slack: {
    id: 'slack',
    sort: 1,
    beta: true,
    comingSoon:false,
    name: 'Slack',
    description: 'Team collaboration platform that brings all your communication together. Enable SULLA to send notifications, share updates, and interact with team members through channels and direct messages.',
    category: 'Team Communication',
    icon: 'slack.svg',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2026-02-06 21:00:00',
    developer: 'Jonathon Byrdziak & Alan Carvalho',
    formGuide: 'Follow the installation guide below to create and configure your Slack app.',
    installationGuide: {
      title: 'Slack Bot Setup Guide',
      description: 'Create a custom Slack app for your personal workspace (5-7 minutes)',
      steps: [
        {
          title: 'Create Slack App',
          content: `1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name your app and select your workspace
4. Click "Create App"`
        },
        {
          title: 'Enable Socket Mode',
          content: `1. In the left menu, go to "Socket Mode"
2. Toggle "Enable Socket Mode" to ON
3. Click "Generate" to create a new App-Level Token
4. No special scopes needed for this token
5. Copy the generated token (starts with xapp-)
6. Save this token as your "Scopes Token" in Sulla`
        },
        {
          title: 'Configure Bot Permissions',
          content: `1. In the left menu, go to "OAuth & Permissions"
2. Scroll to "Bot Token Scopes"
3. Click "Add an OAuth Scope" and add:
   • chat:write
   • files:write
   • channels:read
   • groups:read
   • im:read
   • mpim:read
   • users:read
   • users:read.email
4. Click "Save Changes"`
        },
        {
          title: 'Install App to Workspace',
          content: `1. Scroll to top of "OAuth & Permissions" page
2. Click "Install to Workspace" (or "Reinstall" if updating)
3. Review permissions and click "Allow"
4. Copy the "Bot User OAuth Token" (starts with xoxb-)
5. Save this token as your "Bot Token" in Sulla`
        },
        {
          title: 'Invite Bot to Channel',
          content: `1. Go to any Slack channel where you want the bot to work
2. Type: /invite @YourBotName
3. Or click the channel name → "Integrations" → "Add apps"
4. Find and add your bot to the channel`
        }
      ],
      importantNotes: [
        'Keep both tokens secure - they provide full access to your workspace',
        'The bot can only see messages in channels where it\'s been invited',
        'Socket Mode is required for local development without public webhooks',
        'You must be a workspace admin to create custom apps'
      ]
    },
    guideLinks: [
      {
        title: 'Slack App Dashboard',
        description: 'Manage your Slack apps and configurations',
        url: 'https://api.slack.com/apps'
      },
      {
        title: 'Bot Token Documentation',
        description: 'Learn about Slack bot tokens and permissions',
        url: 'https://api.slack.com/authentication/basics'
      },
      {
        title: 'Socket Mode Guide',
        description: 'Understanding Socket Mode for local development',
        url: 'https://api.slack.com/apis/connections/socket'
      }
    ],
    media: [
      {
        type: 'youtube',
        url: 'EDATYbzYGiE',
        alt: 'Slack Platform Overview',
        caption: 'Watch how Slack transforms team communication and collaboration'
      },
      {
        type: 'image',
        url: 'slack-media-1.jpeg',
        alt: 'Slack Desktop Client',
        caption: 'Native Slack desktop application'
      },
      {
        type: 'image',
        url: 'slack-media-2.png',
        alt: 'Slack Integrations',
        caption: 'Slack integrations marketplace'
      }
    ],
    features: [
      {
        title: 'Channel Organization',
        description: 'Organize conversations by topic, project, or team with unlimited channels'
      },
      {
        title: 'Direct Messaging',
        description: 'One-on-one and group conversations with team members'
      },
      {
        title: 'File Sharing',
        description: 'Share documents, images, and integrate with cloud storage services'
      },
      {
        title: 'App Integrations',
        description: 'Connect thousands of apps for automated workflows and notifications'
      }
    ],
    properties: [
      {
        key: 'bot_token',
        title: 'Bot User OAuth Token',
        hint: '',
        type: 'password',
        required: true,
        placeholder: ''
      },
      {
        key: 'scopes_token',
        title: 'Scopes Token',
        hint: '',
        type: 'password',
        required: true,
        placeholder: ''
      }
    ]
  },

  messenger: {
    id: 'messenger',
    sort: 2,
    beta: false,
    comingSoon: true,
    name: 'Facebook Messenger',
    description: 'Automate your customer support and handle all conversations through Facebook\'s popular messaging platform. Keep track of customer interactions, provide instant responses, and manage your business communications seamlessly from one central hub.',
    category: 'Messaging',
    icon: 'messenger.avif',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2025-02-08 21:00:00',
    developer: 'Jonathon Byrdziak & Alan Carvalho',
    formGuide: 'Get your Page Access Token from Meta for Developers. Go to Apps > Messenger > Settings.',
    installationGuide: {
      title: 'Facebook Messenger Setup Guide',
      description: 'Configure Facebook Messenger Platform for customer communication (10-15 minutes)',
      steps: [
        {
          title: 'Create Facebook App',
          content: `1. Go to https://developers.facebook.com
2. Click "My Apps" then "Create App"
3. Choose "Business" app type
4. Enter your app name and contact email
5. Create your app and complete security verification`
        },
        {
          title: 'Add Messenger Product',
          content: `1. In your app dashboard, click "Add Product"
2. Find and click "Messenger" under "Products"
3. Click "Get Started" to add Messenger to your app
4. Review the Messenger Platform features
5. Click "Set Up" to configure Messenger settings`
        },
        {
          title: 'Configure Facebook Page',
          content: `1. Create a Facebook Page for your business if you don't have one
2. In Messenger settings, click "Add or Remove Pages"
3. Select your Facebook Page from the dropdown
4. Grant the necessary permissions for the page
5. Save your page selection`
        },
        {
          title: 'Set Up Webhook',
          content: `1. In Messenger settings, scroll to "Webhooks"
2. Click "Add Callback URL"
3. Enter your webhook URL (must use HTTPS)
4. Set a verify token (minimum 8 characters)
5. Subscribe to events: messages, messaging_postbacks, messaging_optins`
        },
        {
          title: 'Get Access Token',
          content: `1. In Messenger settings, find "Page Access Token"
2. Click "Generate Token" for your page
3. Copy the generated token (starts with "EA...")
4. Store the token securely - it provides full page access
5. Test the token with Graph API Explorer`
        },
        {
          title: 'Test Your Integration',
          content: `1. Go to your Facebook Page and send a message
2. Verify the webhook receives the message
3. Send a test message using the Send API
4. Check message delivery and response handling
5. Test rich messages and quick replies if needed`
        }
      ],
      importantNotes: [
        'Facebook Page must be published and accessible',
        'Webhook URLs must use HTTPS and be publicly accessible',
        'Page Access Tokens expire and may need refreshing',
        'Messenger has strict policies on spam and promotional content',
        'Users must initiate conversations - bots cannot message first'
      ]
    },
    features: [
      {
        title: 'Rich Messaging',
        description: 'Send interactive messages with buttons, quick replies, and carousels'
      },
      {
        title: 'Customer Support',
        description: 'Provide real-time customer service and automated responses'
      },
      {
        title: 'Broadcast Messages',
        description: 'Send updates and notifications to subscribed users'
      },
      {
        title: 'Chat Plugins',
        description: 'Integrate Messenger directly into your website'
      }
    ],
    guideLinks: [
      {
        title: 'Messenger Platform Documentation',
        description: 'Complete guide to Facebook Messenger Platform',
        url: 'https://developers.facebook.com/docs/messenger-platform'
      },
      {
        title: 'Quick Start Guide',
        description: 'Get started with Messenger in minutes',
        url: 'https://developers.facebook.com/docs/messenger-platform/getting-started'
      },
      {
        title: 'API Reference',
        description: 'Complete API documentation for Messenger Platform',
        url: 'https://developers.facebook.com/docs/messenger-platform/reference'
      }
    ],
    properties: [
      {
        key: 'page_access_token',
        title: 'Page Access Token',
        hint: 'Your Facebook Page access token from Meta for Developers',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^EA[A-Za-z0-9]{100,200}$',
          minLength: 102,
          maxLength: 202
        }
      },
      {
        key: 'page_id',
        title: 'Page ID',
        hint: 'Your Facebook Page ID',
        type: 'text',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^\\d{15,17}$',
          minLength: 15,
          maxLength: 17
        }
      },
      {
        key: 'webhook_verify_token',
        title: 'Webhook Verify Token',
        hint: 'Token for webhook verification (optional)',
        type: 'text',
        required: false,
        placeholder: 'your-verify-token',
        validation: {
          minLength: 8
        }
      },
      {
        key: 'app_secret',
        title: 'App Secret',
        hint: 'Your Facebook app secret for webhook security (optional)',
        type: 'password',
        required: false,
        placeholder: '',
        validation: {
          minLength: 32
        }
      }
    ]
  },

  whatsapp: {
    id: 'whatsapp',
    sort: 3,
    beta: false,
    comingSoon: true,
    name: 'WhatsApp Business',
    description: 'Reach your customers wherever they are and manage all your business conversations in one place. Send notifications, provide support, and keep track of customer interactions through the world\'s most popular messaging app.',
    category: 'Messaging',
    icon: 'whatsapp.avif',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2025-02-08 21:00:00',
    developer: 'Jonathon Byrdziak & Alan Carvalho',
    formGuide: 'Get your API Token and Phone Number ID from Meta Business Suite. Go to Settings > WhatsApp Business API.',
    installationGuide: {
      title: 'WhatsApp Business API Setup Guide',
      description: 'Configure WhatsApp Business API for customer communication (10-15 minutes)',
      steps: [
        {
          title: 'Create Meta Business Account',
          content: `1. Go to https://business.facebook.com
2. Create a Business Account if you don't have one
3. Verify your business details
4. Add your business phone number (must be able to receive SMS/calls)`
        },
        {
          title: 'Set Up WhatsApp Business API',
          content: `1. Go to Meta Business Suite > Settings > WhatsApp Business API
2. Click "Add Phone Number"
3. Select your verified business phone number
4. Choose your verification method (SMS or voice call)
5. Enter the verification code you receive`
        },
        {
          title: 'Configure Webhook',
          content: `1. In WhatsApp Business API settings, click "Configure Webhook"
2. Enter your webhook URL where messages will be received
3. Set a webhook verify token (minimum 8 characters)
4. Subscribe to message events: messages, message_reactions
5. Test the webhook configuration`
        },
        {
          title: 'Get API Credentials',
          content: `1. In WhatsApp Business API settings, find your Phone Number ID
2. Generate a new System User Access Token
3. Set appropriate permissions: whatsapp_business_messaging, whatsapp_business_management
4. Copy and securely store both the Phone Number ID and Access Token`
        },
        {
          title: 'Test Your Integration',
          content: `1. Send a test message to your WhatsApp number
2. Verify the webhook receives the message
3. Send a test API message using the Business API
4. Check message delivery status and responses`
        }
      ],
      importantNotes: [
        'WhatsApp Business API requires a verified Meta Business Account',
        'Phone numbers must be verified and cannot be VoIP numbers',
        'Message templates must be pre-approved for marketing messages',
        'Free tier includes 1000 customer conversations per month',
        'Webhook URLs must use HTTPS and be publicly accessible'
      ]
    },
    media: [],
    features: [
      {
        title: 'Business Messaging',
        description: 'Send and receive messages through official WhatsApp Business API'
      },
      {
        title: 'Message Templates',
        description: 'Use pre-approved templates for notifications and marketing'
      },
      {
        title: 'Interactive Messages',
        description: 'Create rich interactive experiences with buttons and quick replies'
      },
      {
        title: 'Analytics & Insights',
        description: 'Track message delivery, read rates, and customer engagement'
      }
    ],
    guideLinks: [
      {
        title: 'WhatsApp Business API',
        description: 'Official documentation for WhatsApp Business Platform',
        url: 'https://developers.facebook.com/docs/whatsapp'
      },
      {
        title: 'Getting Started Guide',
        description: 'Step-by-step guide to set up WhatsApp Business API',
        url: 'https://developers.facebook.com/docs/whatsapp/getting-started'
      },
      {
        title: 'Best Practices',
        description: 'Guidelines for effective WhatsApp communication',
        url: 'https://developers.facebook.com/docs/whatsapp/best-practices'
      }
    ],
    properties: [
      {
        key: 'phone_number_id',
        title: 'Phone Number ID',
        hint: 'Your WhatsApp Business phone number ID',
        type: 'text',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^\\d{15}$',
          minLength: 15,
          maxLength: 15
        }
      },
      {
        key: 'access_token',
        title: 'Access Token',
        hint: 'Your WhatsApp Business API access token',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^EAAJ[a-zA-Z0-9]{150,200}$',
          minLength: 153,
          maxLength: 203
        }
      },
      {
        key: 'webhook_verify_token',
        title: 'Webhook Verify Token',
        hint: 'Token for webhook verification (optional)',
        type: 'text',
        required: false,
        placeholder: 'your-verify-token',
        validation: {
          minLength: 8
        }
      }
    ]
  },

  telegram: {
    id: 'telegram',
    sort: 4,
    beta: false,
    comingSoon: true,
    name: 'Telegram',
    description: 'Engage your community and automate your messaging workflows with powerful bots. Handle customer inquiries, send notifications, and manage all your Telegram conversations efficiently from a single interface.',
    category: 'Messaging',
    icon: 'telegram.avif',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2025-02-08 21:00:00',
    developer: 'Jonathon Byrdziak & Alan Carvalho',
    formGuide: 'Create a bot with @BotFather on Telegram to get your Bot Token. Use @userinfobot to get your Chat ID.',
    installationGuide: {
      title: 'Telegram Bot Setup Guide',
      description: 'Create a Telegram bot for automated messaging (5-10 minutes)',
      steps: [
        {
          title: 'Create Your Bot with BotFather',
          content: `1. Open Telegram and search for @BotFather
2. Start a chat and send /newbot
3. Choose a name for your bot (e.g., "My Sulla Bot")
4. Choose a username (must end in "bot", e.g., "MySullaBot")
5. BotFather will send you your Bot Token - save it securely`
        },
        {
          title: 'Configure Bot Settings',
          content: `1. Send /mybots to BotFather to see your bots
2. Select your bot and choose "Bot Settings"
3. Set bot description and about text
4. Configure bot commands using /setcommands
5. Set bot profile picture if desired`
        },
        {
          title: 'Get Chat IDs',
          content: `1. Search for @userinfobot in Telegram
2. Send any message to get your Chat ID
3. For groups, add your bot to the group first
4. Send a message to the group, then check updates
5. Use /getupdates to find group Chat IDs`
        },
        {
          title: 'Set Up Webhook (Optional)',
          content: `1. Choose between webhook or polling mode
2. For webhook: Set a publicly accessible HTTPS URL
3. Use: https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WEBHOOK_URL>
4. For polling: No setup needed - bot will check for updates automatically
5. Test webhook with: https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
        },
        {
          title: 'Test Your Bot',
          content: `1. Send a message to your bot directly
2. Try adding bot to a group and sending messages
3. Test bot commands if configured
4. Verify bot receives all message types (text, photos, files)
5. Check bot responses and API calls work correctly`
        }
      ],
      importantNotes: [
        'Bot tokens give full control - keep them secret and secure',
        'Bots can only read messages sent directly to them or in groups they\'re added to',
        'Telegram bots have unlimited messaging on the free tier',
        'Bots cannot initiate conversations with users first',
        'Group admins must add bots to groups - bots cannot join automatically'
      ]
    },
    media: [],
    features: [
      {
        title: 'Bot Development',
        description: 'Create sophisticated bots with AI and automation capabilities'
      },
      {
        title: 'Group & Channel Management',
        description: 'Automate posting and moderation in groups and channels'
      },
      {
        title: 'File Sharing',
        description: 'Share documents, images, and media files up to 2GB'
      },
      {
        title: 'Inline Bots',
        description: 'Provide instant results within any chat using inline queries'
      }
    ],
    guideLinks: [
      {
        title: 'Telegram Bot API',
        description: 'Complete API documentation for bot development',
        url: 'https://core.telegram.org/bots/api'
      },
      {
        title: 'Bot Tutorial',
        description: 'Learn to create your first Telegram bot',
        url: 'https://core.telegram.org/bots/tutorial'
      },
      {
        title: 'Bot Examples',
        description: 'Sample bots and code examples to get started',
        url: 'https://core.telegram.org/bots/samples'
      }
    ],
    properties: [
      {
        key: 'bot_token',
        title: 'Bot Token',
        hint: 'Your Telegram bot token from @BotFather',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^\\d{10}:[a-zA-Z0-9_-]{35}$',
          minLength: 46,
          maxLength: 46
        }
      },
      {
        key: 'webhook_url',
        title: 'Webhook URL',
        hint: 'URL for receiving bot updates (optional)',
        type: 'url',
        required: false,
        placeholder: 'https://yourdomain.com/telegram-webhook'
      }
    ]
  },

  youtube: {
    id: 'youtube',
    sort: 5,
    beta: false,
    comingSoon: true,
    name: 'YouTube',
    description: 'Manage your YouTube content and grow your audience with automated workflows. Upload videos, track performance, engage with subscribers, and handle all your video publishing from one central dashboard.',
    category: 'Video Platform',
    icon: 'youtube.avif',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2025-02-08 21:00:00',
    developer: 'Jonathon Byrdziak & Alan Carvalho',
    formGuide: 'Get your API Key from Google Cloud Console. Go to APIs & Services > Credentials > Create Credentials > API Key.',
    installationGuide: {
      title: 'YouTube API Setup Guide',
      description: 'Configure YouTube API for channel management and video analytics (10-15 minutes)',
      steps: [
        {
          title: 'Create Google Cloud Project',
          content: `1. Go to https://console.cloud.google.com
2. Create a new project or select existing one
3. Give your project a descriptive name (e.g., "Sulla YouTube Integration")
4. Enable billing if required for your usage level
5. Note your Project ID for API configuration`
        },
        {
          title: 'Enable YouTube APIs',
          content: `1. In Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for and enable "YouTube Data API v3"
3. Also enable "YouTube Analytics API" if needed
4. Enable "YouTube Reporting API" for advanced analytics
5. Wait for APIs to be fully enabled (usually immediate)`
        },
        {
          title: 'Configure OAuth Consent Screen',
          content: `1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type
3. Fill in app information:
   - App name, user support email, developer contact
   - Application logo and homepage URL
   - Scopes for YouTube access
4. Add test users for development phase
5. Submit and wait for verification if needed`
        },
        {
          title: 'Create API Credentials',
          content: `1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "API Key"
3. Restrict API key to YouTube APIs only
4. Set application restrictions (IP addresses, referrers)
5. Copy and securely store the API key`
        },
        {
          title: 'Set Up OAuth 2.0 (Optional)',
          content: `1. Create OAuth 2.0 Client ID for user authentication
2. Choose "Web application" or "Desktop app" type
3. Add authorized redirect URIs for your application
4. Download JSON file with client credentials
5. Use OAuth flow for actions requiring user consent`
        },
        {
          title: 'Test Your Integration',
          content: `1. Test API key with simple requests (channel info, video search)
2. Test OAuth flow if user actions are needed
3. Verify rate limits are working properly
4. Test video upload if permissions allow
5. Monitor usage in Google Cloud Console`
        }
      ],
      importantNotes: [
        'YouTube API has daily quotas based on API endpoints used',
        'Free tier includes 10,000 units per day',
        'Video uploads require OAuth 2.0 user authentication',
        'API keys should be restricted to prevent unauthorized use',
        'Content must comply with YouTube Community Guidelines'
      ]
    },
    media: [
    ],
    features: [
      {
        title: 'Video Management',
        description: 'Upload, update, and manage videos across your channels'
      },
      {
        title: 'Channel Analytics',
        description: 'Track views, engagement, subscriber growth, and revenue'
      },
      {
        title: 'Comment Management',
        description: 'Moderate and respond to comments on your videos'
      },
      {
        title: 'Playlist Management',
        description: 'Create and organize video playlists for better content discovery'
      }
    ],
    guideLinks: [
      {
        title: 'YouTube Data API Documentation',
        description: 'Complete reference for YouTube Data API v3',
        url: 'https://developers.google.com/youtube/v3'
      },
      {
        title: 'YouTube Analytics API',
        description: 'Analytics and reporting API documentation',
        url: 'https://developers.google.com/youtube/analytics'
      },
      {
        title: 'Google Cloud Console',
        description: 'Manage API keys and quotas',
        url: 'https://console.cloud.google.com'
      }
    ],
    properties: [
      {
        key: 'api_key',
        title: 'API Key',
        hint: 'Your Google Cloud YouTube API key',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^AIza[0-9A-Za-z_-]{35}$',
          minLength: 39,
          maxLength: 39
        }
      },
      {
        key: 'client_id',
        title: 'OAuth Client ID',
        hint: 'OAuth 2.0 client ID for user authentication (optional)',
        type: 'text',
        required: false,
        placeholder: '',
        validation: {
          minLength: 20
        }
      },
      {
        key: 'client_secret',
        title: 'OAuth Client Secret',
        hint: 'OAuth 2.0 client secret (optional)',
        type: 'password',
        required: false,
        placeholder: '',
        validation: {
          minLength: 20
        }
      },
      {
        key: 'channel_id',
        title: 'Default Channel ID',
        hint: 'Your YouTube channel ID for quick access (optional)',
        type: 'text',
        required: false,
        placeholder: 'UC...',
        validation: {
          pattern: '^UC[a-zA-Z0-9_-]{22}$',
          minLength: 24,
          maxLength: 24
        }
      },
      {
        key: 'webhook_url',
        title: 'Webhook URL',
        hint: 'URL for receiving YouTube notifications (optional)',
        type: 'url',
        required: false,
        placeholder: 'https://yourdomain.com/youtube-webhook'
      }
    ]
  },

  teams: {
    id: 'teams',
    sort: 6,
    beta: false,
    comingSoon: true,
    name: 'Microsoft Teams',
    description: 'Collaborate with your team and automate your workflow in one powerful platform. Handle team conversations, share files, manage meetings, and keep all your project communication organized and accessible.',
    category: 'Collaboration',
    icon: 'teams.avif',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2025-02-08 21:00:00',
    developer: 'Jonathon Byrdziak & Alan Carvalho',
    formGuide: 'Register your app in Azure Active Directory. Get Client ID, Client Secret, and Tenant ID from Azure Portal.',
    installationGuide: {
      title: 'Microsoft Teams Setup Guide',
      description: 'Configure Microsoft Teams app for team collaboration and automation (15-20 minutes)',
      steps: [
        {
          title: 'Register Azure Application',
          content: `1. Go to https://portal.azure.com
2. Navigate to "Azure Active Directory" > "App registrations"
3. Click "New registration"
4. Enter app name (e.g., "Sulla Teams Bot")
5. Choose "Accounts in any organizational directory" and register`
        },
        {
          title: 'Configure API Permissions',
          content: `1. In your app registration, go to "API permissions"
2. Click "Add a permission" > "Microsoft Graph"
3. Add delegated permissions: Chat.ReadWrite, ChannelMessage.Send, Team.ReadBasic.All
4. Add application permissions if needed for background tasks
5. Click "Grant admin consent" for your organization`
        },
        {
          title: 'Create Client Secret',
          content: `1. Go to "Certificates & secrets" in your app registration
2. Click "New client secret"
3. Add description and choose expiration period
4. Copy the secret value immediately (it won't be visible again)
5. Store the secret securely in your environment`
        },
        {
          title: 'Configure Teams App',
          content: `1. Go to https://dev.teams.microsoft.com
2. Click "Apps" > "New app"
3. Choose "Bot" app type
4. Enter app details and upload app icon
5. Configure bot commands and messaging endpoints`
        },
        {
          title: 'Set Up Bot Framework',
          content: `1. In Teams app configuration, go to "Bot configuration"
2. Enter your bot endpoint URL (must use HTTPS)
3. Set up the Microsoft Bot Framework service
4. Configure your Azure Bot Channel registration
5. Test bot connectivity with Bot Framework Emulator`
        },
        {
          title: 'Get Required IDs',
          content: `1. From Azure app registration: copy Application (Client) ID
2. Copy Directory (Tenant) ID
3. From Azure portal: get your Bot Channel registration ID
4. Configure webhook URL for receiving Teams messages
5. Test integration by sending message to Teams channel`
        }
      ],
      importantNotes: [
        'Microsoft Teams requires Azure AD premium features for some capabilities',
        'App must be approved by Teams store for organization-wide deployment',
        'Bot endpoints must use HTTPS and be publicly accessible',
        'Teams has strict data retention and compliance requirements',
        'User consent required for personal Teams access'
      ]
    },
    media: [
    ],
    features: [
      {
        title: 'Team Chat',
        description: 'Participate in team channels and direct messages'
      },
      {
        title: 'File Sharing',
        description: 'Upload, download, and manage files in Teams channels'
      },
      {
        title: 'Meeting Integration',
        description: 'Join meetings, access recordings, and manage schedules'
      },
      {
        title: 'Workflow Automation',
        description: 'Automate routine tasks and notifications with Power Automate'
      }
    ],
    guideLinks: [
      {
        title: 'Teams Developer Portal',
        description: 'Create and manage Teams applications',
        url: 'https://dev.teams.microsoft.com'
      },
      {
        title: 'Microsoft Graph API',
        description: 'Complete API documentation for Teams integration',
        url: 'https://docs.microsoft.com/graph/api/overview'
      },
      {
        title: 'Bot Framework Documentation',
        description: 'Build bots for Teams and other Microsoft services',
        url: 'https://docs.microsoft.com/bot-framework'
      }
    ],
    properties: [
      {
        key: 'client_id',
        title: 'Client ID',
        hint: 'Your Azure AD application client ID',
        type: 'text',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^[a-zA-Z0-9-]{36}$',
          minLength: 36,
          maxLength: 36
        }
      },
      {
        key: 'client_secret',
        title: 'Client Secret',
        hint: 'Your Azure AD application client secret',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          minLength: 32
        }
      },
      {
        key: 'tenant_id',
        title: 'Tenant ID',
        hint: 'Your Azure AD directory tenant ID',
        type: 'text',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^[a-zA-Z0-9-]{36}$',
          minLength: 36,
          maxLength: 36
        }
      },
      {
        key: 'bot_id',
        title: 'Bot ID',
        hint: 'Your Microsoft Bot Framework bot ID',
        type: 'text',
        required: true,
        placeholder: '',
        validation: {
          minLength: 10
        }
      },
      {
        key: 'webhook_url',
        title: 'Webhook URL',
        hint: 'URL for receiving Teams messages and events',
        type: 'url',
        required: false,
        placeholder: 'https://yourdomain.com/teams-webhook'
      }
    ]
  },

  intercom: {
    id: 'intercom',
    sort: 7,
    beta: false,
    comingSoon: true,
    name: 'Intercom',
    description: 'Deliver exceptional customer service and manage all your support conversations in one place. Handle live chat, automate responses, track customer history, and provide personalized support at scale.',
    category: 'Customer Support',
    icon: 'intercom.svg',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2025-02-08 21:00:00',
    developer: 'Jonathon Byrdziak & Alan Carvalho',
    formGuide: 'Get your Access Token and App ID from your Intercom workspace settings. Go to Settings > Workspace > API Keys > Create new key.',
    media: [
      {
        type: 'youtube',
        url: 'qU1fbFKzf6w',
        alt: 'What is Intercom?',
        caption: 'Intercom Customer Service Suite'
      },
      {
        type: 'image',
        url: 'intercom-media-1.webp',
        alt: 'Intercom Media - 1'
      },
      {
        type: 'image',
        url: 'intercom-media-2.webp',
        alt: 'Intercom Media - 2'
      },
      {
        type: 'image',
        url: 'intercom-media-3.webp',
        alt: 'Intercom Media - 3'
      }
    ],
    features: [
      {
        title: 'Real-time Chat',
        description: 'Connect with customers instantly through live chat with typing indicators and read receipts'
      },
      {
        title: 'Automated Responses',
        description: 'Set up intelligent chatbots and automated workflows for common queries'
      },
      {
        title: 'Team Collaboration',
        description: 'Assign conversations, add internal notes, and collaborate seamlessly with your team'
      },
      {
        title: 'Customer Data Platform',
        description: 'Access complete customer profiles and interaction history in one place'
      }
    ],
    guideLinks: [
      {
        title: 'Getting Started Guide',
        description: 'Learn how to set up Intercom and start conversations with customers',
        url: 'https://developers.intercom.com'
      },
      {
        title: 'API Documentation',
        description: 'Complete API reference for developers and custom integrations',
        url: 'https://developers.intercom.com'
      },
      {
        title: 'Best Practices',
        description: 'Tips and strategies for effective customer communication',
        url: 'https://www.intercom.com'
      }
    ],
    properties: [
      {
        key: 'access_token',
        title: 'Access Token',
        hint: 'Your Intercom access token with proper permissions',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^dG9rOj[a-zA-Z0-9]{60}$',
          minLength: 64,
          maxLength: 64
        }
      },
      {
        key: 'app_id',
        title: 'App ID',
        hint: 'Your Intercom application ID',
        type: 'text',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^[a-zA-Z0-9]{12}$',
          minLength: 12,
          maxLength: 12
        }
      }
    ]
  },

  x: {
    id: 'x',
    sort: 8,
    beta: false,
    comingSoon: true,
    name: 'X (Twitter)',
    description: 'Grow your brand and engage with your audience through real-time conversations. Post updates, monitor trends, respond to mentions, and manage all your social media presence from one unified platform.',
    category: 'Social Media',
    icon: 'x.png',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2025-02-08 21:00:00',
    developer: 'Jonathon Byrdziak & Alan Carvalho',
    formGuide: 'Get your API Key, API Secret, Access Token, and Access Token Secret from X Developer Portal. Go to Projects & Apps > Your App > Keys and Tokens.',
    installationGuide: {
      title: 'X (Twitter) API Setup Guide',
      description: 'Configure X API for social media management and automation (10-15 minutes)',
      steps: [
        {
          title: 'Apply for X Developer Account',
          content: `1. Go to https://developer.twitter.com
2. Click "Sign up for Developer Account"
3. Complete the application with your use case details
4. Wait for approval (usually 1-3 business days)
5. Once approved, access your developer dashboard`
        },
        {
          title: 'Create New App',
          content: `1. In X Developer Portal, go to "Projects & Apps"
2. Create a new Project (give it a descriptive name)
3. Within the project, create a new App
4. Choose your app type (Bot, Automated, or Business)
5. Set app description and website URL`
        },
        {
          title: 'Configure App Permissions',
          content: `1. Go to your App settings > "App permissions"
2. Set appropriate access levels:
   - Read: Tweet timeline, user lookup, search
   - Write: Post tweets, manage likes/follows
   - Direct Messages: Read and send DMs (if needed)
3. Save changes and re-authenticate if required`
        },
        {
          title: 'Generate API Credentials',
          content: `1. In App settings, go to "Keys and Tokens"
2. Generate API Key and API Secret
3. Generate Access Token and Access Token Secret
4. Set callback URL for OAuth (if using web flow)
5. Copy all credentials securely - they won't be shown again`
        },
        {
          title: 'Set Up Webhook (Optional)',
          content: `1. Go to "Webhooks" in your app settings
2. Add your webhook URL (must use HTTPS)
3. Configure which events to receive:
   - Tweet creation events
   - Direct message events
   - User follow events
4. Test webhook with X's webhook testing tool`
        },
        {
          title: 'Test Your Integration',
          content: `1. Use API v2 endpoint to post a test tweet
2. Test timeline retrieval with your credentials
3. Verify rate limits are working properly
4. Test webhook events if configured
5. Monitor X developer dashboard for usage metrics`
        }
      ],
      importantNotes: [
        'X API has strict rate limits based on access level',
        'Free tier allows 500,000 tweet reads per month',
        'Write access requires additional approval for production use',
        'Webhook URLs must use HTTPS and be publicly accessible',
        'X content policies apply to automated posting'
      ]
    },
    media: [
      {
        type: 'youtube',
        url: 'q4yV2t3Ii7E',
        alt: 'X API Overview',
        caption: 'Getting Started with X API v2'
      },
      {
        type: 'image',
        url: 'x-media-1.jpg',
        alt: 'X Interface',
        caption: 'X (Twitter) desktop and mobile interface'
      },
      {
        type: 'image',
        url: 'x-media-2.png',
        alt: 'Analytics Dashboard',
        caption: 'Tweet analytics and engagement metrics'
      },
      {
        type: 'image',
        url: 'x-media-3.webp',
        alt: 'Developer Portal',
        caption: 'X Developer Portal dashboard'
      }
    ],
    features: [
      {
        title: 'Tweet Management',
        description: 'Post, delete, and manage tweets with media attachments'
      },
      {
        title: 'Timeline Monitoring',
        description: 'Track mentions, hashtags, and trending topics in real-time'
      },
      {
        title: 'User Analytics',
        description: 'Analyze follower growth, engagement rates, and tweet performance'
      },
      {
        title: 'Direct Messages',
        description: 'Send and receive DMs for customer support and engagement'
      }
    ],
    guideLinks: [
      {
        title: 'X Developer Portal',
        description: 'Create and manage X applications and API credentials',
        url: 'https://developer.twitter.com'
      },
      {
        title: 'API v2 Documentation',
        description: 'Complete reference for X API v2 endpoints',
        url: 'https://developer.twitter.com/en/docs/twitter-api'
      },
      {
        title: 'Rate Limits Guide',
        description: 'Understanding X API rate limits and usage tiers',
        url: 'https://developer.twitter.com/en/docs/twitter-api/rate-limits'
      }
    ],
    properties: [
      {
        key: 'api_key',
        title: 'API Key',
        hint: 'Your X application API Key',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          minLength: 20
        }
      },
      {
        key: 'api_secret',
        title: 'API Secret',
        hint: 'Your X application API Secret',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          minLength: 40
        }
      },
      {
        key: 'access_token',
        title: 'Access Token',
        hint: 'Your X account Access Token',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          minLength: 40
        }
      },
      {
        key: 'access_token_secret',
        title: 'Access Token Secret',
        hint: 'Your X account Access Token Secret',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          minLength: 40
        }
      },
      {
        key: 'bearer_token',
        title: 'Bearer Token',
        hint: 'App-only Bearer Token for read-only access (optional)',
        type: 'password',
        required: false,
        placeholder: '',
        validation: {
          minLength: 100
        }
      },
      {
        key: 'webhook_url',
        title: 'Webhook URL',
        hint: 'URL for receiving real-time X events (optional)',
        type: 'url',
        required: false,
        placeholder: 'https://yourdomain.com/x-webhook'
      }
    ]
  },

  instagram: {
    id: 'instagram',
    sort: 9,
    beta: false,
    comingSoon: true,
    name: 'Instagram',
    description: 'Showcase your visual content and engage with your followers effortlessly. Schedule posts, manage your business profile, track engagement, and handle all your visual marketing from one beautiful interface.',
    category: 'Social Media',
    icon: 'instagram.avif',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2025-02-08 21:00:00',
    developer: 'Jonathon Byrdziak & Alan Carvalho',
    formGuide: 'Get your App ID, App Secret, and Access Token from Facebook Developers. Go to Apps > Your App > Instagram Basic Display.',
    installationGuide: {
      title: 'Instagram API Setup Guide',
      description: 'Configure Instagram API for content management and business analytics (15-20 minutes)',
      steps: [
        {
          title: 'Create Facebook App',
          content: `1. Go to https://developers.facebook.com
2. Click "My Apps" then "Create App"
3. Choose "Business" app type
4. Enter your app name and contact email
5. Create your app and complete security verification`
        },
        {
          title: 'Add Instagram Product',
          content: `1. In your app dashboard, click "Add Product"
2. Select "Instagram Basic Display"
3. Configure Instagram permissions:
   - instagram_basic - Read user profile
   - instagram_content_publish - Post content
   - instagram_manage_comments - Manage comments
4. Save your app settings`
        },
        {
          title: 'Configure OAuth Settings',
          content: `1. Go to "Instagram Basic Display" > "Settings"
2. Add your redirect URI for OAuth flow
3. Set valid OAuth redirect URIs for desktop app
4. Configure app domains if needed
5. Enable "App Mode" for development testing`
        },
        {
          title: 'Get Instagram Business Account',
          content: `1. Convert your Instagram to a business/creator account
2. Link your Instagram account to Facebook Page
3. Verify business account in Instagram settings
4. Set up Instagram Shopping if selling products
5. Configure business contact information`
        },
        {
          title: 'Generate Access Tokens',
          content: `1. Use OAuth 2.0 flow to get user access token
2. Generate long-lived access token (60 days)
3. For business features, use Instagram Graph API
4. Test token with Graph API Explorer
5. Store tokens securely in your application`
        },
        {
          title: 'Test Your Integration',
          content: `1. Test Basic Display API: get user profile, media
2. Test Graph API: business insights, analytics
3. Test content publishing with test posts
4. Test comment management and engagement
5. Monitor API usage in Facebook Developer Dashboard`
        }
      ],
      importantNotes: [
        'Instagram Basic Display API has rate limits of 200 requests per hour',
        'Instagram Graph API requires business/creator account',
        'Content publishing requires Instagram Business account',
        'Access tokens expire and need refresh mechanism',
        'Webhooks require HTTPS endpoints for real-time updates'
      ]
    },
    media: [],
    features: [
      {
        title: 'Content Publishing',
        description: 'Post photos, videos, stories, and reels to Instagram'
      },
      {
        title: 'Media Management',
        description: 'Upload, organize, and manage Instagram media content'
      },
      {
        title: 'Business Analytics',
        description: 'Track engagement, reach, impressions, and follower growth'
      },
      {
        title: 'Comment Management',
        description: 'Moderate and respond to comments on your posts'
      }
    ],
    guideLinks: [
      {
        title: 'Instagram Basic Display API',
        description: 'Complete reference for Instagram Basic Display API',
        url: 'https://developers.facebook.com/docs/instagram-basic-display-api'
      },
      {
        title: 'Instagram Graph API',
        description: 'Business and creator API documentation',
        url: 'https://developers.facebook.com/docs/instagram-api'
      },
      {
        title: 'Facebook Developers',
        description: 'Manage apps and API credentials',
        url: 'https://developers.facebook.com'
      }
    ],
    properties: [
      {
        key: 'app_id',
        title: 'App ID',
        hint: 'Your Facebook/Instagram application ID',
        type: 'text',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^[0-9]{15,17}$',
          minLength: 15,
          maxLength: 17
        }
      },
      {
        key: 'app_secret',
        title: 'App Secret',
        hint: 'Your Facebook/Instagram application secret',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          minLength: 32
        }
      },
      {
        key: 'access_token',
        title: 'Access Token',
        hint: 'Instagram long-lived access token',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^EAA[0-9A-Za-z_-]+$',
          minLength: 50
        }
      },
      {
        key: 'business_account_id',
        title: 'Business Account ID',
        hint: 'Instagram business account ID (optional)',
        type: 'text',
        required: false,
        placeholder: '',
        validation: {
          pattern: '^[0-9]+$',
          minLength: 10
        }
      },
      {
        key: 'redirect_uri',
        title: 'Redirect URI',
        hint: 'OAuth 2.0 redirect URI for desktop app authentication',
        type: 'text',
        required: true,
        placeholder: 'http://localhost:3000/callback',
        validation: {
          pattern: '^https?://localhost:[0-9]+/.+|^urn:ietf:wg:oauth:2.0:oob$',
          minLength: 10
        }
      }
    ]
  },

  tiktok: {
    id: 'tiktok',
    sort: 10,
    beta: false,
    comingSoon: true,
    name: 'TikTok',
    description: 'Create viral content and grow your audience with automated workflows. Manage your TikTok presence, track performance, engage with trends, and handle all your short-form video marketing efficiently.',
    category: 'Social Media',
    icon: 'tiktok.avif',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2025-02-08 21:00:00',
    developer: 'Jonathon Byrdziak & Alan Carvalho',
    formGuide: 'Get your App ID, App Secret, and Access Token from TikTok Developer Portal. Go to Apps > Your App > Manage Keys.',
    installationGuide: {
      title: 'TikTok for Business API Setup Guide',
      description: 'Configure TikTok API for content management and analytics (15-20 minutes)',
      steps: [
        {
          title: 'Apply for TikTok Developer Access',
          content: `1. Go to https://developers.tiktok.com
2. Click "Apply for developer access"
3. Select your use case (Business, Creator, or Research)
4. Provide company details and intended API usage
5. Wait for approval (typically 3-5 business days)`
        },
        {
          title: 'Create TikTok App',
          content: `1. Once approved, access your developer dashboard
2. Click "Create App" and choose "Business" app type
3. Enter app name, description, and category
4. Set your company website and privacy policy URLs
5. Submit app for review and approval`
        },
        {
          title: 'Configure App Permissions',
          content: `1. In app settings, go to "API permissions"
2. Request necessary scopes:
   - user.info.basic: Read user profile information
   - video.list: Read user video content
   - user.info.profile: Manage user profile
   - video.publish: Post videos on behalf of user
3. Submit permissions for approval`
        },
        {
          title: 'Generate API Credentials',
          content: `1. Go to "Keys and Access Tokens" in your app
2. Generate App ID and App Secret
3. Create Access Token with required scopes
4. Set up callback URL for OAuth 2.0 flow
5. Copy all credentials securely for implementation`
        },
        {
          title: 'Set Up Webhooks (Optional)',
          content: `1. In app settings, configure webhook endpoints
2. Set webhook URL for real-time events:
   - Video publish events
   - User interaction events
   - Comment notifications
3. Verify webhook ownership with TikTok
4. Test webhook delivery and event handling`
        },
        {
          title: 'Test Your Integration',
          content: `1. Use OAuth 2.0 to authenticate test user
2. Test basic API calls: user info, video list
3. Test video upload if permissions allow
4. Verify analytics data retrieval
5. Monitor rate limits and usage in developer dashboard`
        }
      ],
      importantNotes: [
        'TikTok API access requires business verification',
        'Content posting requires additional content review approval',
        'Rate limits are stricter than other social platforms',
        'All content must comply with TikTok Community Guidelines',
        'Webhook URLs must use HTTPS and be publicly accessible'
      ]
    },
    media: [
    ],
    features: [
      {
        title: 'Video Management',
        description: 'Upload, schedule, and manage video content across accounts'
      },
      {
        title: 'Analytics & Insights',
        description: 'Track video performance, engagement metrics, and audience demographics'
      },
      {
        title: 'Trend Discovery',
        description: 'Monitor trending hashtags, sounds, and content patterns'
      },
      {
        title: 'Comment Management',
        description: 'Moderate and respond to comments across your videos'
      }
    ],
    guideLinks: [
      {
        title: 'TikTok Developer Portal',
        description: 'Create and manage TikTok applications',
        url: 'https://developers.tiktok.com'
      },
      {
        title: 'API Documentation',
        description: 'Complete reference for TikTok for Business API',
        url: 'https://developers.tiktok.com/doc'
      },
      {
        title: 'Business Center',
        description: 'TikTok Business tools and marketing solutions',
        url: 'https://www.tiktok.com/business'
      }
    ],
    properties: [
      {
        key: 'app_id',
        title: 'App ID',
        hint: 'Your TikTok application ID',
        type: 'text',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^\\d{10,15}$',
          minLength: 10,
          maxLength: 15
        }
      },
      {
        key: 'app_secret',
        title: 'App Secret',
        hint: 'Your TikTok application secret key',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          minLength: 32
        }
      },
      {
        key: 'access_token',
        title: 'Access Token',
        hint: 'OAuth 2.0 access token for API requests',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          minLength: 50
        }
      },
      {
        key: 'refresh_token',
        title: 'Refresh Token',
        hint: 'Token for refreshing access tokens (optional)',
        type: 'password',
        required: false,
        placeholder: '',
        validation: {
          minLength: 50
        }
      },
      {
        key: 'webhook_url',
        title: 'Webhook URL',
        hint: 'URL for receiving TikTok events (optional)',
        type: 'url',
        required: false,
        placeholder: 'https://yourdomain.com/tiktok-webhook'
      },
      {
        key: 'redirect_uri',
        title: 'Redirect URI',
        hint: 'OAuth 2.0 redirect URI for desktop app authentication',
        type: 'text',
        required: true,
        placeholder: 'http://localhost:3000/callback',
        validation: {
          pattern: '^https?://localhost:[0-9]+/.+|^urn:ietf:wg:oauth:2.0:oob$',
          minLength: 10
        }
      }
    ]
  },

  linkedin: {
    id: 'linkedin',
    sort: 11,
    beta: false,
    comingSoon: true,
    name: 'LinkedIn',
    description: 'Build your professional network and grow your business connections effortlessly. Share business content, engage with industry leaders, manage your professional presence, and handle all your career networking from one platform.',
    category: 'Professional Network',
    icon: 'linkedin.svg',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2025-02-08 21:00:00',
    developer: 'Jonathon Byrdziak & Alan Carvalho',
    formGuide: 'Create a LinkedIn app at developer.linkedin.com. Get your API credentials from the application dashboard.',
    media: [],
    features: [
      {
        title: 'Professional Networking',
        description: 'Build and maintain professional connections with industry leaders'
      },
      {
        title: 'Content Sharing',
        description: 'Share business insights and professional content with your network'
      },
      {
        title: 'Lead Generation',
        description: 'Generate business leads through professional networking and outreach'
      },
      {
        title: 'Company Pages',
        description: 'Manage company presence and share business updates'
      }
    ],
    guideLinks: [
      {
        title: 'LinkedIn API Documentation',
        description: 'Complete API reference for LinkedIn integration',
        url: 'https://docs.microsoft.com/en-us/linkedin/'
      },
      {
        title: 'Business Development Guide',
        description: 'Best practices for professional networking on LinkedIn',
        url: 'https://business.linkedin.com/'
      },
      {
        title: 'Marketing Solutions',
        description: 'LinkedIn marketing and advertising solutions',
        url: 'https://business.linkedin.com/marketing-solutions/'
      }
    ],
    properties: [
    ]
  },

  discord: {
    id: 'discord',
    sort: 100,
    beta: false,
    comingSoon: true,
    name: 'Discord',
    description: 'Build and manage your community with powerful communication tools. Handle server conversations, automate community management, engage with members, and keep all your community interactions organized in one place.',
    category: 'Community',
    icon: 'discord.svg',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2025-02-08 21:00:00',
    developer: 'Jonathon Byrdziak & Alan Carvalho',
    formGuide: 'Create a Discord application at discord.com/developers/applications. Get your Bot Token from Bot page.',
    installationGuide: {
      title: 'Discord Bot Setup Guide',
      description: 'Create a Discord bot for your server (5-10 minutes)',
      steps: [
        {
          title: 'Create Discord Application',
          content: `1. Go to https://discord.com/developers/applications
2. Click "New Application" 
3. Select "Bot" 
4. Name your bot and agree to terms
5. Click "Create"`
        },
        {
          title: 'Create Bot Token',
          content: `1. In your application dashboard, go to "Bot" section
2. Click "Add Bot" 
3. Copy the Bot Token (starts with your bot prefix)
4. Save this token securely - it gives full access to your bot`
        },
        {
          title: 'Invite Bot to Server',
          content: `1. Generate an OAuth2 invite link:
   https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot
2. Replace YOUR_CLIENT_ID with your actual Client ID
3. Send this link to server members or post it in a welcome channel
4. Users can click the link to add your bot to their server`
        },
        {
          title: 'Configure Bot Permissions',
          content: `1. In Discord Developer Portal, go to your bot
2. Click "OAuth2" -> "URL Generator"
3. Set the redirect URL to your server callback
4. Select required permissions:
   • Send Messages
   • Read Messages/View Channels
   • Embed Links
   • Add Reactions
5. Save the changes`
        },
        {
          title: 'Test Your Bot',
          content: `1. Invite your bot to a test server
2. Send a test message like "!help" or "!ping"
3. Verify the bot responds correctly
4. Check that all slash commands work as expected`
        }
      ],
      importantNotes: [
        'Keep your Bot Token secure - anyone with the token can control your bot',
        'Use HTTPS for redirect URLs in production',
        'Regularly rotate your Bot Token for security',
        'Test bot permissions in a private server before deploying',
        'Discord bots must follow Discord Terms of Service'
      ]
    },
    media: [
      {
        type: 'youtube',
        url: 'TJ13BA3-NR4',
        alt: 'Discord Overview',
        caption: 'How Discord Works in 148,000 Miliseconds or Less'
      },
      {
        type: 'image',
        url: 'discord-media-1.jpg',
        alt: 'Destop Interface',
        caption: 'Discord interface of desktop app'
      },
      {
        type: 'image',
        url: 'discord-media-2.webp',
        alt: 'Desktop and Mobile',
        caption: 'Discord available on desktop and mobile'
      },
      {
        type: 'image',
        url: 'discord-media-3.webp',
        alt: 'Features',
        caption: 'Voice channels, video calls, and rich presence'
      }
    ],
    features: [
      {
        title: 'Server Management',
        description: 'Automate server moderation and member management'
      },
      {
        title: 'Voice & Video',
        description: 'Integrate with voice channels for audio communication'
      },
      {
        title: 'Rich Embeds',
        description: 'Create beautiful message embeds with images and interactions'
      },
      {
        title: 'Slash Commands',
        description: 'Implement custom commands for server functionality'
      }
    ],
    guideLinks: [
      {
        title: 'Discord Developer Portal',
        description: 'Create and manage Discord applications and bots',
        url: 'https://discord.com/developers/applications'
      },
      {
        title: 'Bot Documentation',
        description: 'Complete guide for Discord bot development',
        url: 'https://discord.com/developers/docs/intro'
      },
      {
        title: 'Community Guidelines',
        description: 'Best practices for Discord community management',
        url: 'https://discord.com/guidelines'
      }
    ],
    properties: [
      {
        key: 'bot_token',
        title: 'Bot Token',
        hint: 'Your Discord bot token',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^[a-zA-Z0-9_\\-\\.]{24}\\.[a-zA-Z0-9_\\-\\.]{6}\\.[a-zA-Z0-9_\\-\\.]{27}$',
          minLength: 59,
          maxLength: 59
        }
      }
    ]
  },

  gmail: {
    id: 'gmail',
    sort: 12,
    beta: false,
    comingSoon: true,
    name: 'Gmail',
    description: 'Manage all your email communication and never miss an important message. Send emails, search your inbox, organize conversations, and automate your email workflows for maximum productivity.',
    category: 'Productivity',
    icon: 'gmail.avif',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2025-02-08 21:00:00',
    developer: 'Jonathon Byrdziak & Alan Carvalho',
    formGuide: 'Get your API credentials from Google Cloud Console. Go to APIs & Services > Credentials > Create Credentials > OAuth 2.0 Client ID.',
    installationGuide: {
      title: 'Gmail API Setup Guide',
      description: 'Configure Gmail API for email management and automation (10-15 minutes)',
      steps: [
        {
          title: 'Create Google Cloud Project',
          content: `1. Go to https://console.cloud.google.com
2. Create a new project or select existing one
3. Name your project (e.g., "Sulla Gmail Integration")
4. Enable billing if required for your usage level
5. Note your Project ID for API configuration`
        },
        {
          title: 'Enable Gmail API',
          content: `1. In Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for and enable "Gmail API"
3. Review quota limits and pricing for your usage
4. Wait for API to be fully enabled (usually immediate)
5. Consider enabling "Google Workspace APIs" if needed`
        },
        {
          title: 'Configure OAuth Consent Screen',
          content: `1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type
3. Fill in application information:
   - App name, user support email, developer contact
   - Application logo and homepage URL
   - Scopes for Gmail access
4. Add test users for development phase
5. Submit and wait for verification if needed`
        },
        {
          title: 'Create OAuth Credentials',
          content: `1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Choose "Web application" type
4. Add authorized redirect URIs for your application
5. Download JSON file with client credentials`
        },
        {
          title: 'Set Up Service Account (Optional)',
          content: `1. For server-to-server communication, create a service account
2. Go to "IAM & Admin" > "Service Accounts"
3. Create service account with appropriate permissions
4. Download JSON key file for authentication
5. Enable domain-wide delegation if accessing user data`
        },
        {
          title: 'Test Your Integration',
          content: `1. Test OAuth flow with test user account
2. Test basic API calls: list messages, send email
3. Verify email sending with proper formatting
4. Test search functionality with filters
5. Monitor usage in Google Cloud Console`
        }
      ],
      importantNotes: [
        'Gmail API has daily quotas based on user and project limits',
        'Free tier includes 1 billion quota units per day',
        'Email sending requires DKIM/SPF configuration for deliverability',
        'OAuth tokens expire and need refresh mechanism',
        'Sensitive scopes require security review for production use'
      ]
    },
    media: [
      {
        type: 'youtube',
        url: 'h4J2q9Y2cL4',
        alt: 'Gmail API Overview',
        caption: 'Getting Started with Gmail API'
      },
      {
        type: 'image',
        url: 'gmail-media-1.jpg',
        alt: 'Gmail Interface',
        caption: 'Gmail web and mobile interface'
      },
      {
        type: 'image',
        url: 'gmail-media-2.png',
        alt: 'Email Management',
        caption: 'Advanced email organization and search features'
      },
      {
        type: 'image',
        url: 'gmail-media-3.webp',
        alt: 'API Integration',
        caption: 'Gmail API integration dashboard'
      }
    ],
    features: [
      {
        title: 'Email Sending',
        description: 'Send emails with rich formatting, attachments, and scheduling'
      },
      {
        title: 'Inbox Management',
        description: 'Read, search, filter, and organize email messages'
      },
      {
        title: 'Thread Management',
        description: 'Handle email conversations and thread tracking'
      },
      {
        title: 'Label & Filter Automation',
        description: 'Automatically label, categorize, and filter incoming emails'
      }
    ],
    guideLinks: [
      {
        title: 'Gmail API Documentation',
        description: 'Complete reference for Gmail API',
        url: 'https://developers.google.com/gmail/api'
      },
      {
        title: 'Google Cloud Console',
        description: 'Manage API credentials and quotas',
        url: 'https://console.cloud.google.com'
      },
      {
        title: 'OAuth 2.0 Setup',
        description: 'Google OAuth 2.0 implementation guide',
        url: 'https://developers.google.com/identity/protocols/oauth2'
      }
    ],
    properties: [
      {
        key: 'client_id',
        title: 'OAuth Client ID',
        hint: 'Your Google Cloud OAuth client ID',
        type: 'text',
        required: true,
        placeholder: '',
        validation: {
          minLength: 20
        }
      },
      {
        key: 'client_secret',
        title: 'OAuth Client Secret',
        hint: 'Your Google Cloud OAuth client secret',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          minLength: 20
        }
      },
      {
        key: 'service_account_key',
        title: 'Service Account Key',
        hint: 'JSON key file for service account authentication (optional)',
        type: 'password',
        required: false,
        placeholder: '',
        validation: {
          minLength: 100
        }
      },
      {
        key: 'redirect_uri',
        title: 'Redirect URI',
        hint: 'OAuth 2.0 redirect URI for desktop app authentication',
        type: 'text',
        required: true,
        placeholder: 'http://localhost:3000/callback',
        validation: {
          pattern: '^https?://localhost:[0-9]+/.+|^urn:ietf:wg:oauth:2.0:oob$',
          minLength: 10
        }
      }
    ]
  },

  google_calendar: {
    id: 'google_calendar',
    sort: 13,
    beta: false,
    comingSoon: true,
    name: 'Google Calendar',
    description: 'Organize your schedule and never miss an important meeting. Manage your calendar, schedule events, set reminders, and keep track of all your appointments in one unified system.',
    category: 'Productivity',
    icon: 'google_calendar.avif',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2025-02-08 21:00:00',
    developer: 'Jonathon Byrdziak & Alan Carvalho',
    formGuide: 'Get your API credentials from Google Cloud Console. Go to APIs & Services > Credentials > Create Credentials > OAuth 2.0 Client ID.',
    installationGuide: {
      title: 'Google Calendar API Setup Guide',
      description: 'Configure Google Calendar API for schedule management and automation (10-15 minutes)',
      steps: [
        {
          title: 'Create Google Cloud Project',
          content: `1. Go to https://console.cloud.google.com
2. Create a new project or select existing one
3. Name your project (e.g., "Sulla Calendar Integration")
4. Enable billing if required for your usage level
5. Note your Project ID for API configuration`
        },
        {
          title: 'Enable Calendar APIs',
          content: `1. In Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for and enable "Google Calendar API"
3. Also enable "Calendar Settings API" if needed
4. Review quota limits and pricing for your usage
5. Wait for APIs to be fully enabled (usually immediate)`
        },
        {
          title: 'Configure OAuth Consent Screen',
          content: `1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type
3. Fill in application information:
   - App name, user support email, developer contact
   - Application logo and homepage URL
   - Scopes for Calendar access
4. Add test users for development phase
5. Submit and wait for verification if needed`
        },
        {
          title: 'Create OAuth Credentials',
          content: `1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Choose "Web application" type
4. Add authorized redirect URIs for your application
5. Download JSON file with client credentials`
        },
        {
          title: 'Set Up Calendar Sharing',
          content: `1. Configure calendar access permissions
2. Test with a shared calendar for development
3. Set up calendar webhooks for real-time updates
4. Configure timezone and event reminder settings
5. Test event creation and modification`
        },
        {
          title: 'Test Your Integration',
          content: `1. Test OAuth flow with test user account
2. Test basic API calls: list events, create event
3. Test recurring events and event updates
4. Test calendar sharing and permissions
5. Monitor usage in Google Cloud Console`
        }
      ],
      importantNotes: [
        'Google Calendar API has daily quotas based on requests per user',
        'Free tier includes 1 million requests per day per project',
        'Calendar sharing requires proper permission management',
        'Event notifications require webhook setup for real-time updates',
        'Timezone handling is critical for accurate scheduling'
      ]
    },
    media: [
    ],
    features: [
      {
        title: 'Event Management',
        description: 'Create, update, and delete calendar events with attendees'
      },
      {
        title: 'Calendar Sharing',
        description: 'Share calendars and manage access permissions'
      },
      {
        title: 'Recurring Events',
        description: 'Set up and manage recurring meetings and appointments'
      },
      {
        title: 'Real-time Sync',
        description: 'Receive instant updates when calendars change'
      }
    ],
    guideLinks: [
      {
        title: 'Google Calendar API Documentation',
        description: 'Complete reference for Google Calendar API',
        url: 'https://developers.google.com/calendar/api'
      },
      {
        title: 'Google Cloud Console',
        description: 'Manage API credentials and quotas',
        url: 'https://console.cloud.google.com'
      },
      {
        title: 'Calendar Integration Guide',
        description: 'Best practices for calendar integrations',
        url: 'https://developers.google.com/calendar/overview'
      }
    ],
    properties: [
      {
        key: 'client_id',
        title: 'OAuth Client ID',
        hint: 'Your Google Cloud OAuth client ID',
        type: 'text',
        required: true,
        placeholder: '',
        validation: {
          minLength: 20
        }
      },
      {
        key: 'client_secret',
        title: 'OAuth Client Secret',
        hint: 'Your Google Cloud OAuth client secret',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          minLength: 20
        }
      },
      {
        key: 'calendar_id',
        title: 'Default Calendar ID',
        hint: 'Primary calendar ID for quick access (optional)',
        type: 'text',
        required: false,
        placeholder: 'primary',
        validation: {
          minLength: 5
        }
      },
      {
        key: 'webhook_url',
        title: 'Webhook URL',
        hint: 'URL for receiving calendar notifications (optional)',
        type: 'url',
        required: false,
        placeholder: 'https://yourdomain.com/calendar-webhook'
      },
      {
        key: 'redirect_uri',
        title: 'Redirect URI',
        hint: 'OAuth 2.0 redirect URI for desktop app authentication',
        type: 'text',
        required: true,
        placeholder: 'http://localhost:3000/callback',
        validation: {
          pattern: '^https?://localhost:[0-9]+/.+|^urn:ietf:wg:oauth:2.0:oob$',
          minLength: 10
        }
      }
    ]
  },

  google_docs: {
    id: 'google_docs',
    sort: 14,
    beta: false,
    comingSoon: true,
    name: 'Google Docs',
    description: 'Create and edit documents seamlessly with your team in real-time. Write, collaborate, format content, and manage all your document workflows from one collaborative workspace.',
    category: 'Productivity',
    icon: 'google_docs.avif',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2025-02-08 21:00:00',
    developer: 'Jonathon Byrdziak & Alan Carvalho',
    formGuide: 'Get your API credentials from Google Cloud Console. Go to APIs & Services > Credentials > Create Credentials > OAuth 2.0 Client ID.',
    installationGuide: {
      title: 'Google Docs API Setup Guide',
      description: 'Configure Google Docs API for document management and collaboration (10-15 minutes)',
      steps: [
        {
          title: 'Create Google Cloud Project',
          content: `1. Go to https://console.cloud.google.com
2. Create a new project or select existing one
3. Name your project (e.g., "Sulla Docs Integration")
4. Enable billing if required for your usage level
5. Note your Project ID for API configuration`
        },
        {
          title: 'Enable Docs APIs',
          content: `1. In Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for and enable "Google Docs API"
3. Also enable "Google Drive API" for file management
4. Review quota limits and pricing for your usage
5. Wait for APIs to be fully enabled (usually immediate)`
        },
        {
          title: 'Configure OAuth Consent Screen',
          content: `1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type
3. Fill in application information:
   - App name, user support email, developer contact
   - Application logo and homepage URL
   - Scopes for Docs and Drive access
4. Add test users for development phase
5. Submit and wait for verification if needed`
        },
        {
          title: 'Create OAuth Credentials',
          content: `1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Choose "Web application" type
4. Add authorized redirect URIs for your application
5. Download JSON file with client credentials`
        },
        {
          title: 'Set Up Document Templates',
          content: `1. Create document templates for common use cases
2. Configure formatting styles and branding
3. Set up collaboration permissions
4. Test document creation from templates
5. Configure export options (PDF, Word, etc.)`
        },
        {
          title: 'Test Your Integration',
          content: `1. Test OAuth flow with test user account
2. Test basic API calls: list documents, create document
3. Test document editing and formatting
4. Test real-time collaboration features
5. Monitor usage in Google Cloud Console`
        }
      ],
      importantNotes: [
        'Google Docs API has daily quotas based on requests per user',
        'Free tier includes 1 million requests per day per project',
        'Document editing requires proper permission handling',
        'Real-time collaboration uses WebSocket connections',
        'Export functionality may have additional processing time'
      ]
    },
    media: [
    ],
    features: [
      {
        title: 'Document Creation',
        description: 'Create new documents with templates and formatting'
      },
      {
        title: 'Rich Text Editing',
        description: 'Edit documents with advanced formatting and styling'
      },
      {
        title: 'Real-time Collaboration',
        description: 'Work together on documents with live updates'
      },
      {
        title: 'Export & Sharing',
        description: 'Export documents to multiple formats and manage sharing'
      }
    ],
    guideLinks: [
      {
        title: 'Google Docs API Documentation',
        description: 'Complete reference for Google Docs API',
        url: 'https://developers.google.com/docs/api'
      },
      {
        title: 'Google Drive API',
        description: 'File management and storage API',
        url: 'https://developers.google.com/drive/api'
      },
      {
        title: 'Google Cloud Console',
        description: 'Manage API credentials and quotas',
        url: 'https://console.cloud.google.com'
      }
    ],
    properties: [
      {
        key: 'client_id',
        title: 'OAuth Client ID',
        hint: 'Your Google Cloud OAuth client ID',
        type: 'text',
        required: true,
        placeholder: '',
        validation: {
          minLength: 20
        }
      },
      {
        key: 'client_secret',
        title: 'OAuth Client Secret',
        hint: 'Your Google Cloud OAuth client secret',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          minLength: 20
        }
      },
      {
        key: 'default_folder_id',
        title: 'Default Folder ID',
        hint: 'Google Drive folder ID for document storage (optional)',
        type: 'text',
        required: false,
        placeholder: 'root',
        validation: {
          minLength: 3
        }
      },
      {
        key: 'webhook_url',
        title: 'Webhook URL',
        hint: 'URL for receiving document change notifications (optional)',
        type: 'url',
        required: false,
        placeholder: 'https://yourdomain.com/docs-webhook'
      },
      {
        key: 'redirect_uri',
        title: 'Redirect URI',
        hint: 'OAuth 2.0 redirect URI for desktop app authentication',
        type: 'text',
        required: true,
        placeholder: 'http://localhost:3000/callback',
        validation: {
          pattern: '^https?://localhost:[0-9]+/.+|^urn:ietf:wg:oauth:2.0:oob$',
          minLength: 10
        }
      }
    ]
  },

  zoom: {
    id: 'zoom',
    sort: 15,
    beta: false,
    comingSoon: true,
    name: 'Zoom',
    description: 'Run professional meetings and collaborate with your team from anywhere. Schedule video calls, manage participants, record sessions, and handle all your video conferencing needs efficiently.',
    category: 'Productivity',
    icon: 'zoom.avif',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2025-02-08 21:00:00',
    developer: 'Jonathon Byrdziak & Alan Carvalho',
    formGuide: 'Get your API Key, API Secret, and JWT credentials from Zoom App Marketplace. Go to Develop > Build App.',
    installationGuide: {
      title: 'Zoom API Setup Guide',
      description: 'Configure Zoom API for meeting management and automation (10-15 minutes)',
      steps: [
        {
          title: 'Create Zoom App',
          content: `1. Go to https://marketplace.zoom.us
2. Click "Develop" > "Build App"
3. Choose "JWT" or "OAuth" app type
4. Enter app name and description
5. Select app category (e.g., "Productivity")`
        },
        {
          title: 'Configure App Credentials',
          content: `1. In app settings, go to "App Credentials"
2. Generate API Key and API Secret
3. For JWT apps: create JWT secret
4. For OAuth apps: set redirect URL and get verification code
5. Download credentials securely for implementation`
        },
        {
          title: 'Set Scopes and Permissions',
          content: `1. Go to "Scopes" in app settings
2. Add required scopes:
   - meeting:write - Schedule and manage meetings
   - user:read - Access user information
   - recording:read - Access meeting recordings
3. Save changes and re-authenticate if required
4. Test scopes with Zoom API Explorer`
        },
        {
          title: 'Configure Features',
          content: `1. Enable meeting features in app settings:
   - Meeting recordings
   - Cloud recording
   - Breakout rooms
   - Waiting room
2. Set up webhook events for real-time updates
3. Configure meeting templates and settings
4. Set up user authentication flow if needed`
        },
        {
          title: 'Set Up Webhooks',
          content: `1. In app settings, configure webhook URLs
2. Add events to receive:
   - Meeting started/ended
   - Participant joined/left
   - Recording completed
3. Verify webhook ownership with Zoom
4. Test webhook delivery and event handling`
        },
        {
          title: 'Test Your Integration',
          content: `1. Test authentication with your credentials
2. Test basic API calls: create meeting, list users
3. Test meeting scheduling with templates
4. Test webhook events if configured
5. Monitor usage in Zoom App Marketplace dashboard`
        }
      ],
      importantNotes: [
        'Zoom API has rate limits based on user and plan type',
        'Free tier includes 100 API requests per day',
        'Meeting recordings require cloud recording enabled',
        'JWT apps are being deprecated - prefer OAuth for new apps',
        'Webhook URLs must use HTTPS and be publicly accessible'
      ]
    },
    media: [
    ],
    features: [
      {
        title: 'Meeting Management',
        description: 'Schedule, start, and manage meetings with participants'
      },
      {
        title: 'Recording Management',
        description: 'Access, download, and manage meeting recordings'
      },
      {
        title: 'User Management',
        description: 'Manage Zoom users, licenses, and settings'
      },
      {
        title: 'Webinar Support',
        description: 'Create and manage webinars with registration and analytics'
      }
    ],
    guideLinks: [
      {
        title: 'Zoom API Documentation',
        description: 'Complete reference for Zoom REST API',
        url: 'https://marketplace.zoom.us/docs/api-reference'
      },
      {
        title: 'Zoom App Marketplace',
        description: 'Create and manage Zoom applications',
        url: 'https://marketplace.zoom.us'
      },
      {
        title: 'Webhook Guide',
        description: 'Setting up Zoom webhooks for real-time events',
        url: 'https://marketplace.zoom.us/docs/guides/webhooks'
      }
    ],
    properties: [
      {
        key: 'api_key',
        title: 'API Key',
        hint: 'Your Zoom application API key',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          minLength: 20
        }
      },
      {
        key: 'api_secret',
        title: 'API Secret',
        hint: 'Your Zoom application API secret',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          minLength: 20
        }
      },
      {
        key: 'jwt_token',
        title: 'JWT Token',
        hint: 'JWT token for server-to-server authentication (optional)',
        type: 'password',
        required: false,
        placeholder: '',
        validation: {
          minLength: 100
        }
      },
      {
        key: 'webhook_url',
        title: 'Webhook URL',
        hint: 'URL for receiving Zoom events (optional)',
        type: 'url',
        required: false,
        placeholder: 'http://localhost:3000/zoom-webhook',
        validation: {
          pattern: '^https?://localhost:[0-9]+/.+|^urn:ietf:wg:oauth:2.0:oob$',
          minLength: 10
        }
      },
      {
        key: 'redirect_uri',
        title: 'Redirect URI',
        hint: 'OAuth 2.0 redirect URI for desktop app authentication',
        type: 'text',
        required: true,
        placeholder: 'http://localhost:3000/callback',
        validation: {
          pattern: '^https?://localhost:[0-9]+/.+|^urn:ietf:wg:oauth:2.0:oob$',
          minLength: 10
        }
      }
    ]
  },

  google_meet: {
    id: 'google_meet',
    sort: 16,
    beta: false,
    comingSoon: true,
    name: 'Google Meet',
    description: 'Connect with your team through high-quality video meetings integrated with your calendar. Schedule calls, manage video conferences, sync with your schedule, and handle all your video collaboration needs seamlessly.',
    category: 'Productivity',
    icon: 'google_meet.avif',
    connected: false,
    version: '1.0.0',
    lastUpdated: '2025-02-08 21:00:00',
    developer: 'Jonathon Byrdziak & Alan Carvalho',
    formGuide: 'Get your API credentials from Google Cloud Console. Go to APIs & Services > Credentials > Create Credentials > OAuth 2.0 Client ID.',
    installationGuide: {
      title: 'Google Meet API Setup Guide',
      description: 'Configure Google Meet API for video conferencing and meeting management (10-15 minutes)',
      steps: [
        {
          title: 'Create Google Cloud Project',
          content: `1. Go to https://console.cloud.google.com
2. Create a new project or select existing one
3. Name your project (e.g., "Sulla Meet Integration")
4. Enable billing if required for your usage level
5. Note your Project ID for API configuration`
        },
        {
          title: 'Enable Meet APIs',
          content: `1. In Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for and enable "Google Meet API"
3. Also enable "Google Calendar API" for scheduling
4. Review quota limits and pricing for your usage
5. Wait for APIs to be fully enabled (usually immediate)`
        },
        {
          title: 'Configure OAuth Consent Screen',
          content: `1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type
3. Fill in application information:
   - App name, user support email, developer contact
   - Application logo and homepage URL
   - Scopes for Meet and Calendar access
4. Add test users for development phase
5. Submit and wait for verification if needed`
        },
        {
          title: 'Create OAuth Credentials',
          content: `1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Choose "Web application" type
4. Add authorized redirect URIs for your application
5. Download JSON file with client credentials`
        },
        {
          title: 'Set Up Meet Integration',
          content: `1. Configure meeting space creation
2. Set up video conference settings:
   - Camera and microphone permissions
   - Screen sharing capabilities
   - Recording settings
3. Test meeting creation with Google Calendar integration
4. Configure participant management features
5. Set up meeting recordings and transcripts`
        },
        {
          title: 'Test Your Integration',
          content: `1. Test OAuth flow with test user account
2. Test basic API calls: create meeting space, list meetings
3. Test meeting scheduling with Calendar integration
4. Test video and audio quality settings
5. Monitor usage in Google Cloud Console`
        }
      ],
      importantNotes: [
        'Google Meet API requires Google Workspace subscription for full features',
        'Free tier includes basic meeting creation and management',
        'Meeting recordings require Google Workspace Enterprise tier',
        'Calendar integration is essential for meeting scheduling',
        'Real-time features use WebSocket connections for live updates'
      ]
    },
    media: [
    ],
    features: [
      {
        title: 'Meeting Creation',
        description: 'Create and schedule video meetings with participants'
      },
      {
        title: 'Calendar Integration',
        description: 'Seamless integration with Google Calendar for scheduling'
      },
      {
        title: 'Recording & Transcripts',
        description: 'Record meetings and generate automatic transcripts'
      },
      {
        title: 'Live Streaming',
        description: 'Stream meetings to YouTube and other platforms'
      }
    ],
    guideLinks: [
      {
        title: 'Google Meet API Documentation',
        description: 'Complete reference for Google Meet API',
        url: 'https://developers.google.com/meet/api'
      },
      {
        title: 'Google Workspace',
        description: 'Google Workspace integration and setup',
        url: 'https://workspace.google.com'
      },
      {
        title: 'Google Cloud Console',
        description: 'Manage API credentials and quotas',
        url: 'https://console.cloud.google.com'
      }
    ],
    properties: [
      {
        key: 'client_id',
        title: 'OAuth Client ID',
        hint: 'Your Google Cloud OAuth client ID',
        type: 'text',
        required: true,
        placeholder: '',
        validation: {
          minLength: 20
        }
      },
      {
        key: 'client_secret',
        title: 'OAuth Client Secret',
        hint: 'Your Google Cloud OAuth client secret',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          minLength: 20
        }
      },
      {
        key: 'service_account_key',
        title: 'Service Account Key',
        hint: 'JSON key file for service account authentication (optional)',
        type: 'password',
        required: false,
        placeholder: '',
        validation: {
          minLength: 100
        }
      },
      {
        key: 'webhook_url',
        title: 'Webhook URL',
        hint: 'URL for receiving Meet event notifications (optional)',
        type: 'url',
        required: false,
        placeholder: 'https://yourdomain.com/meet-webhook'
      },
      {
        key: 'redirect_uri',
        title: 'Redirect URI',
        hint: 'OAuth 2.0 redirect URI for desktop app authentication',
        type: 'text',
        required: true,
        placeholder: 'http://localhost:3000/callback',
        validation: {
          pattern: '^https?://localhost:[0-9]+/.+|^urn:ietf:wg:oauth:2.0:oob$',
          minLength: 10
        }
      }
    ]
  }

};
