import { parseFeed } from "feedsmith";
import type { FeedItem } from "./types.ts";

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
    case "rdf":
      return normalizeRssItems(result.feed);
    case "atom":
      return normalizeAtomEntries(result.feed);
    case "json":
      return normalizeJsonItems(result.feed);
  }
}

function normalizeRssItems(feed: { items?: Array<Record<string, any>> }): FeedItem[] {
  if (!feed.items) return [];

  return feed.items
    .map((item) => ({
      id: item.guid ?? item.link ?? item.title ?? "",
      title: item.title ?? "Untitled",
      link: item.link ?? "",
      description: item.description,
      pubDate: item.pubDate,
      author: item.authors?.[0] ?? item.dc?.creator,
    }))
    .filter((item) => item.id !== "");
}

function normalizeAtomEntries(feed: { entries?: Array<Record<string, any>> }): FeedItem[] {
  if (!feed.entries) return [];

  return feed.entries
    .map((entry) => {
      const link =
        entry.links?.find((l: any) => l.rel === "alternate")?.href ??
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

function normalizeJsonItems(feed: { items?: Array<Record<string, any>> }): FeedItem[] {
  if (!feed.items) return [];

  return feed.items
    .map((item) => ({
      id: item.id ?? item.url ?? item.title ?? "",
      title: item.title ?? "Untitled",
      link: item.url ?? item.externalUrl ?? "",
      description: item.summary ?? item.contentText ?? item.contentHtml,
      pubDate: item.datePublished ?? item.dateModified,
      author: item.authors?.[0]?.name,
    }))
    .filter((item) => item.id !== "");
}
