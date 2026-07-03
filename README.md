# RSS Discord

A lightweight CLI tool that polls RSS/Atom feeds and sends new entries to Discord via Webhooks.

[日本語](README.ja.md)

## Features

- Send new blog posts, release notes, and other feed updates to Discord automatically
- Configure feeds with environment variables for Docker and game-server panels
- Avoid duplicate notifications by remembering already-sent entries
- Keep Discord messages easy to scan with titles, links, timestamps, and feed names
- Recover from Discord rate limits with an automatic retry
- Run locally, in Docker, or from a scheduled one-shot command
- Check what happened later with daily log files

## Quick Start

### Prerequisites

- Bun 1.3+
- A Discord Webhook URL

### Setup

```bash
bun install
cp .env.example .env
# Edit .env with your feed URL and Webhook URL
```

### Run

```bash
# Start polling
bun start

# Run once and exit
bun run dev --once
```

### Build

```bash
bun run build       # Bundle into dist/
bun run lint        # Biome lint
bun run typecheck   # TypeScript typecheck
```

### Docker

```bash
docker build -t rss-discord .
docker run --env-file .env \
           -v ./data:/app/data \
           -v ./logs:/app/logs \
           rss-discord
```

## Configuration

Configure feeds with numbered environment variables. Add more feeds by increasing the number: `RSS_DISCORD_FEEDS_1_*`, `RSS_DISCORD_FEEDS_2_*`, ..., `RSS_DISCORD_FEEDS_100_*`.

```env
RSS_DISCORD_FEEDS_1_NAME=Example Blog
RSS_DISCORD_FEEDS_1_URL=https://example.com/feed.xml
RSS_DISCORD_FEEDS_1_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN
RSS_DISCORD_FEEDS_1_COLOR=3447003
RSS_DISCORD_FEEDS_1_INTERVAL_MINUTES=5

RSS_DISCORD_FEEDS_2_NAME=GitHub Releases
RSS_DISCORD_FEEDS_2_URL=https://github.com/oven-sh/bun/releases.atom
RSS_DISCORD_FEEDS_2_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN
RSS_DISCORD_FEEDS_2_COLOR=15105570
RSS_DISCORD_FEEDS_2_INTERVAL_MINUTES=10
```

| Field | Description |
|-------|-------------|
| `RSS_DISCORD_FEEDS_<N>_NAME` | Display name for the feed |
| `RSS_DISCORD_FEEDS_<N>_URL` | RSS/Atom feed URL |
| `RSS_DISCORD_FEEDS_<N>_WEBHOOK_URL` | Discord Webhook URL |
| `RSS_DISCORD_FEEDS_<N>_COLOR` | Embed color (decimal, default: `3447003`) |
| `RSS_DISCORD_FEEDS_<N>_INTERVAL_MINUTES` | Polling interval in minutes (default: `5`) |

## License

[MIT](LICENSE)
