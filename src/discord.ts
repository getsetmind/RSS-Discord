import { setTimeout as delay } from "node:timers/promises";
import type { Embed, FeedConfig, FeedItem } from "./types.js";

/**
 * Maximum Discord embed title length.
 */
const titleMax = 256;

/**
 * Maximum Discord embed description length.
 */
const descriptionMax = 4096;

/**
 * Avatar used for GitHub release feeds.
 */
const githubAvatarURL = "https://github.com/github.png";

/**
 * Avatar used for generic RSS feeds.
 */
const rssAvatarURL =
	"https://raw.githubusercontent.com/getsetmind/RSS-Discord/main/assets/rss-icon.png";

/**
 * Payload shape accepted by Discord webhooks.
 */
interface WebhookPayload {
	/**
	 * Embeds to post.
	 */
	embeds: Embed[];
	/**
	 * Optional webhook username override.
	 */
	username?: string;
	/**
	 * Optional webhook avatar override.
	 */
	avatar_url?: string;
}

/**
 * Webhook sender identity resolved from the feed URL.
 */
interface WebhookIdentity {
	/**
	 * Username shown in Discord.
	 */
	username: string;
	/**
	 * Avatar URL shown in Discord.
	 */
	avatarURL: string;
}

/**
 * Discord rate limit response body.
 */
interface RateLimitResponse {
	/**
	 * Seconds until retry is allowed.
	 */
	retry_after?: number;
}

/**
 * Builds a Discord embed for one feed item.
 */
export function buildEmbed(item: FeedItem, feedConfig: FeedConfig): Embed {
	const embed: Embed = {
		title: truncate(item.title, titleMax),
		url: item.link,
		color: feedConfig.color,
		author: { name: feedConfig.name },
		footer: { text: `via ${feedConfig.name}` },
	};

	if (item.description !== "") {
		embed.description = truncate(stripHTML(item.description), descriptionMax);
	}

	if (item.pubDate !== "") {
		const timestamp = Date.parse(item.pubDate);
		if (!Number.isNaN(timestamp)) {
			embed.timestamp = new Date(timestamp).toISOString();
		}
	}

	return embed;
}

/**
 * Sends one Discord webhook message and retries once after HTTP 429.
 */
export async function sendWebhook(
	webhookURL: string,
	embed: Embed,
	feedURL: string,
	signal?: AbortSignal,
): Promise<void> {
	const identity = resolveWebhookIdentity(feedURL);
	const payload: WebhookPayload = {
		embeds: [embed],
		username: identity.username,
		avatar_url: identity.avatarURL,
	};

	const first = await postWebhook(webhookURL, payload, signal);
	if (first.status === 429) {
		const rateLimit = parseRateLimit(first.body);
		const waitMs = Math.max(rateLimit.retry_after ?? 1, 0) * 1000;
		console.warn(`Rate limited retry_after_ms=${Math.trunc(waitMs)}`);
		await delay(waitMs, undefined, { signal });

		const retry = await postWebhook(webhookURL, payload, signal);
		if (!isSuccessStatus(retry.status)) {
			throw new Error(
				`Discord webhook failed after retry: HTTP ${retry.status}`,
			);
		}
		return;
	}

	if (!isSuccessStatus(first.status)) {
		throw new Error(
			`Discord webhook error: HTTP ${first.status} - ${first.body}`,
		);
	}
}

/**
 * Posts a raw payload to a Discord webhook.
 */
async function postWebhook(
	webhookURL: string,
	payload: WebhookPayload,
	signal?: AbortSignal,
): Promise<{ status: number; body: string }> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 30000);
	const abort = (): void => controller.abort();
	signal?.addEventListener("abort", abort, { once: true });

	try {
		const response = await fetch(webhookURL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
			signal: controller.signal,
		});
		const body = await response.text();
		return { status: response.status, body };
	} catch (error) {
		throw new Error(`Webhook送信失敗: ${formatError(error)}`);
	} finally {
		clearTimeout(timeout);
		signal?.removeEventListener("abort", abort);
	}
}

/**
 * Chooses webhook username and avatar from the feed URL.
 */
function resolveWebhookIdentity(feedURL: string): WebhookIdentity {
	try {
		const url = new URL(feedURL);
		if (url.hostname === "github.com") {
			return { username: "GitHub", avatarURL: githubAvatarURL };
		}
	} catch {
		return { username: "RSS", avatarURL: rssAvatarURL };
	}

	return { username: "RSS", avatarURL: rssAvatarURL };
}

/**
 * Parses Discord's rate limit response.
 */
function parseRateLimit(body: string): RateLimitResponse {
	try {
		const parsed = JSON.parse(body) as RateLimitResponse;
		return parsed;
	} catch {
		return {};
	}
}

/**
 * Checks whether a Discord HTTP response indicates success.
 */
function isSuccessStatus(code: number): boolean {
	return code === 204 || (code >= 200 && code < 300);
}

/**
 * Truncates Unicode text to a Discord limit.
 */
function truncate(text: string, max: number): string {
	const chars = Array.from(text);
	if (chars.length <= max) {
		return text;
	}
	return `${chars.slice(0, max - 3).join("")}...`;
}

/**
 * Removes HTML tags and decodes common HTML entities.
 */
function stripHTML(value: string): string {
	return decodeEntities(value.replaceAll(/<[^>]*>/g, ""));
}

/**
 * Decodes the HTML entities commonly found in RSS descriptions.
 */
function decodeEntities(value: string): string {
	return value
		.replaceAll("&amp;", "&")
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'")
		.replaceAll("&apos;", "'");
}

/**
 * Formats unknown webhook errors.
 */
function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
