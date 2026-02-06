export interface FeedConfig {
  name: string;
  url: string;
  webhookUrl: string;
  color?: number;
  intervalMinutes?: number;
}

export interface AppConfig {
  feeds: FeedConfig[];
  defaults?: {
    intervalMinutes?: number;
    color?: number;
    maxHistoryPerFeed?: number;
  };
}

export interface FeedItem {
  id: string;
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  author?: string;
}

export interface SentStore {
  [feedUrl: string]: string[];
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  author?: { name: string; url?: string };
  footer?: { text: string };
}

export interface DiscordWebhookPayload {
  embeds: DiscordEmbed[];
}
