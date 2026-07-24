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
 * Creates the default sent-item store.
 */
export function createDefaultStore(): SentStore {
	return new Store(storePath, maxHistory);
}

/**
 * Parsed command-line arguments.
 */
export interface CliArgs {
	/**
	 * Whether to process each feed once and exit.
	 */
	runOnce: boolean;
}

/**
 * Minimal sent-item store contract used by the polling workflow.
 */
export interface SentStore {
	/**
	 * Loads persisted sent item IDs.
	 */
	load(): Promise<void>;
	/**
	 * Checks whether an item has already been sent.
	 */
	hasSent(feedURL: string, itemID: string): boolean;
	/**
	 * Marks an item as sent.
	 */
	markSent(feedURL: string, itemID: string): Promise<void>;
}

/**
 * Dependencies used by the CLI workflow.
 */
export interface AppDependencies {
	/**
	 * Loads application configuration.
	 */
	loadConfig: typeof loadConfig;
	/**
	 * Creates the sent-item store.
	 */
	createStore: () => SentStore;
	/**
	 * Fetches a feed URL.
	 */
	fetchFeed: typeof fetchFeed;
	/**
	 * Builds a Discord embed.
	 */
	buildEmbed: typeof buildEmbed;
	/**
	 * Sends a Discord webhook.
	 */
	sendWebhook: typeof sendWebhook;
	/**
	 * Delay implementation.
	 */
	delay: (
		ms: number,
		value?: undefined,
		options?: { signal?: AbortSignal },
	) => Promise<unknown>;
	/**
	 * Logger implementation.
	 */
	logger: AppLogger;
}

/**
 * Logger contract used by the CLI workflow.
 */
export interface AppLogger {
	/**
	 * Writes an info log.
	 */
	info(message: string, metadata?: Record<string, unknown>): void;
	/**
	 * Writes a warning log.
	 */
	warn(message: string, metadata?: Record<string, unknown>): void;
	/**
	 * Writes an error log.
	 */
	error(message: string, metadata?: Record<string, unknown>): void;
}

/**
 * Result of processing one feed.
 */
export type ProcessFeedResult = "sent" | "no-new-items" | "failed" | "aborted";

/**
 * Default runtime dependencies.
 */
const defaultDependencies: AppDependencies = {
	loadConfig,
	createStore: createDefaultStore,
	fetchFeed,
	buildEmbed,
	sendWebhook,
	delay,
	logger,
};

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
export function parseArgs(args: string[]): CliArgs {
	let runOnce = false;

	for (const arg of args) {
		if (arg === "--once") {
			runOnce = true;
		}
	}

	return { runOnce };
}

/**
 * Runs the CLI.
 */
export async function main(
	args = process.argv.slice(2),
	dependencies = defaultDependencies,
): Promise<void> {
	printBanner();
	const parsedArgs = parseArgs(args);
	await run(parsedArgs.runOnce, dependencies);
}

/**
 * Loads config and runs either one-shot processing or polling.
 */
export async function run(
	runOnce: boolean,
	dependencies = defaultDependencies,
): Promise<void> {
	const { config, source } = dependencies.loadConfig();
	const store = dependencies.createStore();
	await store.load();

	dependencies.logger.info("設定読み込み完了", {
		feeds: config.feeds.length,
		config: source,
	});

	const controller = new AbortController();
	const removeShutdownHandlers = registerShutdownHandlers(controller);

	try {
		if (runOnce) {
			const results = await Promise.all(
				config.feeds.map((feedConfig) =>
					processFeed(feedConfig, store, controller.signal, dependencies),
				),
			);
			if (results.includes("failed")) {
				dependencies.logger.warn("一部フィードの処理に失敗しました");
				return;
			}
			dependencies.logger.info("Done.");
			return;
		}

		dependencies.logger.info("ポーリング開始 (Ctrl+C で停止)");
		await Promise.all(
			config.feeds.map((feedConfig) =>
				startPolling(feedConfig, store, controller.signal, dependencies),
			),
		);
		dependencies.logger.info("シャットダウン完了");
	} finally {
		removeShutdownHandlers();
	}
}

/**
 * Aborts polling for OS signals and FeatherPanel console stop input.
 */
function registerShutdownHandlers(controller: AbortController): () => void {
	const abort = () => controller.abort();
	const handleConsoleInput = (input: string | Buffer) => {
		const command = input.toString();
		if (command.includes("\u0003") || command.trim() === "^C") {
			abort();
		}
	};

	process.once("SIGINT", abort);
	process.once("SIGTERM", abort);
	process.stdin.setEncoding("utf8");
	process.stdin.on("data", handleConsoleInput);

	return () => {
		process.off("SIGINT", abort);
		process.off("SIGTERM", abort);
		process.stdin.off("data", handleConsoleInput);
		process.stdin.pause();
	};
}

/**
 * Starts the polling loop for a single feed.
 */
export async function startPolling(
	feedConfig: FeedConfig,
	store: SentStore,
	signal: AbortSignal,
	dependencies = defaultDependencies,
): Promise<void> {
	const intervalMs = feedConfig.intervalMinutes * 60 * 1000;
	dependencies.logger.info("ポーリング開始", {
		feed: feedConfig.name,
		interval: feedConfig.intervalMinutes,
	});

	await processFeed(feedConfig, store, signal, dependencies);

	while (!signal.aborted) {
		try {
			await dependencies.delay(intervalMs, undefined, { signal });
		} catch {
			return;
		}
		await processFeed(feedConfig, store, signal, dependencies);
	}
}

/**
 * Fetches and sends all new items for a feed.
 */
export async function processFeed(
	feedConfig: FeedConfig,
	store: SentStore,
	signal: AbortSignal,
	dependencies = defaultDependencies,
): Promise<ProcessFeedResult> {
	dependencies.logger.info("Fetching...", { feed: feedConfig.name });

	let items: FeedItem[];
	try {
		items = await dependencies.fetchFeed(feedConfig.url);
	} catch (error) {
		dependencies.logger.error("フィード取得失敗", {
			feed: feedConfig.name,
			error,
		});
		return "failed";
	}

	const newItems = items.filter(
		(item) => item.id !== "" && !store.hasSent(feedConfig.url, item.id),
	);
	if (newItems.length === 0) {
		dependencies.logger.info("No new items.", { feed: feedConfig.name });
		return "no-new-items";
	}

	dependencies.logger.info("新着アイテム検出", {
		feed: feedConfig.name,
		count: newItems.length,
	});

	for (const item of newItems.reverse()) {
		if (signal.aborted) {
			return "aborted";
		}

		const embed = dependencies.buildEmbed(item, feedConfig);
		try {
			await dependencies.sendWebhook(
				feedConfig.webhookUrl,
				embed,
				feedConfig.url,
				signal,
			);
			await store.markSent(feedConfig.url, item.id);
			dependencies.logger.info("Sent", {
				feed: feedConfig.name,
				title: item.title,
			});
		} catch (error) {
			dependencies.logger.error("送信失敗", {
				feed: feedConfig.name,
				title: item.title,
				error,
			});
			return "failed";
		}

		try {
			await dependencies.delay(sendDelayMs, undefined, { signal });
		} catch {
			return "aborted";
		}
	}
	return "sent";
}
