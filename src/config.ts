import { readFile } from "node:fs/promises";
import type { AppConfig, FeedConfig } from "./types.js";

/**
 * Loads and validates the application configuration file.
 */
export async function loadConfig(path: string): Promise<AppConfig> {
	let raw: string;
	try {
		raw = await readFile(path, "utf8");
	} catch (error) {
		throw new Error(`設定ファイルの読み込みに失敗: ${formatError(error)}`);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (error) {
		throw new Error(`設定ファイルのパースに失敗: ${formatError(error)}`);
	}

	const config = parseAppConfig(parsed);
	validateConfig(config);
	return config;
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
