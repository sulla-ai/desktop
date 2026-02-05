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
    caption: string;
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
}

export const integrations: Record<string, Integration> = {
  intercom: {
    id: 'intercom',
    name: 'Intercom',
    description: 'Customer communication platform that helps you build better customer relationships through personalized, messenger-based experiences. Perfect for support, marketing, and sales teams.',
    category: 'Customer Support',
    icon: 'intercom-icon-svgrepo-com.svg',
    connected: false,
    version: '2.1.0',
    lastUpdated: '1 day ago',
    developer: 'Intercom Inc.',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=450&fit=crop',
        alt: 'Intercom Dashboard',
        caption: 'Main dashboard with conversation overview and team performance metrics'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1556656793-08538906a9f8?w=800&h=450&fit=crop',
        alt: 'Live Chat Interface',
        caption: 'Real-time customer chat interface with automated responses'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1559028006-848a6538c4f9?w=800&h=450&fit=crop',
        alt: 'Team Collaboration',
        caption: 'Team inbox and assignment features for efficient customer support'
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
    ]
  },

  twilio: {
    id: 'twilio',
    name: 'Twilio',
    description: 'Programmable communication platform for SMS, voice, video, and email. Enable SULLA to send notifications, make calls, and handle customer communications through powerful APIs.',
    category: 'Communication API',
    icon: 'twilio-icon-svgrepo-com.svg',
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
    ]
  },

  hubspot: {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'All-in-one marketing, sales, and service platform. Help SULLA manage customer relationships, track interactions, and automate communication workflows across the entire customer lifecycle.',
    category: 'CRM & Marketing',
    icon: 'hubspot-svgrepo-com.svg',
    connected: false,
    version: '1.8.2',
    lastUpdated: '2 days ago',
    developer: 'HubSpot, Inc.',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1559028006-848a6538c4f9?w=800&h=450&fit=crop',
        alt: 'HubSpot CRM Dashboard',
        caption: 'Complete view of your customer relationships and pipeline'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop',
        alt: 'Marketing Automation',
        caption: 'Create automated email campaigns and customer journeys'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1556656793-08538906a9f8?w=800&h=450&fit=crop',
        alt: 'Email Templates',
        caption: 'Design beautiful emails with drag-and-drop editor'
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
    ]
  },

  slack: {
    id: 'slack',
    name: 'Slack',
    description: 'Team collaboration platform that brings all your communication together. Enable SULLA to send notifications, share updates, and interact with team members through channels and direct messages.',
    category: 'Team Communication',
    icon: 'slack-svgrepo-com.svg',
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
        url: 'slack-ia4-client-windows-desktop.png',
        alt: 'Slack Desktop Client',
        caption: 'Native Slack desktop application for Windows with all features'
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
        title: 'Webhook Tutorial',
        description: 'Set up incoming and outgoing webhooks for automation',
        url: 'https://api.slack.com/messaging/webhooks'
      },
      {
        title: 'Best Practices',
        description: 'Tips for effective team communication on Slack',
        url: 'https://slack.com/resources'
      }
    ]
  },

  mailgun: {
    id: 'mailgun',
    name: 'Mailgun',
    description: 'Powerful email API service for developers. Enable SULLA to send, receive, and track emails programmatically with advanced analytics, validation, and deliverability features.',
    category: 'Email Service',
    icon: 'mailgun-icon-svgrepo-com.svg',
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
    ]
  },

  sendgrid: {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Cloud-based email delivery platform that reliably delivers emails on behalf of SULLA. Advanced features include email marketing campaigns, automation, and detailed analytics.',
    category: 'Email Service',
    icon: 'sendgrid-icon-svgrepo-com.svg',
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
    ]
  },

  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Connect with customers on the world\'s most popular messaging platform. Enable SULLA to send notifications, provide support, and automate conversations through WhatsApp Business API.',
    category: 'Messaging',
    icon: 'whatsapp-symbol-logo-svgrepo-com.svg',
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
    ]
  },

  telegram: {
    id: 'telegram',
    name: 'Telegram',
    description: 'Cloud-based instant messaging service with powerful bot capabilities. Enable SULLA to create bots, send messages, and automate communication through Telegram\'s flexible API.',
    category: 'Messaging',
    icon: 'telegram-svgrepo-com.svg',
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
    ]
  },

  discord: {
    id: 'discord',
    name: 'Discord',
    description: 'Voice, video, and text communication platform designed for communities. Enable SULLA to join servers, send messages, and automate community management through Discord bots.',
    category: 'Community',
    icon: 'discord-icon-svgrepo-com.svg',
    connected: false,
    version: '2.0.5',
    lastUpdated: '2 days ago',
    developer: 'Discord Inc.',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=450&fit=crop',
        alt: 'Discord Server',
        caption: 'Community server with channels and voice rooms'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=450&fit=crop',
        alt: 'Bot Integration',
        caption: 'Powerful bot integration for server automation'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=800&h=450&fit=crop',
        alt: 'Voice Channels',
        caption: 'High-quality voice communication for teams'
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
    ]
  },

  signal: {
    id: 'signal',
    name: 'Signal',
    description: 'Privacy-focused messaging app with end-to-end encryption. Enable SULLA to send secure messages and notifications through Signal\'s privacy-preserving platform.',
    category: 'Secure Messaging',
    icon: 'signal-svgrepo-com.svg',
    connected: false,
    version: '1.2.0',
    lastUpdated: '1 week ago',
    developer: 'Signal Foundation',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=450&fit=crop',
        alt: 'Signal Interface',
        caption: 'Clean, privacy-focused messaging interface'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=800&h=450&fit=crop',
        alt: 'Secure Messaging',
        caption: 'End-to-end encrypted conversations'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1610945411025-4e1a472b8ddb?w=800&h=450&fit=crop',
        alt: 'Privacy Features',
        caption: 'Advanced privacy and security features'
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
    ]
  },

  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Professional networking platform for business development and recruitment. Enable SULLA to manage professional connections, share business content, and engage with industry professionals through LinkedIn\'s powerful network.',
    category: 'Professional Network',
    icon: 'linkedin-svgrepo-com.svg',
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
    ]
  }
};
