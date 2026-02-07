import { z } from "zod";

/**
 * @description 個別フィードのバリデーションスキーマ
 * @property name - フィード表示名
 * @property url - フィードURL
 * @property webhookUrl - Discord Webhook URL
 * @property color - Embed のカラーコード
 * @property intervalMinutes - ポーリング間隔(分)
 */
const feedConfigSchema = z.object({
	name: z.string().min(1),
	url: z.url(),
	webhookUrl: z.string().startsWith("https://discord.com/api/webhooks/"),
	color: z.int().min(0),
	intervalMinutes: z.number().positive(),
});

/**
 * @description アプリケーション設定のバリデーションスキーマ
 * @property feeds - フィード設定の配列(1件以上)
 */
export const appConfigSchema = z.object({
	feeds: z.array(feedConfigSchema).min(1),
});

/** @description 個別フィードの設定 */
export type FeedConfig = z.infer<typeof feedConfigSchema>;

/** @description アプリケーション全体の設定 */
export type AppConfig = z.infer<typeof appConfigSchema>;

/**
 * @description フィードから取得した正規化済みアイテム
 * @property id - アイテムの一意識別子
 * @property title - アイテムのタイトル
 * @property link - アイテムのURL
 * @property description - アイテムの説明 @optional
 * @property pubDate - 公開日時文字列 @optional
 * @property author - 著者名 @optional
 */
export interface FeedItem {
	id: string;
	title: string;
	link: string;
	description?: string;
	pubDate?: string;
	author?: string;
}

/**
 * @description 送信済みアイテムIDの永続化ストア
 * @property [feedUrl] - フィードURLをキーとした送信済みID配列
 */
export interface SentStore {
	[feedUrl: string]: string[];
}

/**
 * @description Discord Embed オブジェクト
 * @property title - タイトル @optional
 * @property description - 説明文 @optional
 * @property url - リンクURL @optional
 * @property color - カラーコード @optional
 * @property timestamp - ISO 8601タイムスタンプ @optional
 * @property author - 著者情報 @optional
 * @property footer - フッター情報 @optional
 */
export interface DiscordEmbed {
	title?: string;
	description?: string;
	url?: string;
	color?: number;
	timestamp?: string;
	author?: { name: string; url?: string };
	footer?: { text: string };
}

/**
 * @description Discord Webhook に送信するペイロード
 * @property embeds - Embed の配列
 * @property username - Webhook の表示名 @optional
 * @property avatar_url - Webhook のアバターURL @optional
 */
export interface DiscordWebhookPayload {
	embeds: DiscordEmbed[];
	username?: string;
	avatar_url?: string;
}
