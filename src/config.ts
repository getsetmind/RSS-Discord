import type { AppConfig, FeedConfig } from "./types.ts";

const DEFAULT_INTERVAL_MINUTES = 5;
const DEFAULT_COLOR = 0x3498db;
const DEFAULT_MAX_HISTORY = 200;

export async function loadConfig(path: string): Promise<AppConfig> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(`設定ファイルが見つかりません: ${path}`);
  }

  const raw = await file.json();
  validate(raw);
  return raw as AppConfig;
}

function validate(raw: unknown): asserts raw is AppConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("設定ファイルはオブジェクトである必要があります");
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.feeds) || obj.feeds.length === 0) {
    throw new Error("feeds配列が空か未定義です");
  }

  for (const [i, feed] of obj.feeds.entries()) {
    if (typeof feed !== "object" || feed === null) {
      throw new Error(`feeds[${i}] がオブジェクトではありません`);
    }
    const f = feed as Record<string, unknown>;
    if (typeof f.name !== "string" || f.name === "") {
      throw new Error(`feeds[${i}].name が未定義または空です`);
    }
    if (typeof f.url !== "string" || f.url === "") {
      throw new Error(`feeds[${i}].url が未定義または空です`);
    }
    if (typeof f.webhookUrl !== "string" || f.webhookUrl === "") {
      throw new Error(`feeds[${i}].webhookUrl が未定義または空です`);
    }
    if (
      !f.webhookUrl.startsWith("https://discord.com/api/webhooks/") &&
      !f.webhookUrl.startsWith("https://discordapp.com/api/webhooks/")
    ) {
      throw new Error(
        `feeds[${i}].webhookUrl が有効なDiscord Webhook URLではありません`,
      );
    }
  }
}

export function getInterval(feed: FeedConfig, config: AppConfig): number {
  return (
    (feed.intervalMinutes ??
      config.defaults?.intervalMinutes ??
      DEFAULT_INTERVAL_MINUTES) *
    60 *
    1000
  );
}

export function getColor(feed: FeedConfig, config: AppConfig): number {
  return feed.color ?? config.defaults?.color ?? DEFAULT_COLOR;
}

export function getMaxHistory(config: AppConfig): number {
  return config.defaults?.maxHistoryPerFeed ?? DEFAULT_MAX_HISTORY;
}
