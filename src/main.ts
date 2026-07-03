#!/usr/bin/env node
import { setTimeout as delay } from "node:timers/promises";
import packageJSON from "../package.json" with { type: "json" };
import { loadConfig } from "./config.js";
import { buildEmbed, sendWebhook } from "./discord.js";
import { fetchFeed } from "./feed.js";
import { logger } from "./logger.js";
import { Store } from "./store.js";
import type { FeedConfig, FeedItem } from "./types.js";

/**
 * Delay between Discord webhook sends.
 */
const sendDelayMs = 600;

/**
 * Number of sent item IDs retained for each feed.
 */
const maxHistory = 200;

/**
 * Sent item store path.
 */
const storePath = "data/sent.json";

/**
 * Application version filled by package metadata.
 */
const version = packageJSON.version;

/**
 * Parsed command-line arguments.
 */
interface CliArgs {
	/**
	 * Config file path.
	 */
	configPath: string;
	/**
	 * Whether to process each feed once and exit.
	 */
	runOnce: boolean;
}

/**
 * Prints the application banner.
 */
function printBanner(): void {
	process.stdout.write("\u001B]0;RSS Discord\u0007");
	console.log(`
  RSS Discord ${version}
`);
}

/**
 * Parses CLI arguments.
 */
function parseArgs(args: string[]): CliArgs {
	let configPath = "config.json";
	let runOnce = false;

	for (const arg of args) {
		if (arg === "--once") {
			runOnce = true;
		} else if (!arg.startsWith("--")) {
			configPath = arg;
		}
	}

	return { configPath, runOnce };
}

/**
 * Runs the CLI.
 */
async function main(): Promise<void> {
	printBanner();
	const args = parseArgs(process.argv.slice(2));
	await run(args.configPath, args.runOnce);
}

/**
 * Loads config and runs either one-shot processing or polling.
 */
async function run(configPath: string, runOnce: boolean): Promise<void> {
	const config = await loadConfig(configPath);
	const store = new Store(storePath, maxHistory);
	await store.load();

	logger.info("設定読み込み完了", {
		feeds: config.feeds.length,
		config: configPath,
	});

	const controller = new AbortController();
	process.once("SIGINT", () => controller.abort());
	process.once("SIGTERM", () => controller.abort());

	if (runOnce) {
		await Promise.all(
			config.feeds.map((feedConfig) =>
				processFeed(feedConfig, store, controller.signal),
			),
		);
		logger.info("Done.");
		return;
	}

	logger.info("ポーリング開始 (Ctrl+C で停止)");
	await Promise.all(
		config.feeds.map((feedConfig) =>
			startPolling(feedConfig, store, controller.signal),
		),
	);
	logger.info("シャットダウン完了");
}

/**
 * Starts the polling loop for a single feed.
 */
async function startPolling(
	feedConfig: FeedConfig,
	store: Store,
	signal: AbortSignal,
): Promise<void> {
	const intervalMs = feedConfig.intervalMinutes * 60 * 1000;
	logger.info("ポーリング開始", {
		feed: feedConfig.name,
		interval: feedConfig.intervalMinutes,
	});

	await processFeed(feedConfig, store, signal);

	while (!signal.aborted) {
		try {
			await delay(intervalMs, undefined, { signal });
		} catch {
			return;
		}
		await processFeed(feedConfig, store, signal);
	}
}

/**
 * Fetches and sends all new items for a feed.
 */
async function processFeed(
	feedConfig: FeedConfig,
	store: Store,
	signal: AbortSignal,
): Promise<void> {
	logger.info("Fetching...", { feed: feedConfig.name });

	let items: FeedItem[];
	try {
		items = await fetchFeed(feedConfig.url);
	} catch (error) {
		logger.error("フィード取得失敗", { feed: feedConfig.name, error });
		return;
	}

	const newItems = items.filter(
		(item) => item.id !== "" && !store.hasSent(feedConfig.url, item.id),
	);
	if (newItems.length === 0) {
		logger.info("No new items.", { feed: feedConfig.name });
		return;
	}

	logger.info("新着アイテム検出", {
		feed: feedConfig.name,
		count: newItems.length,
	});

	for (const item of newItems.reverse()) {
		if (signal.aborted) {
			return;
		}

		const embed = buildEmbed(item, feedConfig);
		try {
			await sendWebhook(feedConfig.webhookUrl, embed, feedConfig.url, signal);
			await store.markSent(feedConfig.url, item.id);
			logger.info("Sent", { feed: feedConfig.name, title: item.title });
		} catch (error) {
			logger.error("送信失敗", {
				feed: feedConfig.name,
				title: item.title,
				error,
			});
			return;
		}

		try {
			await delay(sendDelayMs, undefined, { signal });
		} catch {
			return;
		}
	}
}

main().catch((error: unknown) => {
	logger.error("致命的なエラー", { error });
	process.exitCode = 1;
});
