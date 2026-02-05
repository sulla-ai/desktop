export interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  connected: boolean;
  version?: string;
  lastUpdated?: string;
  developer?: string;
  media?: Array<{
    type: 'image' | 'youtube';
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
    type: 'text' | 'password' | 'email' | 'url' | 'number';
    default?: string;
    required: boolean;
    placeholder?: string;
    validation?: {
      pattern?: string;
      minLength?: number;
      maxLength?: number;
      min?: number;
      max?: number;
    };
  }>;
}

export const integrations: Record<string, Integration> = {
  intercom: {
    id: 'intercom',
    name: 'Intercom',
    description: 'Customer communication platform that helps you build better customer relationships through personalized, messenger-based experiences. Perfect for support, marketing, and sales teams.',
    category: 'Customer Support',
    icon: 'intercom.svg',
    connected: false,
    version: '2.1.0',
    lastUpdated: '1 day ago',
    developer: 'Intercom Inc.',
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

  twilio: {
    id: 'twilio',
    name: 'Twilio',
    description: 'Programmable communication platform for SMS, voice, video, and email. Enable SULLA to send notifications, make calls, and handle customer communications through powerful APIs.',
    category: 'Communication API',
    icon: 'twilio.svg',
    connected: false,
    version: '3.0.1',
    lastUpdated: '3 days ago',
    developer: 'Twilio Inc.',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=450&fit=crop',
        alt: 'Twilio Console',
        caption: 'Manage all your communication services from the centralized console'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=450&fit=crop',
        alt: 'SMS Messaging',
        caption: 'Send and receive SMS messages programmatically with SULLA'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=800&h=450&fit=crop',
        alt: 'Voice Calls',
        caption: 'Make and receive voice calls through Twilio\'s VoIP infrastructure'
      }
    ],
    features: [
      {
        title: 'SMS Messaging',
        description: 'Send text messages globally with reliable delivery and tracking'
      },
      {
        title: 'Voice Calls',
        description: 'Programmable voice calling with IVR, recording, and conferencing'
      },
      {
        title: 'Email Service',
        description: 'Send emails with high deliverability through SendGrid integration'
      },
      {
        title: 'WhatsApp Business',
        description: 'Connect with customers on WhatsApp through official Business API'
      }
    ],
    guideLinks: [
      {
        title: 'Twilio Quickstart',
        description: 'Get started with Twilio APIs in minutes',
        url: 'https://www.twilio.com/docs/quickstart'
      },
      {
        title: 'SMS API Guide',
        description: 'Learn to send and receive SMS messages programmatically',
        url: 'https://www.twilio.com/docs/sms'
      },
      {
        title: 'Voice API Documentation',
        description: 'Complete reference for voice calling capabilities',
        url: 'https://www.twilio.com/docs/voice'
      }
    ],
    properties: [
      {
        key: 'account_sid',
        title: 'Account SID',
        hint: 'Your Twilio Account SID starting with AC',
        type: 'text',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^AC[a-zA-Z0-9]{32}$',
          minLength: 34,
          maxLength: 34
        }
      },
      {
        key: 'auth_token',
        title: 'Auth Token',
        hint: 'Your Twilio authentication token',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^[a-zA-Z0-9]{32}$',
          minLength: 32,
          maxLength: 32
        }
      },
      {
        key: 'phone_number',
        title: 'Twilio Phone Number',
        hint: 'Your Twilio phone number in E.164 format',
        type: 'text',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^\\+[1-9]\\d{1,14}$',
          minLength: 10,
          maxLength: 16
        }
      }
    ]
  },

  hubspot: {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'All-in-one marketing, sales, and service platform. Help SULLA manage customer relationships, track interactions, and automate communication workflows across the entire customer lifecycle.',
    category: 'CRM & Marketing',
    icon: 'hubspot.svg',
    connected: false,
    version: '1.8.2',
    lastUpdated: '2 days ago',
    developer: 'HubSpot, Inc.',
    media: [
      {
        type: 'youtube',
        url: 'GnIREMgz-SQ',
        alt: 'What is HubSpot?',
        caption: 'Discover the powerful, flexible, and easy-to-use HubSpot Customer Platform'
      },
      {
        type: 'youtube',
        url: 'yZOIPlpJwr4',
        alt: 'What is a Sales Process? by HubSpot CRO, Mark Roberge',
        caption: "HubSpot's Chief Revenue Officer Mark Roberge covers some of the details you should consider when outlining your sales process"
      },
      {
        type: 'image',
        url: 'hubspot-media-1.webp',
        alt: 'HubSpot Media - 1'
      },
      {
        type: 'image',
        url: 'hubspot-media-2.png',
        alt: 'HubSpot Media - 2'
      },
      {
        type: 'image',
        url: 'hubspot-media-3.png',
        alt: 'HubSpot Media - 3'
      },
      {
        type: 'image',
        url: 'hubspot-media-4.png',
        alt: 'HubSpot Media - 4'
      }
    ],
    features: [
      {
        title: 'Contact Management',
        description: 'Organize and track all customer interactions in one centralized database'
      },
      {
        title: 'Email Marketing',
        description: 'Create and automate personalized email campaigns at scale'
      },
      {
        title: 'Lead Generation',
        description: 'Capture and nurture leads with forms, landing pages, and automation'
      },
      {
        title: 'Analytics & Reporting',
        description: 'Track performance with detailed analytics and custom reports'
      }
    ],
    guideLinks: [
      {
        title: 'HubSpot Academy',
        description: 'Free courses and certifications for HubSpot platform',
        url: 'https://academy.hubspot.com'
      },
      {
        title: 'API Documentation',
        description: 'Developer resources for custom integrations',
        url: 'https://developers.hubspot.com'
      },
      {
        title: 'Email Marketing Guide',
        description: 'Best practices for successful email campaigns',
        url: 'https://blog.hubspot.com'
      }
    ],
    properties: [
      {
        key: 'api_key',
        title: 'Private App API Key',
        hint: 'Your HubSpot private app access token',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^pat-[a-z0-9]{3}-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',
          minLength: 51,
          maxLength: 51
        }
      },
      {
        key: 'portal_id',
        title: 'Portal ID',
        hint: 'Your HubSpot portal/account ID',
        type: 'text',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^\\d{7,8}$',
          minLength: 7,
          maxLength: 8
        }
      }
    ]
  },

  slack: {
    id: 'slack',
    name: 'Slack',
    description: 'Team collaboration platform that brings all your communication together. Enable SULLA to send notifications, share updates, and interact with team members through channels and direct messages.',
    category: 'Team Communication',
    icon: 'slack.svg',
    connected: false,
    version: '2.4.0',
    lastUpdated: '5 days ago',
    developer: 'Slack Technologies',
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
    guideLinks: [
      {
        title: 'Slack API Guide',
        description: 'Learn to build apps and integrations for Slack',
        url: 'https://api.slack.com'
      },
      {
        title: 'Bot Token Guide',
        description: 'How to create and configure Slack bot tokens',
        url: 'https://api.slack.com/authentication/basics'
      },
      {
        title: 'Best Practices',
        description: 'Tips for effective team communication on Slack',
        url: 'https://slack.com/resources'
      }
    ],
    properties: [
      {
        key: 'bot_token',
        title: 'Bot Token',
        hint: 'Your Slack bot token starting with xoxb-',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9_-]{24}$',
          minLength: 50,
          maxLength: 60
        }
      },
      {
        key: 'signing_secret',
        title: 'Signing Secret',
        hint: 'Used to verify that requests are coming from Slack',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^[a-zA-Z0-9]{32}$',
          minLength: 32,
          maxLength: 32
        }
      },
      {
        key: 'channel',
        title: 'Channel',
        hint: 'Default Slack channel for messages (e.g., #general)',
        type: 'text',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^#?[a-z0-9-_]{1,21}$',
          minLength: 2,
          maxLength: 22
        }
      }
    ]
  },

  mailgun: {
    id: 'mailgun',
    name: 'Mailgun',
    description: 'Powerful email API service for developers. Enable SULLA to send, receive, and track emails programmatically with advanced analytics, validation, and deliverability features.',
    category: 'Email Service',
    icon: 'mailgun.svg',
    connected: false,
    version: '1.5.3',
    lastUpdated: '1 week ago',
    developer: 'Mailgun Technologies',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1596079820260-4635c9c198c7?w=800&h=450&fit=crop',
        alt: 'Mailgun Analytics',
        caption: 'Track email delivery rates, opens, clicks, and bounces'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop',
        alt: 'Email Templates',
        caption: 'Create dynamic email templates with personalization'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=450&fit=crop',
        alt: 'API Dashboard',
        caption: 'Monitor API usage and configure email routing rules'
      }
    ],
    features: [
      {
        title: 'Email API',
        description: 'Send emails through RESTful API with SMTP fallback'
      },
      {
        title: 'Email Validation',
        description: 'Validate email addresses in real-time to reduce bounces'
      },
      {
        title: 'Analytics & Tracking',
        description: 'Track opens, clicks, and engagement with detailed analytics'
      },
      {
        title: 'Routing & Rules',
        description: 'Set up complex email routing and filtering rules'
      }
    ],
    guideLinks: [
      {
        title: 'Quickstart Guide',
        description: 'Start sending emails in minutes with Mailgun',
        url: 'https://documentation.mailgun.com'
      },
      {
        title: 'Email API Reference',
        description: 'Complete API documentation for developers',
        url: 'https://documentation.mailgun.com/en/latest/api_reference.html'
      },
      {
        title: 'Deliverability Guide',
        description: 'Best practices for high email deliverability',
        url: 'https://www.mailgun.com/blog/deliverability'
      }
    ],
    properties: [
      {
        key: 'api_key',
        title: 'API Key',
        hint: 'Your Mailgun private API key',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^key-[a-zA-Z0-9]{32}$',
          minLength: 35,
          maxLength: 35
        }
      },
      {
        key: 'domain',
        title: 'Domain',
        hint: 'Your verified Mailgun domain',
        type: 'text',
        required: true,
        placeholder: 'mg.yourdomain.com',
        validation: {
          pattern: '^[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
          minLength: 3
        }
      },
      {
        key: 'from_email',
        title: 'From Email',
        hint: 'Default sender email address',
        type: 'email',
        required: true,
        placeholder: 'noreply@yourdomain.com'
      }
    ]
  },

  sendgrid: {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Cloud-based email delivery platform that reliably delivers emails on behalf of SULLA. Advanced features include email marketing campaigns, automation, and detailed analytics.',
    category: 'Email Service',
    icon: 'sendgrid.svg',
    connected: false,
    version: '3.2.1',
    lastUpdated: '4 days ago',
    developer: 'Twilio Inc.',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1596079820260-4635c9c198c7?w=800&h=450&fit=crop',
        alt: 'SendGrid Dashboard',
        caption: 'Monitor email performance and campaign analytics'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop',
        alt: 'Email Marketing',
        caption: 'Create and automate email marketing campaigns'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1559028006-848a6538c4f9?w=800&h=450&fit=crop',
        alt: 'Template Design',
        caption: 'Design responsive email templates with drag-and-drop editor'
      }
    ],
    features: [
      {
        title: 'Email Delivery',
        description: 'Reliable email delivery with 99%+ deliverability rate'
      },
      {
        title: 'Marketing Campaigns',
        description: 'Create and automate email marketing campaigns at scale'
      },
      {
        title: 'Template Library',
        description: 'Use pre-built templates or create custom designs'
      },
      {
        title: 'Deliverability Tools',
        description: 'Advanced tools to ensure your emails reach the inbox'
      }
    ],
    guideLinks: [
      {
        title: 'SendGrid API Guide',
        description: 'Learn to integrate SendGrid with your applications',
        url: 'https://sendgrid.com/docs/API_Reference'
      },
      {
        title: 'Email Marketing Guide',
        description: 'Best practices for email marketing campaigns',
        url: 'https://sendgrid.com/blog'
      },
      {
        title: 'Getting Started',
        description: 'Quick start guide for new SendGrid users',
        url: 'https://sendgrid.com/docs/for-developers/sending-email/getting-started'
      }
    ],
    properties: [
      {
        key: 'api_key',
        title: 'API Key',
        hint: 'Your SendGrid API key with email sending permissions',
        type: 'password',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^SG\\.[a-zA-Z0-9]{48}\\.[a-zA-Z0-9]{86}$',
          minLength: 143,
          maxLength: 143
        }
      },
      {
        key: 'from_email',
        title: 'From Email',
        hint: 'Default sender email address (must be verified in SendGrid)',
        type: 'email',
        required: true,
        placeholder: 'noreply@yourdomain.com'
      }
    ]
  },

  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Connect with customers on the world\'s most popular messaging platform. Enable SULLA to send notifications, provide support, and automate conversations through WhatsApp Business API.',
    category: 'Messaging',
    icon: 'whatsapp.svg',
    connected: false,
    version: '2.3.1',
    lastUpdated: '1 week ago',
    developer: 'Meta',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1610945411025-4e1a472b8ddb?w=800&h=450&fit=crop',
        alt: 'WhatsApp Business Interface',
        caption: 'Professional WhatsApp Business messaging interface'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1559028006-848a6538c4f9?w=800&h=450&fit=crop',
        alt: 'Customer Conversations',
        caption: 'Real-time customer support through WhatsApp'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=800&h=450&fit=crop',
        alt: 'Message Templates',
        caption: 'Create and manage message templates for bulk messaging'
      }
    ],
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
    name: 'Telegram',
    description: 'Cloud-based instant messaging service with powerful bot capabilities. Enable SULLA to create bots, send messages, and automate communication through Telegram\'s flexible API.',
    category: 'Messaging',
    icon: 'telegram.svg',
    connected: false,
    version: '1.8.0',
    lastUpdated: '3 days ago',
    developer: 'Telegram Messenger LLP',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1610945411025-4e1a472b8ddb?w=800&h=450&fit=crop',
        alt: 'Telegram Bot Interface',
        caption: 'Powerful bot creation and management interface'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=450&fit=crop',
        alt: 'Group Management',
        caption: 'Manage groups and channels with automated bots'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=800&h=450&fit=crop',
        alt: 'API Integration',
        caption: 'Seamless API integration for custom workflows'
      }
    ],
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

  discord: {
    id: 'discord',
    name: 'Discord',
    description: 'Voice, video, and text communication platform designed for communities. Enable SULLA to join servers, send messages, and automate community management through Discord bots.',
    category: 'Community',
    icon: 'discord.svg',
    connected: false,
    version: '2.0.5',
    lastUpdated: '2 days ago',
    developer: 'Discord Inc.',
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
        alt: 'Features'
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

  signal: {
    id: 'signal',
    name: 'Signal',
    description: 'Privacy-focused messaging app with end-to-end encryption. Enable SULLA to send secure messages and notifications through Signal\'s privacy-preserving platform.',
    category: 'Secure Messaging',
    icon: 'signal.svg',
    connected: false,
    version: '1.2.0',
    lastUpdated: '1 week ago',
    developer: 'Signal Foundation',
    media: [
      {
        type: 'youtube',
        url: 'vjdlMZQbSQs',
        alt: 'Signal Interface',
        caption: 'Clean, privacy-focused messaging interface'
      },
      {
        type: 'image',
        url: 'signal-media-1.webp',
        alt: 'Secure Messaging',
        caption: 'End-to-end encrypted conversations'
      },
      {
        type: 'image',
        url: 'signal-media-2.webp',
        alt: 'Voice & Video Calls',
        caption: 'Secure voice and video calling'
      },
      {
        type: 'image',
        url: 'signal-media-3.png',
        alt: 'Backup Plans',
        caption: 'Secure backup and recovery options'
      }
    ],
    features: [
      {
        title: 'End-to-End Encryption',
        description: 'Military-grade encryption for all communications'
      },
      {
        title: 'Privacy Protection',
        description: 'No metadata collection or tracking'
      },
      {
        title: 'Secure Groups',
        description: 'Encrypted group conversations and file sharing'
      },
      {
        title: 'Self-Destructing Messages',
        description: 'Messages that automatically delete after set time'
      }
    ],
    guideLinks: [
      {
        title: 'Signal Protocol',
        description: 'Technical documentation on Signal encryption',
        url: 'https://signal.org/docs/'
      },
      {
        title: 'Privacy Guide',
        description: 'Understanding Signal privacy features',
        url: 'https://signal.org/privacy/'
      },
      {
        title: 'Security Best Practices',
        description: 'Tips for secure communication',
        url: 'https://signal.org/blog/security-best-practices/'
      }
    ],
    properties: [
      {
        key: 'phone_number',
        title: 'Phone Number',
        hint: 'Your Signal registered phone number in E.164 format',
        type: 'text',
        required: true,
        placeholder: '',
        validation: {
          pattern: '^\\+[1-9]\\d{1,14}$',
          minLength: 10,
          maxLength: 16
        }
      },
      {
        key: 'uuid',
        title: 'UUID',
        hint: 'Your Signal UUID (optional, can be retrieved via API)',
        type: 'text',
        required: false,
        placeholder: '',
        validation: {
          pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
          minLength: 36,
          maxLength: 36
        }
      }
    ]
  },

  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Professional networking platform for business development and recruitment. Enable SULLA to manage professional connections, share business content, and engage with industry professionals through LinkedIn\'s powerful network.',
    category: 'Professional Network',
    icon: 'linkedin.svg',
    connected: false,
    version: '1.5.0',
    lastUpdated: '4 days ago',
    developer: 'Microsoft Corporation',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=450&fit=crop',
        alt: 'LinkedIn Professional Network',
        caption: 'Professional networking and business development platform'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1559028006-848a6538c4f9?w=800&h=450&fit=crop',
        alt: 'LinkedIn Business',
        caption: 'Business networking and professional connections'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=800&h=450&fit=crop',
        alt: 'LinkedIn Content',
        caption: 'Share professional content and engage with industry leaders'
      }
    ],
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
  }
};
