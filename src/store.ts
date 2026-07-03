import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Persistent map of feed URLs to sent item IDs.
 */
type StoreData = Record<string, string[]>;

/**
 * File-backed store for sent feed items.
 */
export class Store {
	/**
	 * In-memory sent item data.
	 */
	private data: StoreData = {};

	/**
	 * Creates a sent item store.
	 */
	public constructor(
		private readonly path: string,
		private readonly maxHistory: number,
	) {}

	/**
	 * Loads persisted sent item IDs if the file exists.
	 */
	public async load(): Promise<void> {
		let raw: string;
		try {
			raw = await readFile(this.path, "utf8");
		} catch (error) {
			if (isNotFound(error)) {
				return;
			}
			throw new Error(`ストア読み込み失敗: ${formatError(error)}`);
		}

		try {
			const parsed = JSON.parse(raw) as StoreData;
			this.data = normalizeStoreData(parsed);
		} catch (error) {
			throw new Error(`ストアパース失敗: ${formatError(error)}`);
		}
	}

	/**
	 * Checks whether an item was already sent for a feed URL.
	 */
	public hasSent(feedURL: string, itemID: string): boolean {
		return this.data[feedURL]?.includes(itemID) ?? false;
	}

	/**
	 * Marks an item as sent and saves the store.
	 */
	public async markSent(feedURL: string, itemID: string): Promise<void> {
		const ids = this.data[feedURL] ?? [];
		ids.push(itemID);
		this.data[feedURL] = ids.slice(-this.maxHistory);
		await this.save();
	}

	/**
	 * Saves current store data.
	 */
	private async save(): Promise<void> {
		await mkdir(dirname(this.path), { recursive: true });
		await writeFile(
			this.path,
			`${JSON.stringify(this.data, null, 2)}\n`,
			"utf8",
		);
	}
}

/**
 * Normalizes parsed store JSON into a string-array map.
 */
function normalizeStoreData(value: unknown): StoreData {
	if (!isRecord(value)) {
		return {};
	}

	const data: StoreData = {};
	for (const [key, ids] of Object.entries(value)) {
		if (Array.isArray(ids)) {
			data[key] = ids.filter((id): id is string => typeof id === "string");
		}
	}
	return data;
}

/**
 * Checks whether an fs error is ENOENT.
 */
function isNotFound(error: unknown): boolean {
	return (
		isRecord(error) &&
		"code" in error &&
		(error as { code: unknown }).code === "ENOENT"
	);
}

/**
 * Narrows unknown values to records.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/**
 * Formats unknown store errors.
 */
function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
