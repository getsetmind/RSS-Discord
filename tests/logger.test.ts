import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Logger } from "../src/logger.js";

/**
 * Temporary log directory.
 */
let tempDir: string | undefined;

afterEach(async () => {
	if (tempDir !== undefined) {
		await rm(tempDir, { recursive: true, force: true });
		tempDir = undefined;
	}
});

/**
 * Creates a logger writing to a temporary directory.
 */
async function createLogger(): Promise<Logger> {
	tempDir = await mkdtemp(join(tmpdir(), "rss-discord-logs-"));
	return new Logger(tempDir);
}

/**
 * Returns today's JST date string used by log filenames.
 */
function getJSTDateString(): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
}

describe("Logger", () => {
	test("writes info logs to the daily app log", async () => {
		const logger = await createLogger();

		logger.info("Hello", { feed: "Example" });
		await Bun.sleep(10);

		const log = await readFile(
			join(tempDir ?? "", `app-${getJSTDateString()}.log`),
			"utf8",
		);
		expect(log).toContain('"message":"Hello"');
		expect(log).toContain('"feed":"Example"');
	});

	test("writes error logs to both app and error logs", async () => {
		const logger = await createLogger();

		logger.error("Oops", { error: new Error("broken") });
		await Bun.sleep(10);

		const date = getJSTDateString();
		const appLog = await readFile(
			join(tempDir ?? "", `app-${date}.log`),
			"utf8",
		);
		const errorLog = await readFile(
			join(tempDir ?? "", `error-${date}.log`),
			"utf8",
		);
		expect(appLog).toContain('"message":"Oops"');
		expect(errorLog).toContain('"message":"Oops"');
	});

	test("writes warning logs", async () => {
		const logger = await createLogger();

		logger.warn("Careful");
		await Bun.sleep(10);

		const log = await readFile(
			join(tempDir ?? "", `app-${getJSTDateString()}.log`),
			"utf8",
		);
		expect(log).toContain('"level":"warn"');
		expect(log).toContain('"message":"Careful"');
	});

	test("filters below the configured minimum level", async () => {
		const logger = new Logger(tempDir ?? "", "warn");

		logger.info("Ignored");
		await Bun.sleep(10);

		expect(tempDir).toBeUndefined();
	});
});
