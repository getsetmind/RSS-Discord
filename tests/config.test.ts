import { describe, expect, test } from "bun:test";
import { loadConfig } from "../src/config.js";

/**
 * Valid Discord webhook URL used in config tests.
 */
const webhookURL = "https://discord.com/api/webhooks/123/token";

/**
 * Valid RSS feed URL used in config tests.
 */
const feedURL = "https://example.com/feed.xml";

describe("loadConfig", () => {
	test("loads indexed feed environment variables in numeric order", () => {
		const loaded = loadConfig({
			RSS_DISCORD_FEEDS_10_NAME: "Tenth",
			RSS_DISCORD_FEEDS_10_URL: "https://example.com/10.xml",
			RSS_DISCORD_FEEDS_10_WEBHOOK_URL: webhookURL,
			RSS_DISCORD_FEEDS_2_NAME: "Second",
			RSS_DISCORD_FEEDS_2_URL: "https://example.com/2.xml",
			RSS_DISCORD_FEEDS_2_WEBHOOK_URL: webhookURL,
		});

		expect(loaded.source).toBe("environment:indexed-feeds");
		expect(loaded.config.feeds.map((feed) => feed.name)).toEqual([
			"Second",
			"Tenth",
		]);
	});

	test("uses human-editable defaults for optional feed fields", () => {
		const loaded = loadConfig({
			RSS_DISCORD_FEEDS_1_URL: feedURL,
			RSS_DISCORD_FEEDS_1_WEBHOOK_URL: webhookURL,
		});

		expect(loaded.config.feeds[0]).toEqual({
			name: "Feed 1",
			url: feedURL,
			webhookUrl: webhookURL,
			color: 3447003,
			intervalMinutes: 5,
		});
	});

	test("rejects missing feed configuration", () => {
		expect(() => loadConfig({})).toThrow("設定が見つかりません");
	});

	test("rejects invalid URLs with config-like paths", () => {
		expect(() =>
			loadConfig({
				RSS_DISCORD_FEEDS_1_NAME: "Broken",
				RSS_DISCORD_FEEDS_1_URL: "not-a-url",
				RSS_DISCORD_FEEDS_1_WEBHOOK_URL: webhookURL,
			}),
		).toThrow("feeds.0.url");
	});

	test("rejects non-Discord webhook URLs", () => {
		expect(() =>
			loadConfig({
				RSS_DISCORD_FEEDS_1_NAME: "Broken",
				RSS_DISCORD_FEEDS_1_URL: feedURL,
				RSS_DISCORD_FEEDS_1_WEBHOOK_URL: "https://example.com/webhook",
			}),
		).toThrow("feeds.0.webhookUrl");
	});

	test("rejects invalid numeric values", () => {
		expect(() =>
			loadConfig({
				RSS_DISCORD_FEEDS_1_URL: feedURL,
				RSS_DISCORD_FEEDS_1_WEBHOOK_URL: webhookURL,
				RSS_DISCORD_FEEDS_1_COLOR: "-1",
				RSS_DISCORD_FEEDS_1_INTERVAL_MINUTES: "0",
			}),
		).toThrow("feeds.0.color");
	});
});
