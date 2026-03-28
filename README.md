# RSS Discord

A lightweight CLI tool that polls RSS/Atom feeds and sends new entries to Discord via Webhooks.

[日本語](README.ja.md)

## Features

- RSS and Atom feed support (powered by [gofeed](https://github.com/mmcdole/gofeed))
- Multiple feeds with independent polling intervals
- Discord Webhook integration with rich embeds
- Rate limit handling (HTTP 429 retry)
- Persistent tracking of sent items (`data/sent.json`)
- Structured logging (console with ANSI colors + daily JSON log files)
- Graceful shutdown (SIGINT/SIGTERM)
- Docker support

## Quick Start

### Prerequisites

- Go 1.25+
- A Discord Webhook URL

### Setup

```bash
cp config.example.json config.json
# Edit config.json with your feed URLs and Webhook URLs
```

### Run

```bash
# Start polling
go run ./cmd/rss-discord

# Run once and exit
go run ./cmd/rss-discord --once
```

### Build

```bash
make build          # Build for current platform
make build-all      # Cross-compile (Linux, Windows, macOS)
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
