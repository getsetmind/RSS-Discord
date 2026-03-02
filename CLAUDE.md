# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# 開発
go run ./cmd/rss-discord              # ポーリング開始
go run ./cmd/rss-discord --once       # 1回実行して終了

# 品質チェック
make lint                             # golangci-lint
go vet ./...                          # go vet

# ビルド
make build                            # 現在プラットフォーム用にビルド
make build-all                        # 全プラットフォーム
make clean                            # ビルド成果物を削除
```

## Architecture

RSS/Atomフィードをポーリングし、Discord Webhookで新着を通知するCLIアプリ。

```
cmd/
└── rss-discord/
    └── main.go            # エントリーポイント、ロガー、シグナル処理、バナー
internal/
├── config/
│   └── config.go          # Config struct, JSON読み込み, バリデーション
├── feed/
│   └── feed.go            # FeedItem, FetchFeed (gofeed使用)
├── discord/
│   ├── embed.go           # Embed構築
│   └── webhook.go         # Webhook送信 (429リトライ含む)
└── store/
    └── store.go           # 送信済みID永続化 (sync.Mutex)
```

**データフロー**: `startPolling` → `FetchFeed` → フィルタ → `BuildEmbed` → `SendWebhook` → `MarkSent`

## Key Points

- 言語: Go (外部依存: gofeed のみ)
- 設定バリデーション: 手書きValidate()メソッド
- 設定ファイル: `config.json` (テンプレート: `config.example.json`)
- データ永続化: `data/sent.json` (フィードURL → 送信済みID配列)
- ログ: slog (コンソール ANSI色付き + ファイル JSON)
- シャットダウン: signal.NotifyContext (SIGINT/SIGTERM)
