import type {
	DiscordEmbed,
	DiscordWebhookPayload,
	FeedConfig,
	FeedItem,
} from "./types";

/**
 * @description Discord Embed タイトルの最大文字数
 */
const TITLE_MAX = 256;

/**
 * @description Discord Embed 説明文の最大文字数
 */
const DESCRIPTION_MAX = 4096;

/**
 * @description GitHub のアバターURL
 */
const GITHUB_AVATAR_URL = "https://github.com/github.png";

/**
 * @description 汎用RSSのアバターURL
 */
const RSS_AVATAR_URL =
	"https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Feed-icon.svg/128px-Feed-icon.svg.png";

/**
 * @description Webhook の表示名とアバターURLのペア
 * @property username - Webhook の表示名
 * @property avatarUrl - Webhook のアバターURL
 */
interface WebhookIdentity {
	username: string;
	avatarUrl: string;
}

/**
 * @description フィードURLのホスト名からWebhook表示情報を決定する
 * @param feedUrl - フィードURL
 */
function resolveWebhookIdentity(feedUrl: string): WebhookIdentity {
	if (new URL(feedUrl).hostname === "github.com") {
		return { username: "GitHub", avatarUrl: GITHUB_AVATAR_URL };
	}
	return { username: "RSS", avatarUrl: RSS_AVATAR_URL };
}

/**
 * @description テキストを最大文字数に切り詰める
 * @param text - 対象テキスト
 * @param max - 最大文字数
 */
function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max - 3)}...`;
}

/**
 * @description HTMLタグを除去してプレーンテキストにする
 * @param html - HTML文字列
 */
function stripHtml(html: string): string {
	return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * @description Webhook にペイロードをPOSTする
 * @param webhookUrl - Discord Webhook URL
 * @param payload - 送信するペイロード
 */
async function postWebhook(
	webhookUrl: string,
	payload: DiscordWebhookPayload,
): Promise<Response> {
	return fetch(webhookUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
		signal: AbortSignal.timeout(30_000),
	});
}

/**
 * @description レスポンスが成功かどうかを判定する
 * @param response - fetch のレスポンス
 */
function isSuccessResponse(response: Response): boolean {
	return response.status === 204 || response.ok;
}

/**
 * @description フィードアイテムからDiscord Embedを構築する
 * @param item - フィードアイテム
 * @param feedConfig - フィード設定
 * @param color - Embed のカラーコード
 */
export function buildEmbed(
	item: FeedItem,
	feedConfig: FeedConfig,
	color: number,
): DiscordEmbed {
	const embed: DiscordEmbed = {
		title: truncate(item.title, TITLE_MAX),
		url: item.link || undefined,
		color,
		author: { name: feedConfig.name },
		footer: { text: `via ${feedConfig.name}` },
	};

	if (item.description) {
		embed.description = truncate(stripHtml(item.description), DESCRIPTION_MAX);
	}

	if (item.pubDate) {
		const date = new Date(item.pubDate);
		if (!Number.isNaN(date.getTime())) {
			embed.timestamp = date.toISOString();
		}
	}

	return embed;
}

/**
 * @description Discord Webhook にEmbedを送信する(レートリミット時は1回リトライ)
 * @param webhookUrl - Discord Webhook URL
 * @param embed - 送信するEmbed
 * @param feedUrl - フィードURL(Webhook表示情報の決定に使用)
 */
export async function sendToDiscord(
	webhookUrl: string,
	embed: DiscordEmbed,
	feedUrl: string,
): Promise<void> {
	const identity = resolveWebhookIdentity(feedUrl);
	const payload: DiscordWebhookPayload = {
		embeds: [embed],
		username: identity.username,
		avatar_url: identity.avatarUrl,
	};

	const response = await postWebhook(webhookUrl, payload);

	if (response.status === 429) {
		const body = (await response.json()) as { retry_after: number };
		const waitMs = (body.retry_after ?? 1) * 1000;
		console.warn(`Rate limited. Waiting ${waitMs}ms...`);
		await Bun.sleep(waitMs);

		const retry = await postWebhook(webhookUrl, payload);
		if (!isSuccessResponse(retry)) {
			await retry.text();
			throw new Error(
				`Discord webhook failed after retry: HTTP ${retry.status}`,
			);
		}
		await retry.text();
		return;
	}

	if (isSuccessResponse(response)) {
		await response.text();
		return;
	}

	const errorText = await response.text();
	throw new Error(
		`Discord webhook error: HTTP ${response.status} - ${errorText}`,
	);
}
