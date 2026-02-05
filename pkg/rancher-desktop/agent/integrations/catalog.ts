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
  images?: Array<{
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
    icon: '💬',
    connected: false,
    version: '2.1.0',
    lastUpdated: '1 day ago',
    developer: 'Intercom Inc.',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=450&fit=crop',
        alt: 'Intercom Dashboard',
        caption: 'Main dashboard with conversation overview and team performance metrics'
      },
      {
        url: 'https://images.unsplash.com/photo-1556656793-08538906a9f8?w=800&h=450&fit=crop',
        alt: 'Live Chat Interface',
        caption: 'Real-time customer chat interface with automated responses'
      },
      {
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
    icon: '📞',
    connected: false,
    version: '3.0.1',
    lastUpdated: '3 days ago',
    developer: 'Twilio Inc.',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=450&fit=crop',
        alt: 'Twilio Console',
        caption: 'Manage all your communication services from the centralized console'
      },
      {
        url: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=450&fit=crop',
        alt: 'SMS Messaging',
        caption: 'Send and receive SMS messages programmatically with SULLA'
      },
      {
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
    icon: '🎯',
    connected: false,
    version: '1.8.2',
    lastUpdated: '2 days ago',
    developer: 'HubSpot, Inc.',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1559028006-848a6538c4f9?w=800&h=450&fit=crop',
        alt: 'HubSpot CRM Dashboard',
        caption: 'Complete view of your customer relationships and pipeline'
      },
      {
        url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop',
        alt: 'Marketing Automation',
        caption: 'Create automated email campaigns and customer journeys'
      },
      {
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
    icon: '🔷',
    connected: false,
    version: '2.4.0',
    lastUpdated: '5 days ago',
    developer: 'Slack Technologies',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=450&fit=crop',
        alt: 'Slack Workspace',
        caption: 'Organized team conversations in channels and direct messages'
      },
      {
        url: 'https://images.unsplash.com/photo-1559028006-848a6538c4f9?w=800&h=450&fit=crop',
        alt: 'Integration Hub',
        caption: 'Connect all your tools and apps to Slack for centralized notifications'
      },
      {
        url: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=800&h=450&fit=crop',
        alt: 'File Sharing',
        caption: 'Share and collaborate on documents, images, and files'
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
    icon: '📧',
    connected: false,
    version: '1.5.3',
    lastUpdated: '1 week ago',
    developer: 'Mailgun Technologies',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1596079820260-4635c9c198c7?w=800&h=450&fit=crop',
        alt: 'Mailgun Analytics',
        caption: 'Track email delivery rates, opens, clicks, and bounces'
      },
      {
        url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop',
        alt: 'Email Templates',
        caption: 'Create dynamic email templates with personalization'
      },
      {
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
    icon: '📨',
    connected: false,
    version: '3.2.1',
    lastUpdated: '4 days ago',
    developer: 'Twilio Inc.',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1596079820260-4635c9c198c7?w=800&h=450&fit=crop',
        alt: 'SendGrid Dashboard',
        caption: 'Monitor email performance and campaign analytics'
      },
      {
        url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop',
        alt: 'Email Marketing',
        caption: 'Create and automate email marketing campaigns'
      },
      {
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
  }
};
