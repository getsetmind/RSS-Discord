import { afterEach, describe, expect, test } from "bun:test";
import { fetchFeed } from "../src/feed.js";

/**
 * Active test server.
 */
let server: ReturnType<typeof Bun.serve> | undefined;

afterEach(() => {
	server?.stop(true);
	server = undefined;
});

/**
 * Starts a local RSS server for feed tests.
 */
function startServer(response: Response): string {
	server = Bun.serve({
		port: 0,
		fetch: () => response,
	});
	return `http://127.0.0.1:${server.port}/feed.xml`;
}

describe("fetchFeed", () => {
	test("fetches and normalizes RSS items", async () => {
		const url = startServer(
			new Response(
				`<?xml version="1.0"?>
				<rss version="2.0">
					<channel>
						<title>Example</title>
						<item>
							<guid>item-1</guid>
							<title>First</title>
							<link>https://example.com/1</link>
							<description>Hello</description>
							<pubDate>Fri, 03 Jul 2026 00:00:00 GMT</pubDate>
							<author>author@example.com</author>
						</item>
						<item>
							<title>Fallback ID</title>
							<link>https://example.com/2</link>
						</item>
					</channel>
				</rss>`,
				{ headers: { "content-type": "application/rss+xml" } },
			),
		);

		const items = await fetchFeed(url);

		expect(items).toHaveLength(2);
		expect(items[0]).toMatchObject({
			id: "item-1",
			title: "First",
			link: "https://example.com/1",
			description: "Hello",
			author: "author@example.com",
		});
		expect(items[0]?.pubDate).toBe("2026-07-03T00:00:00.000Z");
		expect(items[1]?.id).toBe("https://example.com/2");
	});

	test("preserves unparseable publication dates", async () => {
		const url = startServer(
			new Response(
				`<?xml version="1.0"?>
				<rss version="2.0">
					<channel>
						<title>Example</title>
						<item>
							<guid>item-1</guid>
							<title>First</title>
							<pubDate>someday</pubDate>
						</item>
					</channel>
				</rss>`,
				{ headers: { "content-type": "application/rss+xml" } },
			),
		);

		const items = await fetchFeed(url);

		expect(items[0]?.pubDate).toBe("someday");
	});

	test("wraps parser errors", async () => {
		const url = startServer(new Response("not xml"));

		await expect(fetchFeed(url)).rejects.toThrow("フィード取得失敗");
	});
});
