# RSS Discord

A lightweight CLI tool that polls RSS/Atom feeds and sends new entries to Discord via Webhooks.

[日本語](README.ja.md)

## Features

- Send new blog posts, release notes, and other feed updates to Discord automatically
- Watch multiple feeds at different intervals from one small config file
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
cp config.example.json config.json
# Edit config.json with your feed URLs and Webhook URLs
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
docker run -v ./config.json:/app/config.json \
           -v ./data:/app/data \
           -v ./logs:/app/logs \
           rss-discord
```

## Configuration

Create `config.json` based on the example:

```json
{
  "feeds": [
    {
      "name": "Example Blog",
      "url": "https://example.com/feed.xml",
      "webhookUrl": "https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN",
      "color": 3447003,
      "intervalMinutes": 5
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `name` | Display name for the feed |
| `url` | RSS/Atom feed URL |
| `webhookUrl` | Discord Webhook URL |
| `color` | Embed color (decimal) |
| `intervalMinutes` | Polling interval in minutes |

## License

[MIT](LICENSE)
