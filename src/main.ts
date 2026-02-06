import { resolve } from "node:path";
import { loadConfig } from "./config.ts";
import { buildEmbed, sendToDiscord } from "./discord.ts";
import { fetchFeed } from "./feed.ts";
import { Store } from "./store.ts";
import type { FeedConfig } from "./types.ts";

const SEND_DELAY_MS = 600;
const MAX_HISTORY = 200;
const STORE_PATH = resolve("data", "sent.json");

async function testFeed(feedConfig: FeedConfig): Promise<void> {
	console.log(`[${feedConfig.name}] Fetching for test...`);

	const items = await fetchFeed(feedConfig.url);
	if (items.length === 0) {
		console.log(`[${feedConfig.name}] No items in feed.`);
		return;
	}

	const item = items[0];
	if (!item) {
		console.log(`[${feedConfig.name}] No items in feed.`);
		return;
	}
	const embed = buildEmbed(item, feedConfig, feedConfig.color);
	await sendToDiscord(feedConfig.webhookUrl, embed);
	console.log(`[${feedConfig.name}] Test sent: ${item.title}`);
}

async function processFeed(
	feedConfig: FeedConfig,
	store: Store,
): Promise<void> {
	console.log(`[${feedConfig.name}] Fetching...`);

	const items = await fetchFeed(feedConfig.url);
	const newItems = items.filter(
		(item) => item.id && !store.hasSent(feedConfig.url, item.id),
	);

	if (newItems.length === 0) {
		console.log(`[${feedConfig.name}] No new items.`);
		return;
	}

	console.log(`[${feedConfig.name}] ${newItems.length} new item(s) found.`);

	// 古い順に送信して、Discordでの表示が時系列順になるようにする
	for (const item of newItems.reverse()) {
		try {
			const embed = buildEmbed(item, feedConfig, feedConfig.color);
			await sendToDiscord(feedConfig.webhookUrl, embed);
			await store.markSent(feedConfig.url, item.id);
			console.log(`[${feedConfig.name}] Sent: ${item.title}`);
			await Bun.sleep(SEND_DELAY_MS);
		} catch (err) {
			console.error(
				`[${feedConfig.name}] Failed to send "${item.title}":`,
				err,
			);
			break;
		}
	}
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const configPath = args.find((a) => !a.startsWith("--")) ?? "config.json";
	const runOnce = args.includes("--once");
	const runTest = args.includes("--test");

	const config = await loadConfig(configPath);

	if (runTest) {
		await Promise.allSettled(config.feeds.map((feed) => testFeed(feed)));
		console.log("Test done.");
		return;
	}

	const store = new Store(STORE_PATH, MAX_HISTORY);
	await store.load();

	console.log(`Loaded ${config.feeds.length} feed(s) from ${configPath}`);

	if (runOnce) {
		await Promise.allSettled(
			config.feeds.map((feed) => processFeed(feed, store)),
		);
		console.log("Done.");
		return;
	}

	for (const feed of config.feeds) {
		const interval = feed.intervalMinutes * 60 * 1000;
		console.log(`[${feed.name}] Polling every ${feed.intervalMinutes}min`);

		processFeed(feed, store).catch((err) =>
			console.error(`[${feed.name}] Error:`, err),
		);

		setInterval(() => {
			processFeed(feed, store).catch((err) =>
				console.error(`[${feed.name}] Error:`, err),
			);
		}, interval);
	}

	console.log("Polling started. Press Ctrl+C to stop.");
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
