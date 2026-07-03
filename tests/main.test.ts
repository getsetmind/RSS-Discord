import { describe, expect, test } from "bun:test";
import {
	type AppDependencies,
	main,
	parseArgs,
	processFeed,
	run,
	type SentStore,
	startPolling,
} from "../src/main.js";
import type { Embed, FeedConfig, FeedItem } from "../src/types.js";

/**
 * Feed config used by main workflow tests.
 */
const feedConfig: FeedConfig = {
	name: "Example",
	url: "https://example.com/feed.xml",
	webhookUrl: "https://discord.com/api/webhooks/123/token",
	color: 3447003,
	intervalMinutes: 0.001,
};

/**
 * Creates a feed item for workflow tests.
 */
function createItem(overrides: Partial<FeedItem> = {}): FeedItem {
	return {
		id: "item-1",
		title: "Item",
		link: "https://example.com/item",
		description: "",
		pubDate: "",
		author: "",
		...overrides,
	};
}

/**
 * In-memory sent store for workflow tests.
 */
class MemoryStore implements SentStore {
	/**
	 * Sent item IDs keyed by feed URL.
	 */
	public readonly sent = new Map<string, Set<string>>();

	/**
	 * Load call count.
	 */
	public loadCount = 0;

	public async load(): Promise<void> {
		this.loadCount += 1;
	}

	public hasSent(feedURL: string, itemID: string): boolean {
		return this.sent.get(feedURL)?.has(itemID) ?? false;
	}

	public async markSent(feedURL: string, itemID: string): Promise<void> {
		const ids = this.sent.get(feedURL) ?? new Set<string>();
		ids.add(itemID);
		this.sent.set(feedURL, ids);
	}
}

/**
 * Creates default dependencies for workflow tests.
 */
function createDependencies(
	overrides: Partial<AppDependencies> = {},
): AppDependencies & {
	store: MemoryStore;
	logs: string[];
	webhooks: Embed[];
} {
	const store = new MemoryStore();
	const logs: string[] = [];
	const webhooks: Embed[] = [];
	const dependencies: AppDependencies & {
		store: MemoryStore;
		logs: string[];
		webhooks: Embed[];
	} = {
		store,
		logs,
		webhooks,
		loadConfig: () => ({
			config: { feeds: [feedConfig] },
			source: "test",
		}),
		createStore: () => store,
		fetchFeed: async () => [createItem()],
		buildEmbed: (item) => ({ title: item.title }),
		sendWebhook: async (_webhookURL, embed) => {
			webhooks.push(embed);
		},
		delay: async (_ms, _value, options) => {
			if (options?.signal?.aborted) {
				throw new Error("aborted");
			}
		},
		logger: {
			info: (message: string) => logs.push(`info:${message}`),
			warn: (message: string) => logs.push(`warn:${message}`),
			error: (message: string) => logs.push(`error:${message}`),
		},
		...overrides,
	};
	return dependencies;
}

describe("parseArgs", () => {
	test("detects one-shot mode", () => {
		expect(parseArgs(["--once"])).toEqual({ runOnce: true });
	});

	test("ignores positional arguments and unknown flags", () => {
		expect(parseArgs(["config.json", "--unknown"])).toEqual({
			runOnce: false,
		});
	});
});

describe("run", () => {
	test("processes configured feeds once", async () => {
		const dependencies = createDependencies();

		await run(true, dependencies);

		expect(dependencies.store.loadCount).toBe(1);
		expect(dependencies.webhooks).toEqual([{ title: "Item" }]);
		expect(dependencies.logs).toContain("info:Done.");
	});

	test("starts polling until aborted", async () => {
		const controller = new AbortController();
		let delayCount = 0;
		let fetchCount = 0;
		const dependencies = createDependencies({
			fetchFeed: async () => {
				fetchCount += 1;
				return [createItem({ id: `item-${fetchCount}` })];
			},
			delay: async (_ms, _value, options) => {
				if (_ms !== 600) {
					delayCount += 1;
					if (delayCount > 1) {
						controller.abort();
						options?.signal?.throwIfAborted();
					}
				}
			},
		});

		await startPolling(
			feedConfig,
			dependencies.store,
			controller.signal,
			dependencies,
		);

		expect(dependencies.webhooks).toHaveLength(2);
	});

	test("runs polling mode until polling stops", async () => {
		const dependencies = createDependencies({
			delay: async () => {
				throw new Error("stop");
			},
		});

		await run(false, dependencies);

		expect(dependencies.logs).toContain("info:ポーリング開始 (Ctrl+C で停止)");
		expect(dependencies.logs).toContain("info:シャットダウン完了");
	});

	test("stops polling when SIGINT is received", async () => {
		let emitted = false;
		const dependencies = createDependencies({
			delay: async (_ms, _value, options) => {
				if (!emitted) {
					emitted = true;
					process.emit("SIGINT");
				}
				options?.signal?.throwIfAborted();
			},
		});

		await run(false, dependencies);

		expect(dependencies.logs).toContain("info:シャットダウン完了");
	});

	test("stops polling when SIGTERM is received", async () => {
		let emitted = false;
		const dependencies = createDependencies({
			delay: async (_ms, _value, options) => {
				if (!emitted) {
					emitted = true;
					process.emit("SIGTERM");
				}
				options?.signal?.throwIfAborted();
			},
		});

		await run(false, dependencies);

		expect(dependencies.logs).toContain("info:シャットダウン完了");
	});

	test("runs through main with injected dependencies", async () => {
		const dependencies = createDependencies();

		await main(["--once"], dependencies);

		expect(dependencies.webhooks).toHaveLength(1);
	});
});

describe("processFeed", () => {
	test("logs fetch errors", async () => {
		const dependencies = createDependencies({
			fetchFeed: async () => {
				throw new Error("feed down");
			},
		});

		await processFeed(
			feedConfig,
			dependencies.store,
			new AbortController().signal,
			dependencies,
		);

		expect(dependencies.logs).toContain("error:フィード取得失敗");
	});

	test("does nothing when all items were already sent", async () => {
		const dependencies = createDependencies();
		await dependencies.store.markSent(feedConfig.url, "item-1");

		await processFeed(
			feedConfig,
			dependencies.store,
			new AbortController().signal,
			dependencies,
		);

		expect(dependencies.webhooks).toHaveLength(0);
		expect(dependencies.logs).toContain("info:No new items.");
	});

	test("stops before sending when aborted", async () => {
		const dependencies = createDependencies();
		const controller = new AbortController();
		controller.abort();

		await processFeed(
			feedConfig,
			dependencies.store,
			controller.signal,
			dependencies,
		);

		expect(dependencies.webhooks).toHaveLength(0);
	});

	test("stops on webhook errors", async () => {
		const dependencies = createDependencies({
			sendWebhook: async () => {
				throw new Error("webhook down");
			},
		});

		await processFeed(
			feedConfig,
			dependencies.store,
			new AbortController().signal,
			dependencies,
		);

		expect(dependencies.logs).toContain("error:送信失敗");
	});

	test("stops when send delay is aborted", async () => {
		const dependencies = createDependencies({
			delay: async () => {
				throw new Error("aborted");
			},
		});

		await processFeed(
			feedConfig,
			dependencies.store,
			new AbortController().signal,
			dependencies,
		);

		expect(dependencies.webhooks).toHaveLength(1);
	});
});
