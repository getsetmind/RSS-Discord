# RSS Discord

RSS/Atom フィードをポーリングし、新着エントリを Discord Webhook で通知する軽量 CLI ツール。

[English](README.md)

## 特徴

- RSS / Atom フィード対応 ([gofeed](https://github.com/mmcdole/gofeed) 使用)
- 複数フィードの独立したポーリング間隔
- Discord Webhook によるリッチな Embed 通知
- レートリミット対応 (HTTP 429 リトライ)
- 送信済みアイテムの永続化 (`data/sent.json`)
- 構造化ログ (コンソール ANSI 色付き + 日別 JSON ログファイル)
- グレースフルシャットダウン (SIGINT/SIGTERM)
- Docker 対応

## クイックスタート

### 必要なもの

- Go 1.25+
- Discord Webhook URL

### セットアップ

```bash
cp config.example.json config.json
# config.json にフィード URL と Webhook URL を設定
```

### 実行

```bash
# ポーリング開始
go run ./cmd/rss-discord

# 1回実行して終了
go run ./cmd/rss-discord --once
```

### ビルド

```bash
make build          # 現在のプラットフォーム用にビルド
make build-all      # クロスコンパイル (Linux, Windows, macOS)
```

### Docker

```bash
docker build -t rss-discord .
docker run -v ./config.json:/app/config.json \
           -v ./data:/app/data \
           -v ./logs:/app/logs \
           rss-discord
```

## 設定

`config.example.json` を元に `config.json` を作成:

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

| フィールド | 説明 |
|------------|------|
| `name` | フィードの表示名 |
| `url` | RSS/Atom フィード URL |
| `webhookUrl` | Discord Webhook URL |
| `color` | Embed の色 (10進数) |
| `intervalMinutes` | ポーリング間隔 (分) |

## ライセンス

[MIT](LICENSE)
