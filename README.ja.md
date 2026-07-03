# RSS Discord

RSS/Atom フィードをポーリングし、新着エントリを Discord Webhook で通知する軽量 CLI ツール。

[English](README.md)

## 特徴

- ブログ記事、リリースノート、ニュースなどの新着を Discord に自動通知
- Docker やゲームサーバーパネルで扱いやすい環境変数で設定
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
cp .env.example .env
# .env にフィード URL と Webhook URL を設定
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
docker run --env-file .env \
           -v ./data:/app/data \
           -v ./logs:/app/logs \
           rss-discord
```

## 設定

フィードは番号付き環境変数で設定します。`RSS_DISCORD_FEEDS_1_*`, `RSS_DISCORD_FEEDS_2_*`, ..., `RSS_DISCORD_FEEDS_100_*` のように番号を増やせます。

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

| フィールド | 説明 |
|------------|------|
| `RSS_DISCORD_FEEDS_<N>_NAME` | フィードの表示名 |
| `RSS_DISCORD_FEEDS_<N>_URL` | RSS/Atom フィード URL |
| `RSS_DISCORD_FEEDS_<N>_WEBHOOK_URL` | Discord Webhook URL |
| `RSS_DISCORD_FEEDS_<N>_COLOR` | Embed の色 (10進数、既定値: `3447003`) |
| `RSS_DISCORD_FEEDS_<N>_INTERVAL_MINUTES` | ポーリング間隔 (分、既定値: `5`) |

## ライセンス

[MIT](LICENSE)
