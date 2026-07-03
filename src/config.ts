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
export function loadConfig(
	env: ConfigEnv = process.env,
): LoadedConfig {
	const envConfig = loadConfigFromEnv(env);
	if (envConfig !== undefined) {
		return envConfig;
	}

	throw new Error(
		"設定が見つかりません。RSS_DISCORD_CONFIG_JSON、RSS_DISCORD_CONFIG_BASE64、または単一フィード用の RSS_DISCORD_FEED_URL と RSS_DISCORD_WEBHOOK_URL を設定してください",
	);
}

/**
 * Loads configuration from supported environment variables.
 */
function loadConfigFromEnv(env: ConfigEnv): LoadedConfig | undefined {
	const json = getFirstEnv(env, [
		"RSS_DISCORD_CONFIG_JSON",
		"RSS_DISCORD_FEEDS_JSON",
	]);
	if (json !== undefined) {
		const config = parseEnvJSON(json, "RSS_DISCORD_CONFIG_JSON");
		return { config, source: "environment:RSS_DISCORD_CONFIG_JSON" };
	}

	const base64 = getFirstEnv(env, ["RSS_DISCORD_CONFIG_BASE64"]);
	if (base64 !== undefined) {
		const decoded = Buffer.from(base64, "base64").toString("utf8");
		const config = parseEnvJSON(decoded, "RSS_DISCORD_CONFIG_BASE64");
		return { config, source: "environment:RSS_DISCORD_CONFIG_BASE64" };
	}

	const singleFeed = parseSingleFeedEnv(env);
	if (singleFeed !== undefined) {
		const config = { feeds: [singleFeed] };
		validateConfig(config);
		return { config, source: "environment:single-feed" };
	}

	return undefined;
}

/**
 * Parses a JSON environment variable into an application config.
 */
function parseEnvJSON(raw: string, source: string): AppConfig {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (error) {
		throw new Error(`${source} のJSONパースに失敗: ${formatError(error)}`);
	}

	const config = Array.isArray(parsed)
		? { feeds: parsed.map((feed) => parseFeedConfig(feed)) }
		: parseAppConfig(parsed);
	validateConfig(config);
	return config;
}

/**
 * Parses simple single-feed environment variables.
 */
function parseSingleFeedEnv(env: ConfigEnv): FeedConfig | undefined {
	const url = getFirstEnv(env, ["RSS_DISCORD_FEED_URL", "FEED_URL"]);
	const webhookUrl = getFirstEnv(env, [
		"RSS_DISCORD_WEBHOOK_URL",
		"DISCORD_WEBHOOK_URL",
		"WEBHOOK_URL",
	]);
	if (url === undefined && webhookUrl === undefined) {
		return undefined;
	}

	return {
		name: getFirstEnv(env, ["RSS_DISCORD_FEED_NAME", "FEED_NAME"]) ?? "RSS",
		url: url ?? "",
		webhookUrl: webhookUrl ?? "",
		color: parseEnvNumber(
			getFirstEnv(env, ["RSS_DISCORD_COLOR", "EMBED_COLOR"]),
			3447003,
		),
		intervalMinutes: parseEnvNumber(
			getFirstEnv(env, [
				"RSS_DISCORD_INTERVAL_MINUTES",
				"INTERVAL_MINUTES",
			]),
			5,
		),
	};
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
 * Converts unknown JSON into the expected application config shape.
 */
function parseAppConfig(value: unknown): AppConfig {
	if (!isRecord(value) || !Array.isArray(value.feeds)) {
		throw new Error("設定バリデーションエラー: feeds は1件以上必要です");
	}

	return {
		feeds: value.feeds.map((feed) => parseFeedConfig(feed)),
	};
}

/**
 * Converts one unknown feed JSON object into a feed config.
 */
function parseFeedConfig(value: unknown): FeedConfig {
	if (!isRecord(value)) {
		return {
			name: "",
			url: "",
			webhookUrl: "",
			color: -1,
			intervalMinutes: 0,
		};
	}

	return {
		name: typeof value.name === "string" ? value.name : "",
		url: typeof value.url === "string" ? value.url : "",
		webhookUrl: typeof value.webhookUrl === "string" ? value.webhookUrl : "",
		color: typeof value.color === "number" ? value.color : -1,
		intervalMinutes:
			typeof value.intervalMinutes === "number" ? value.intervalMinutes : 0,
	};
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

/**
 * Narrows unknown values to records.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/**
 * Formats unknown errors for nested Japanese messages.
 */
function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
