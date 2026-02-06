import type {
	DiscordEmbed,
	DiscordWebhookPayload,
	FeedConfig,
	FeedItem,
} from "./types.ts";

const TITLE_MAX = 256;
const DESCRIPTION_MAX = 4096;

function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max - 3)}...`;
}

function stripHtml(html: string): string {
	return html.replace(/<[^>]*>/g, "").trim();
}

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

export async function sendToDiscord(
	webhookUrl: string,
	embed: DiscordEmbed,
): Promise<void> {
	const payload: DiscordWebhookPayload = { embeds: [embed] };

	const response = await fetch(webhookUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

	if (response.status === 429) {
		const body = (await response.json()) as { retry_after: number };
		const waitMs = (body.retry_after ?? 1) * 1000;
		console.warn(`Rate limited. Waiting ${waitMs}ms...`);
		await Bun.sleep(waitMs);

		const retry = await fetch(webhookUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (!retry.ok && retry.status !== 204) {
			throw new Error(
				`Discord webhook failed after retry: HTTP ${retry.status}`,
			);
		}
		return;
	}

	if (response.status === 204 || response.ok) {
		return;
	}

	const errorText = await response.text();
	throw new Error(
		`Discord webhook error: HTTP ${response.status} - ${errorText}`,
	);
}
