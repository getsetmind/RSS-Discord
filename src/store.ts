import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { SentStore } from "./types";

/**
 * @description 送信済みアイテムIDを管理するJSONベースの永続化ストア
 */
export class Store {
	private data: SentStore = {};
	private maxHistory: number;
	private path: string;

	constructor(path: string, maxHistory: number) {
		this.path = path;
		this.maxHistory = maxHistory;
	}

	/**
	 * @description ストアファイルが存在すれば読み込む
	 */
	async load(): Promise<void> {
		const file = Bun.file(this.path);
		if (await file.exists()) {
			this.data = await file.json();
		}
	}

	/**
	 * @description 指定アイテムが送信済みかどうかを返す
	 * @param feedUrl - フィードURL
	 * @param itemId - アイテムID
	 */
	hasSent(feedUrl: string, itemId: string): boolean {
		return this.data[feedUrl]?.includes(itemId) ?? false;
	}

	/**
	 * @description アイテムを送信済みとして記録し、ストアを永続化する
	 * @param feedUrl - フィードURL
	 * @param itemId - アイテムID
	 */
	async markSent(feedUrl: string, itemId: string): Promise<void> {
		this.data[feedUrl] ??= [];
		const history = this.data[feedUrl];
		history.push(itemId);

		if (history.length > this.maxHistory) {
			this.data[feedUrl] = history.slice(-this.maxHistory);
		}

		await this.save();
	}

	/**
	 * @description ストアデータをJSONファイルに書き出す
	 * @internal
	 */
	private async save(): Promise<void> {
		await mkdir(dirname(this.path), { recursive: true });
		await Bun.write(this.path, JSON.stringify(this.data, null, 2));
	}
}
