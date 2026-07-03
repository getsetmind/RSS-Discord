import { existsSync, readFileSync, writeFileSync } from "node:fs";

/**
 * Default legacy config path.
 */
const defaultInputPath = "config.json";

/**
 * Default dotenv output path.
 */
const defaultOutputPath = ".env";

/**
 * Legacy config shape used by the former config.json file.
 */
interface LegacyConfig {
	/**
	 * Feed definitions.
	 */
	feeds?: LegacyFeed[];
}

/**
 * Legacy feed shape used by the former config.json file.
 */
interface LegacyFeed {
	/**
	 * Feed display name.
	 */
	name?: unknown;
	/**
	 * RSS or Atom feed URL.
	 */
	url?: unknown;
	/**
	 * Discord webhook URL.
	 */
	webhookUrl?: unknown;
	/**
	 * Discord embed color.
	 */
	color?: unknown;
	/**
	 * Polling interval in minutes.
	 */
	intervalMinutes?: unknown;
}

/**
 * Environment variable map used by the migration.
 */
export type MigrationEnv = Record<string, string | undefined>;

/**
 * File paths used by the migration.
 */
export interface MigrationPaths {
	/**
	 * Source config.json path.
	 */
	inputPath?: string;
	/**
	 * Destination .env path.
	 */
	outputPath?: string;
}

/**
 * Result of an attempted legacy config migration.
 */
export interface MigrationResult {
	/**
	 * Whether a .env file was written.
	 */
	migrated: boolean;
	/**
	 * Number of migrated feeds.
	 */
	feedCount: number;
}

/**
 * Migrates legacy config.json to .env when no environment config exists yet.
 */
export function migrateLegacyConfigIfNeeded(
	env: MigrationEnv = process.env,
	paths: MigrationPaths = {},
): MigrationResult {
	if (hasIndexedFeedEnv(env)) {
		return { migrated: false, feedCount: 0 };
	}

	const inputPath = paths.inputPath ?? defaultInputPath;
	const outputPath = paths.outputPath ?? defaultOutputPath;
	if (!existsSync(inputPath) || existsSync(outputPath)) {
		return { migrated: false, feedCount: 0 };
	}

	const envFile = migrateLegacyConfig(inputPath, outputPath);
	for (const [key, value] of Object.entries(envFile.values)) {
		env[key] = value;
	}

	return { migrated: true, feedCount: envFile.feedCount };
}

/**
 * Migrates legacy config.json to .env unconditionally.
 */
export function migrateLegacyConfig(
	inputPath = defaultInputPath,
	outputPath = defaultOutputPath,
): MigrationResult & { values: Record<string, string> } {
	const raw = readFileSync(inputPath, "utf8");
	const config = JSON.parse(raw) as LegacyConfig;

	if (!Array.isArray(config.feeds) || config.feeds.length === 0) {
		throw new Error("config.json に feeds がありません");
	}

	const values: Record<string, string> = {};
	const lines = config.feeds.flatMap((feed, index) => {
		const prefix = `RSS_DISCORD_FEEDS_${index + 1}`;
		const feedValues = {
			[`${prefix}_NAME`]: formatEnvValue(feed.name),
			[`${prefix}_URL`]: formatEnvValue(feed.url),
			[`${prefix}_WEBHOOK_URL`]: formatEnvValue(feed.webhookUrl),
			[`${prefix}_COLOR`]: formatEnvValue(feed.color),
			[`${prefix}_INTERVAL_MINUTES`]: formatEnvValue(feed.intervalMinutes),
		};
		Object.assign(values, feedValues);

		return [
			...(index > 0 ? [""] : []),
			...Object.entries(feedValues).map(([key, value]) => `${key}=${value}`),
		];
	});

	writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
	return { migrated: true, feedCount: config.feeds.length, values };
}

/**
 * Checks whether numbered feed environment variables already exist.
 */
function hasIndexedFeedEnv(env: MigrationEnv): boolean {
	return Object.keys(env).some((key) =>
		/^RSS_DISCORD_FEEDS_\d+_(?:NAME|URL|WEBHOOK_URL|COLOR|INTERVAL_MINUTES)$/.test(
			key,
		),
	);
}

/**
 * Formats a JSON value as a simple .env value.
 */
function formatEnvValue(value: unknown): string {
	if (value === undefined || value === null) {
		return "";
	}
	return String(value).replaceAll(/\r?\n/g, " ").trim();
}
