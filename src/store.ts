import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { SentStore } from "./types.ts";

export class Store {
	private data: SentStore = {};
	private maxHistory: number;
	private path: string;

	constructor(path: string, maxHistory: number) {
		this.path = path;
		this.maxHistory = maxHistory;
	}

	async load(): Promise<void> {
		const file = Bun.file(this.path);
		if (await file.exists()) {
			this.data = await file.json();
		}
	}

	hasSent(feedUrl: string, itemId: string): boolean {
		return this.data[feedUrl]?.includes(itemId) ?? false;
	}

	async markSent(feedUrl: string, itemId: string): Promise<void> {
		if (!this.data[feedUrl]) {
			this.data[feedUrl] = [];
		}
		this.data[feedUrl].push(itemId);

		if (this.data[feedUrl].length > this.maxHistory) {
			this.data[feedUrl] = this.data[feedUrl].slice(-this.maxHistory);
		}

		await this.save();
	}

	private async save(): Promise<void> {
		await mkdir(dirname(this.path), { recursive: true });
		await Bun.write(this.path, JSON.stringify(this.data, null, 2));
	}
}
