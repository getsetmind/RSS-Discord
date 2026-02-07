import { z } from "zod";

const feedConfigSchema = z.object({
	name: z.string().min(1),
	url: z.url(),
	webhookUrl: z.string().startsWith("https://discord.com/api/webhooks/"),
	color: z.int().min(0),
	intervalMinutes: z.number().positive(),
});

export const appConfigSchema = z.object({
	feeds: z.array(feedConfigSchema).min(1),
});

export type FeedConfig = z.infer<typeof feedConfigSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;

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
	username?: string;
	avatar_url?: string;
}
