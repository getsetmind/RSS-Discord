import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Store } from "../src/store.js";

/**
 * Temporary directory used by store tests.
 */
let tempDir: string | undefined;

afterEach(async () => {
	if (tempDir !== undefined) {
		await rm(tempDir, { recursive: true, force: true });
		tempDir = undefined;
	}
});

/**
 * Creates a temporary store path.
 */
async function createStorePath(): Promise<string> {
	tempDir = await mkdtemp(join(tmpdir(), "rss-discord-store-"));
	return join(tempDir, "data", "sent.json");
}

/**
 * Writes raw store content, creating parent directories first.
 */
async function writeStore(path: string, content: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, content, "utf8");
}

describe("Store", () => {
	test("loads missing stores as empty", async () => {
		const path = await createStorePath();
		const store = new Store(path, 2);

		await store.load();

		expect(store.hasSent("feed", "item")).toBe(false);
	});

	test("marks sent IDs and trims history", async () => {
		const path = await createStorePath();
		const store = new Store(path, 2);

		await store.load();
		await store.markSent("feed", "one");
		await store.markSent("feed", "two");
		await store.markSent("feed", "three");

		expect(store.hasSent("feed", "one")).toBe(false);
		expect(store.hasSent("feed", "two")).toBe(true);
		expect(store.hasSent("feed", "three")).toBe(true);
		expect(JSON.parse(await readFile(path, "utf8"))).toEqual({
			feed: ["two", "three"],
		});
	});

	test("normalizes existing store data", async () => {
		const path = await createStorePath();
		await writeStore(
			path,
			JSON.stringify({
				feed: ["one", 2, "three"],
				ignored: "nope",
			}),
		);
		const store = new Store(path, 10);

		await store.load();

		expect(store.hasSent("feed", "one")).toBe(true);
		expect(store.hasSent("feed", "2")).toBe(false);
		expect(store.hasSent("ignored", "nope")).toBe(false);
	});

	test("rejects invalid JSON stores", async () => {
		const path = await createStorePath();
		await writeStore(path, "not-json");
		const store = new Store(path, 10);

		await expect(store.load()).rejects.toThrow("ストアパース失敗");
	});

	test("treats non-object store JSON as empty", async () => {
		const path = await createStorePath();
		await writeStore(path, "[]");
		const store = new Store(path, 10);

		await store.load();

		expect(store.hasSent("feed", "item")).toBe(false);
	});

	test("wraps non-ENOENT read errors", async () => {
		const path = await createStorePath();
		await mkdir(path, { recursive: true });
		const store = new Store(path, 10);

		await expect(store.load()).rejects.toThrow("ストア読み込み失敗");
	});

	test("serializes concurrent saves", async () => {
		const path = await createStorePath();
		const store = new Store(path, 10);

		await Promise.all([
			store.markSent("feed-a", "one"),
			store.markSent("feed-b", "two"),
		]);

		expect(JSON.parse(await readFile(path, "utf8"))).toEqual({
			"feed-a": ["one"],
			"feed-b": ["two"],
		});
	});

	test("keeps the save queue usable after a save failure", async () => {
		const path = await createStorePath();
		await mkdir(path, { recursive: true });
		const store = new Store(path, 10);

		await expect(store.markSent("feed", "one")).rejects.toThrow();
		await expect(store.markSent("feed", "two")).rejects.toThrow();
	});
});
