# RSS Discord

RSS/Atom フィードをポーリングし、新着エントリを Discord Webhook で通知する軽量 CLI ツール。

[English](README.md)

## 特徴

- ブログ記事、リリースノート、ニュースなどの新着を Discord に自動通知
- 1つの設定ファイルで複数フィードを管理し、フィードごとに通知間隔を指定
- 送信済みエントリを記録して、同じ投稿の重複通知を防止
- タイトル、リンク、日時、フィード名つきの見やすい Discord メッセージを送信
- Discord のレートリミット時は自動で待ってリトライ
- 常駐実行、Docker 実行、スケジューラからの1回実行に対応
- 日別ログであとから通知状況を確認可能

## クイックスタート

### 必要なもの

- Bun 1.3+
- Discord Webhook URL

### セットアップ

```bash
bun install
cp config.example.json config.json
# config.json にフィード URL と Webhook URL を設定
```

### 実行

```bash
# ポーリング開始
bun start

# 1回実行して終了
bun run dev --once
```

### ビルド

```bash
bun run build       # dist/ にバンドル
bun run lint        # Biome lint
bun run typecheck   # 型チェック
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
