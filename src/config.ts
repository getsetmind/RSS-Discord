import type { AppConfig, FeedConfig } from "./types.js";

/**
 * Environment variables used for configuration.
 */
type ConfigEnv = Record<string, string | undefined>;

/**
 * Loaded application configuration with source metadata.
 */
export interface LoadedConfig {
	/**
	 * Validated application configuration.
	 */
	config: AppConfig;
	/**
	 * Human-readable source used in logs.
	 */
	source: string;
}

/**
 * Loads configuration from environment variables.
 */
export function loadConfig(env: ConfigEnv = process.env): LoadedConfig {
	const envConfig = loadConfigFromEnv(env);
	if (envConfig !== undefined) {
		return envConfig;
	}

	throw new Error(
		"設定が見つかりません。RSS_DISCORD_FEEDS_1_URL と RSS_DISCORD_FEEDS_1_WEBHOOK_URL を設定してください",
	);
}

/**
 * Loads configuration from supported environment variables.
 */
function loadConfigFromEnv(env: ConfigEnv): LoadedConfig | undefined {
	const indexedFeeds = parseIndexedFeedEnv(env);
	if (indexedFeeds.length > 0) {
		const config = { feeds: indexedFeeds };
		validateConfig(config);
		return { config, source: "environment:indexed-feeds" };
	}

	return undefined;
}

/**
 * Parses numbered feed environment variables.
 */
function parseIndexedFeedEnv(env: ConfigEnv): FeedConfig[] {
	const indexes = findFeedIndexes(env);
	return indexes.map((index) => ({
		name:
			getFirstEnv(env, [`RSS_DISCORD_FEEDS_${index}_NAME`]) ?? `Feed ${index}`,
		url: getFirstEnv(env, [`RSS_DISCORD_FEEDS_${index}_URL`]) ?? "",
		webhookUrl:
			getFirstEnv(env, [`RSS_DISCORD_FEEDS_${index}_WEBHOOK_URL`]) ?? "",
		color: parseEnvNumber(
			getFirstEnv(env, [`RSS_DISCORD_FEEDS_${index}_COLOR`]),
			3447003,
		),
		intervalMinutes: parseEnvNumber(
			getFirstEnv(env, [`RSS_DISCORD_FEEDS_${index}_INTERVAL_MINUTES`]),
			5,
		),
	}));
}

/**
 * Finds indexes used by numbered feed environment variables.
 */
function findFeedIndexes(env: ConfigEnv): number[] {
	const indexes = new Set<number>();
	const pattern =
		/^RSS_DISCORD_FEEDS_(\d+)_(?:NAME|URL|WEBHOOK_URL|COLOR|INTERVAL_MINUTES)$/;

	for (const key of Object.keys(env)) {
		const match = pattern.exec(key);
		if (match?.[1] !== undefined) {
			indexes.add(Number(match[1]));
		}
	}

	return [...indexes].sort((a, b) => a - b);
}

/**
 * Finds the first non-empty environment variable from a list.
 */
function getFirstEnv(env: ConfigEnv, names: string[]): string | undefined {
	for (const name of names) {
		const value = env[name]?.trim();
		if (value !== undefined && value !== "") {
			return value;
		}
	}
	return undefined;
}

/**
 * Parses a numeric environment variable with a fallback.
 */
function parseEnvNumber(value: string | undefined, fallback: number): number {
	if (value === undefined) {
		return fallback;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/**
 * Validates all feed settings and throws a Japanese error message on failure.
 */
function validateConfig(config: AppConfig): void {
	if (config.feeds.length === 0) {
		throw new Error("設定バリデーションエラー: feeds は1件以上必要です");
	}

	config.feeds.forEach((feed, index) => {
		validateFeedConfig(feed, index);
	});
}

/**
 * Validates one feed definition.
 */
function validateFeedConfig(feed: FeedConfig, index: number): void {
	if (feed.name.trim() === "") {
		throw new Error(
			`設定バリデーションエラー: feeds[${index}].name は空にできません`,
		);
	}

	if (!isValidURL(feed.url)) {
		throw new Error(
			`設定バリデーションエラー: feeds[${index}].url が不正です: ${feed.url}`,
		);
	}

	if (!feed.webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
		throw new Error(
			`設定バリデーションエラー: feeds[${index}].webhookUrl は https://discord.com/api/webhooks/ で始まる必要があります`,
		);
	}

	if (feed.color < 0) {
		throw new Error(
			`設定バリデーションエラー: feeds[${index}].color は0以上である必要があります`,
		);
	}

	if (feed.intervalMinutes <= 0) {
		throw new Error(
			`設定バリデーションエラー: feeds[${index}].intervalMinutes は正の数である必要があります`,
		);
	}
}

/**
 * Checks whether a string is an absolute URL.
 */
function isValidURL(value: string): boolean {
	try {
		const parsed = new URL(value);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}
