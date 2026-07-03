import { afterEach, describe, expect, test } from "bun:test";
import {
	buildEmbed,
	sendWebhook,
	setWebhookDependencies,
} from "../src/discord.js";
import type { FeedConfig, FeedItem } from "../src/types.js";

/**
 * Feed config used by embed tests.
 */
const feedConfig: FeedConfig = {
	name: "Example Feed",
	url: "https://example.com/feed.xml",
	webhookUrl: "https://discord.com/api/webhooks/123/token",
	color: 3447003,
	intervalMinutes: 5,
};

/**
 * Restores webhook dependencies after each test.
 */
let restoreWebhookDependencies: (() => void) | undefined;

afterEach(() => {
	restoreWebhookDependencies?.();
	restoreWebhookDependencies = undefined;
});

/**
 * Creates a feed item for embed tests.
 */
function createFeedItem(overrides: Partial<FeedItem> = {}): FeedItem {
	return {
		id: "item-1",
		title: "Example Entry",
		link: "https://example.com/posts/1",
		description: "Hello",
		pubDate: "2026-07-03T00:00:00.000Z",
		author: "Author",
		...overrides,
	};
}

describe("buildEmbed", () => {
	test("builds a Discord embed from a feed item", () => {
		const embed = buildEmbed(createFeedItem(), feedConfig);

		expect(embed).toMatchObject({
			title: "Example Entry",
			url: "https://example.com/posts/1",
			color: 3447003,
			timestamp: "2026-07-03T00:00:00.000Z",
			author: { name: "Example Feed" },
			footer: { text: "via Example Feed" },
		});
	});

	test("strips basic HTML and decodes common entities", () => {
		const embed = buildEmbed(
			createFeedItem({
				description: "<p>Tom &amp; Jerry &lt;3</p>",
			}),
			feedConfig,
		);

		expect(embed.description).toBe("Tom & Jerry <3");
	});

	test("truncates long titles to Discord's title limit", () => {
		const embed = buildEmbed(
			createFeedItem({
				title: "x".repeat(300),
			}),
			feedConfig,
		);

		expect(embed.title).toHaveLength(256);
		expect(embed.title?.endsWith("...")).toBe(true);
	});

	test("omits invalid timestamps", () => {
		const embed = buildEmbed(
			createFeedItem({
				pubDate: "not-a-date",
			}),
			feedConfig,
		);

		expect(embed.timestamp).toBeUndefined();
	});

	test("keeps short titles unchanged", () => {
		const embed = buildEmbed(createFeedItem({ title: "short" }), feedConfig);

		expect(embed.title).toBe("short");
	});
});

describe("sendWebhook", () => {
	test("sends a generic RSS webhook payload", async () => {
		const requests: unknown[] = [];
		restoreWebhookDependencies = setWebhookDependencies({
			fetch: async (_url, init) => {
				requests.push(JSON.parse(String(init?.body)));
				return new Response("", { status: 204 });
			},
		});

		await sendWebhook(
			feedConfig.webhookUrl,
			buildEmbed(createFeedItem(), feedConfig),
			"https://example.com/feed.xml",
		);

		expect(requests).toHaveLength(1);
		expect(requests[0]).toMatchObject({
			username: "RSS",
			embeds: [{ title: "Example Entry" }],
		});
	});

	test("uses GitHub identity for GitHub feeds", async () => {
		let payload: unknown;
		restoreWebhookDependencies = setWebhookDependencies({
			fetch: async (_url, init) => {
				payload = JSON.parse(String(init?.body));
				return new Response("", { status: 204 });
			},
		});

		await sendWebhook(
			feedConfig.webhookUrl,
			buildEmbed(createFeedItem(), feedConfig),
			"https://github.com/oven-sh/bun/releases.atom",
		);

		expect(payload).toMatchObject({
			username: "GitHub",
			avatar_url: "https://github.com/github.png",
		});
	});

	test("retries once after a Discord rate limit", async () => {
		const statuses = [429, 204];
		const waits: number[] = [];
		restoreWebhookDependencies = setWebhookDependencies({
			fetch: async () =>
				new Response(JSON.stringify({ retry_after: 0.25 }), {
					status: statuses.shift() ?? 204,
				}),
			delay: async (ms) => {
				waits.push(ms ?? 0);
			},
		});

		await sendWebhook(
			feedConfig.webhookUrl,
			buildEmbed(createFeedItem(), feedConfig),
			feedConfig.url,
		);

		expect(waits).toEqual([250]);
	});

	test("uses a one-second fallback for invalid rate limit bodies", async () => {
		const statuses = [429, 204];
		const waits: number[] = [];
		restoreWebhookDependencies = setWebhookDependencies({
			fetch: async () =>
				new Response("not-json", { status: statuses.shift() ?? 204 }),
			delay: async (ms) => {
				waits.push(ms ?? 0);
			},
		});

		await sendWebhook(
			feedConfig.webhookUrl,
			buildEmbed(createFeedItem(), feedConfig),
			feedConfig.url,
		);

		expect(waits).toEqual([1000]);
	});

	test("throws when retry after rate limit still fails", async () => {
		const statuses = [429, 500];
		restoreWebhookDependencies = setWebhookDependencies({
			fetch: async () =>
				new Response("error", { status: statuses.shift() ?? 500 }),
			delay: async () => {},
		});

		await expect(
			sendWebhook(
				feedConfig.webhookUrl,
				buildEmbed(createFeedItem(), feedConfig),
				feedConfig.url,
			),
		).rejects.toThrow("Discord webhook failed after retry");
	});

	test("throws on non-success Discord responses", async () => {
		restoreWebhookDependencies = setWebhookDependencies({
			fetch: async () => new Response("nope", { status: 500 }),
		});

		await expect(
			sendWebhook(
				feedConfig.webhookUrl,
				buildEmbed(createFeedItem(), feedConfig),
				feedConfig.url,
			),
		).rejects.toThrow("Discord webhook error: HTTP 500 - nope");
	});

	test("wraps fetch errors", async () => {
		restoreWebhookDependencies = setWebhookDependencies({
			fetch: async () => {
				throw new Error("network down");
			},
		});

		await expect(
			sendWebhook(
				feedConfig.webhookUrl,
				buildEmbed(createFeedItem(), feedConfig),
				"not a url",
			),
		).rejects.toThrow("Webhook送信失敗: network down");
	});

	test("aborts an in-flight webhook when the caller signal aborts", async () => {
		const controller = new AbortController();
		restoreWebhookDependencies = setWebhookDependencies({
			fetch: async (_url, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						reject(new Error("aborted"));
					});
					controller.abort();
				}),
		});

		await expect(
			sendWebhook(
				feedConfig.webhookUrl,
				buildEmbed(createFeedItem(), feedConfig),
				feedConfig.url,
				controller.signal,
			),
		).rejects.toThrow("Webhook送信失敗: aborted");
	});
});
