import { afterEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/config.js";
import {
	migrateLegacyConfig,
	migrateLegacyConfigIfNeeded,
} from "../src/config-migration.js";

/**
 * Valid Discord webhook URL used in migration tests.
 */
const webhookURL = "https://discord.com/api/webhooks/123/token";

/**
 * Original working directory restored after migration tests.
 */
const originalCwd = process.cwd();

/**
 * Temporary directory used by migration tests.
 */
let tempDir: string | undefined;

afterEach(async () => {
	process.chdir(originalCwd);
	clearFeedEnv();
	if (tempDir !== undefined) {
		await rm(tempDir, { recursive: true, force: true });
		tempDir = undefined;
	}
});

/**
 * Creates a temporary migration directory.
 */
async function createMigrationDir(): Promise<string> {
	tempDir = await mkdtemp(join(tmpdir(), "rss-discord-migration-"));
	return tempDir;
}

/**
 * Removes feed environment variables added by migration tests.
 */
function clearFeedEnv(): void {
	for (const key of Object.keys(process.env)) {
		if (/^RSS_DISCORD_FEEDS_\d+_/.test(key)) {
			delete process.env[key];
		}
	}
}

/**
 * Writes a legacy config.json file in the given directory.
 */
async function writeLegacyConfig(directory: string): Promise<string> {
	const path = join(directory, "config.json");
	await writeFile(
		path,
		JSON.stringify({
			feeds: [
				{
					name: "First\nFeed",
					url: "https://example.com/feed.xml",
					webhookUrl: webhookURL,
					color: 112233,
					intervalMinutes: 10,
				},
				{
					url: "https://example.com/second.xml",
					webhookUrl: webhookURL,
				},
			],
		}),
		"utf8",
	);
	return path;
}

describe("legacy config migration", () => {
	test("writes numbered environment variables from config.json", async () => {
		const directory = await createMigrationDir();
		const inputPath = await writeLegacyConfig(directory);
		const outputPath = join(directory, ".env");

		const result = migrateLegacyConfig(inputPath, outputPath);

		expect(result.feedCount).toBe(2);
		expect(result.values.RSS_DISCORD_FEEDS_1_NAME).toBe("First Feed");
		expect(await readFile(outputPath, "utf8")).toBe(
			[
				"RSS_DISCORD_FEEDS_1_NAME=First Feed",
				"RSS_DISCORD_FEEDS_1_URL=https://example.com/feed.xml",
				`RSS_DISCORD_FEEDS_1_WEBHOOK_URL=${webhookURL}`,
				"RSS_DISCORD_FEEDS_1_COLOR=112233",
				"RSS_DISCORD_FEEDS_1_INTERVAL_MINUTES=10",
				"",
				"RSS_DISCORD_FEEDS_2_NAME=",
				"RSS_DISCORD_FEEDS_2_URL=https://example.com/second.xml",
				`RSS_DISCORD_FEEDS_2_WEBHOOK_URL=${webhookURL}`,
				"RSS_DISCORD_FEEDS_2_COLOR=",
				"RSS_DISCORD_FEEDS_2_INTERVAL_MINUTES=",
				"",
			].join("\n"),
		);
	});

	test("skips migration when env config already exists", async () => {
		const directory = await createMigrationDir();
		const inputPath = await writeLegacyConfig(directory);
		const outputPath = join(directory, ".env");
		const env = {
			RSS_DISCORD_FEEDS_1_URL: "https://example.com/env.xml",
		};

		const result = migrateLegacyConfigIfNeeded(env, { inputPath, outputPath });

		expect(result).toEqual({ migrated: false, feedCount: 0 });
		expect(existsSync(outputPath)).toBe(false);
	});

	test("skips migration when no legacy config exists or dotenv already exists", async () => {
		const directory = await createMigrationDir();
		const missingInputPath = join(directory, "missing.json");
		const outputPath = join(directory, ".env");
		const env = {};

		expect(
			migrateLegacyConfigIfNeeded(env, {
				inputPath: missingInputPath,
				outputPath,
			}),
		).toEqual({ migrated: false, feedCount: 0 });

		const inputPath = await writeLegacyConfig(directory);
		await writeFile(outputPath, "RSS_DISCORD_FEEDS_1_NAME=Existing\n", "utf8");

		expect(
			migrateLegacyConfigIfNeeded(env, {
				inputPath,
				outputPath,
			}),
		).toEqual({ migrated: false, feedCount: 0 });
	});

	test("rejects legacy config without feeds", async () => {
		const directory = await createMigrationDir();
		const inputPath = join(directory, "config.json");
		await writeFile(inputPath, JSON.stringify({ feeds: [] }), "utf8");

		expect(() =>
			migrateLegacyConfig(inputPath, join(directory, ".env")),
		).toThrow("config.json に feeds がありません");
	});

	test("loads migrated config during first startup", async () => {
		const directory = await createMigrationDir();
		await writeLegacyConfig(directory);
		process.chdir(directory);
		clearFeedEnv();

		const loaded = loadConfig();

		expect(loaded.source).toBe("legacy-config-json:migrated-env");
		expect(loaded.config.feeds).toHaveLength(2);
		expect(loaded.config.feeds[1]?.name).toBe("Feed 2");
		expect(existsSync(join(directory, ".env"))).toBe(true);
	});
});
