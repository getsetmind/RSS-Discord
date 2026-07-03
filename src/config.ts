import { z } from "zod";
import { migrateLegacyConfigIfNeeded } from "./config-migration.js";
import type { AppConfig, FeedConfig } from "./types.js";

/**
 * Discord webhook URL prefix accepted by Discord.
 */
const discordWebhookPrefix = "https://discord.com/api/webhooks/";

/**
 * Runtime schema for one feed configuration.
 */
const feedConfigSchema = z.object({
	name: z.string().trim().min(1, "name は空にできません"),
	url: z.httpUrl("url が不正です"),
	webhookUrl: z
		.string()
		.trim()
		.startsWith(
			discordWebhookPrefix,
			`webhookUrl は ${discordWebhookPrefix} で始まる必要があります`,
		),
	color: z.int().min(0, "color は0以上である必要があります"),
	intervalMinutes: z
		.number()
		.positive("intervalMinutes は正の数である必要があります"),
});

/**
 * Runtime schema for application configuration.
 */
const appConfigSchema = z.object({
	feeds: z.array(feedConfigSchema).min(1, "feeds は1件以上必要です"),
});

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
	const migration =
		env === process.env
			? migrateLegacyConfigIfNeeded(env)
			: { migrated: false, feedCount: 0 };
	const envConfig = loadConfigFromEnv(env);
	if (envConfig !== undefined) {
		if (migration.migrated) {
			return {
				config: envConfig.config,
				source: "legacy-config-json:migrated-env",
			};
		}
		return envConfig;
	}

	throw new Error(
		"設定が見つかりません。RSS_DISCORD_FEEDS_<番号>_URL と RSS_DISCORD_FEEDS_<番号>_WEBHOOK_URL を設定してください",
	);
}

/**
 * Loads configuration from supported environment variables.
 */
function loadConfigFromEnv(env: ConfigEnv): LoadedConfig | undefined {
	const indexedFeeds = parseIndexedFeedEnv(env);
	if (indexedFeeds.length > 0) {
		const config = validateConfig({ feeds: indexedFeeds });
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
 * Validates all feed settings and returns a typed app config.
 */
function validateConfig(config: AppConfig): AppConfig {
	const result = appConfigSchema.safeParse(config);
	if (!result.success) {
		throw new Error(
			`設定バリデーションエラー: ${formatZodError(result.error)}`,
		);
	}
	return result.data;
}

/**
 * Formats Zod issues using config-like paths.
 */
function formatZodError(error: z.ZodError): string {
	return error.issues
		.map((issue) => {
			const path = issue.path.length > 0 ? issue.path.join(".") : "config";
			return `${path}: ${issue.message}`;
		})
		.join("; ");
}
