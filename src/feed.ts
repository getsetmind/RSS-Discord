import { parseFeed } from "feedsmith";
import type { FeedItem } from "./types";

type ParseResult = ReturnType<typeof parseFeed>;
type FeedOf<F extends ParseResult["format"]> = Extract<
	ParseResult,
	{ format: F }
>["feed"];

export async function fetchFeed(url: string): Promise<FeedItem[]> {
	const response = await fetch(url, {
		headers: {
			"User-Agent": "rss-discord/1.0",
			Accept:
				"application/rss+xml, application/atom+xml, application/xml, text/xml",
		},
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status} fetching ${url}`);
	}

	const text = await response.text();
	const result = parseFeed(text);

	switch (result.format) {
		case "rss":
			return normalizeRssItems(result.feed);
		case "rdf":
			return normalizeRdfItems(result.feed);
		case "atom":
			return normalizeAtomEntries(result.feed);
		case "json":
			return normalizeJsonItems(result.feed);
	}
}

function normalizeRssItems(feed: FeedOf<"rss">): FeedItem[] {
	if (!feed.items) return [];

	return feed.items
		.map((item) => {
			const guid = typeof item.guid === "object" ? item.guid?.value : item.guid;
			return {
				id: guid ?? item.link ?? item.title ?? "",
				title: item.title ?? "Untitled",
				link: item.link ?? "",
				description: item.description,
				pubDate: item.pubDate,
				author: item.authors?.[0] ?? item.dc?.creator,
			};
		})
		.filter((item) => item.id !== "");
}

function normalizeRdfItems(feed: FeedOf<"rdf">): FeedItem[] {
	if (!feed.items) return [];

	return feed.items
		.map((item) => ({
			id: item.link ?? item.title ?? "",
			title: item.title ?? "Untitled",
			link: item.link ?? "",
			description: item.description,
			pubDate: item.dc?.date,
			author: item.dc?.creator,
		}))
		.filter((item) => item.id !== "");
}

function normalizeAtomEntries(feed: FeedOf<"atom">): FeedItem[] {
	if (!feed.entries) return [];

	return feed.entries
		.map((entry) => {
			const link =
				entry.links?.find((l) => l.rel === "alternate")?.href ??
				entry.links?.[0]?.href ??
				"";
			return {
				id: entry.id ?? link ?? entry.title ?? "",
				title: entry.title ?? "Untitled",
				link,
				description: entry.summary ?? entry.content,
				pubDate: entry.published ?? entry.updated,
				author: entry.authors?.[0]?.name,
			};
		})
		.filter((item) => item.id !== "");
}

function normalizeJsonItems(feed: FeedOf<"json">): FeedItem[] {
	if (!feed.items) return [];

	return feed.items
		.map((item) => ({
			id: item.id ?? item.url ?? item.title ?? "",
			title: item.title ?? "Untitled",
			link: item.url ?? item.external_url ?? "",
			description: item.summary ?? item.content_text ?? item.content_html,
			pubDate: item.date_published ?? item.date_modified,
			author: item.authors?.[0]?.name,
		}))
		.filter((item) => item.id !== "");
}
