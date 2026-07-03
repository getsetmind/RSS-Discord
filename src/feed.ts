import Parser from "rss-parser";
import type { FeedItem } from "./types.js";

/**
 * rss-parser custom field output used by this application.
 */
interface ParsedItem {
	/**
	 * Feed GUID.
	 */
	guid?: string;
	/**
	 * Item title.
	 */
	title?: string;
	/**
	 * Item URL.
	 */
	link?: string;
	/**
	 * RSS content snippet or Atom summary.
	 */
	contentSnippet?: string;
	/**
	 * RSS content HTML.
	 */
	content?: string;
	/**
	 * RSS description HTML.
	 */
	description?: string;
	/**
	 * Publication date string.
	 */
	pubDate?: string;
	/**
	 * ISO publication date string added by rss-parser.
	 */
	isoDate?: string;
	/**
	 * Atom updated timestamp.
	 */
	updated?: string;
	/**
	 * Creator field from RSS modules.
	 */
	creator?: string;
	/**
	 * Author field.
	 */
	author?: string;
}

/**
 * Shared RSS and Atom parser.
 */
const parser = new Parser<unknown, ParsedItem>({
	headers: {
		"User-Agent": "rss-discord/1.0",
		Accept:
			"application/rss+xml, application/atom+xml, application/xml, text/xml",
	},
	timeout: 15000,
});

/**
 * Fetches a feed URL and normalizes all entries that have an identifier.
 */
export async function fetchFeed(url: string): Promise<FeedItem[]> {
	let parsed: Parser.Output<ParsedItem>;
	try {
		parsed = await parser.parseURL(url);
	} catch (error) {
		throw new Error(`フィード取得失敗: ${formatError(error)}`);
	}

	return parsed.items
		.map((item) => normalizeItem(item))
		.filter((item) => item.id !== "");
}

/**
 * Normalizes one parser item into the app's stable feed item shape.
 */
function normalizeItem(item: ParsedItem): FeedItem {
	const id = item.guid ?? item.link ?? item.title ?? "";
	const title = item.title && item.title !== "" ? item.title : "Untitled";
	const pubDate = normalizeDate(
		item.isoDate ?? item.pubDate ?? item.updated ?? "",
	);

	return {
		id,
		title,
		link: item.link ?? "",
		description: item.contentSnippet ?? item.description ?? item.content ?? "",
		pubDate,
		author: item.creator ?? item.author ?? "",
	};
}

/**
 * Converts parseable dates to ISO 8601 while preserving unparseable input.
 */
function normalizeDate(value: string): string {
	if (value === "") {
		return "";
	}

	const timestamp = Date.parse(value);
	if (Number.isNaN(timestamp)) {
		return value;
	}
	return new Date(timestamp).toISOString();
}

/**
 * Formats unknown parser errors.
 */
function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
