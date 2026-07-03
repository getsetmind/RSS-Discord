/**
 * Single feed entry from a configured RSS or Atom source.
 */
export interface FeedItem {
	/**
	 * Stable identifier used for deduplication.
	 */
	id: string;
	/**
	 * Display title for the Discord embed.
	 */
	title: string;
	/**
	 * Link opened from the Discord embed title.
	 */
	link: string;
	/**
	 * Optional HTML or plain-text summary from the feed.
	 */
	description: string;
	/**
	 * Publication timestamp, preferably in ISO 8601 format.
	 */
	pubDate: string;
	/**
	 * Optional author name.
	 */
	author: string;
}

/**
 * Per-feed runtime settings loaded from environment variables.
 */
export interface FeedConfig {
	/**
	 * Human-readable feed name.
	 */
	name: string;
	/**
	 * RSS or Atom feed URL.
	 */
	url: string;
	/**
	 * Discord webhook URL that receives notifications.
	 */
	webhookUrl: string;
	/**
	 * Discord embed color as a decimal integer.
	 */
	color: number;
	/**
	 * Polling interval in minutes.
	 */
	intervalMinutes: number;
}

/**
 * Top-level application configuration.
 */
export interface AppConfig {
	/**
	 * Feed definitions to poll.
	 */
	feeds: FeedConfig[];
}

/**
 * Discord embed author object.
 */
export interface EmbedAuthor {
	/**
	 * Author label shown above the embed title.
	 */
	name: string;
}

/**
 * Discord embed footer object.
 */
export interface EmbedFooter {
	/**
	 * Footer text shown below the embed body.
	 */
	text: string;
}

/**
 * Discord embed payload sent to a webhook.
 */
export interface Embed {
	/**
	 * Embed title.
	 */
	title?: string;
	/**
	 * Embed body text.
	 */
	description?: string;
	/**
	 * URL attached to the title.
	 */
	url?: string;
	/**
	 * Embed color as a decimal integer.
	 */
	color?: number;
	/**
	 * ISO 8601 timestamp.
	 */
	timestamp?: string;
	/**
	 * Optional author metadata.
	 */
	author?: EmbedAuthor;
	/**
	 * Optional footer metadata.
	 */
	footer?: EmbedFooter;
}
