import { resolve } from "node:path";
import { loadConfig } from "./config";
import { buildEmbed, sendToDiscord } from "./discord";
import { fetchFeed } from "./feed";
import { Store } from "./store";
import type { FeedConfig } from "./types";

/**
 * @description 各アイテム送信間の待機時間(ms)
 */
const SEND_DELAY_MS = 600;

/**
 * @description フィードごとの送信済みID最大保持数
 */
const MAX_HISTORY = 200;

/**
 * @description 送信済みストアのファイルパス
 */
const STORE_PATH = resolve("data", "sent.json");

/**
 * @description フィードを取得し未送信アイテムをDiscordに送信する
 * @param feedConfig - フィード設定
 * @param store - 送信済みストア
 */
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
			await sendToDiscord(feedConfig.webhookUrl, embed, feedConfig.url);
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

/**
 * @description CLIのタイトルバナーとウィンドウタイトルを表示する
 */
function printTitle(): void {
	process.stdout.write("\x1b]0;RSS Discord\x07");
	const title = `
  ╦═╗╔═╗╔═╗  ╔╦╗┬┌─┐┌─┐┌─┐┬─┐┌┬┐
  ╠╦╝╚═╗╚═╗   ║║│└─┐│  │ │├┬┘ ││
  ╩╚═╚═╝╚═╝  ═╩╝┴└─┘└─┘└─┘┴└──┴┘  v${process.env.npm_package_version ?? "1.0.0"}
`;
	console.log(title);
}

/**
 * @description processFeedのエラーをログ出力するラッパーを返す
 * @param feed - フィード設定
 * @param store - 送信済みストア
 */
function runFeedWithErrorLog(feed: FeedConfig, store: Store): () => void {
	return () => {
		processFeed(feed, store).catch((err) =>
			console.error(`[${feed.name}] Error:`, err),
		);
	};
}

/**
 * @description アプリケーションのエントリポイント
 */
async function main(): Promise<void> {
	printTitle();
	const args = process.argv.slice(2);
	const configPath = args.find((a) => !a.startsWith("--")) ?? "config.json";
	const runOnce = args.includes("--once");

	const config = await loadConfig(configPath);

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
		const intervalMs = feed.intervalMinutes * 60 * 1000;
		console.log(`[${feed.name}] Polling every ${feed.intervalMinutes}min`);

		const run = runFeedWithErrorLog(feed, store);
		run();
		setInterval(run, intervalMs);
	}

	console.log("Polling started. Press Ctrl+C to stop.");
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
