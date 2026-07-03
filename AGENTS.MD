# Commands

```bash
# 開発
bun run dev                           # ポーリング開始
bun run dev --once                    # 1回実行して終了

# 品質チェック
bun run lint                          # Biome lint
bun run typecheck                     # TypeScript型チェック

# ビルド
bun run build                         # dist/にバンドル
```

# Architecture

RSS/Atomフィードをポーリングし、Discord Webhookで新着を通知するCLIアプリ。

```
src/
├── main.ts                # エントリーポイント、シグナル処理、ポーリング
├── config.ts              # JSON読み込み、バリデーション
├── feed.ts                # FeedItem正規化、fetchFeed (rss-parser使用)
├── discord.ts             # Embed構築、Webhook送信 (429リトライ含む)
├── store.ts               # 送信済みID永続化
├── logger.ts              # コンソールANSI色付き + 日別JSONログ
└── types.ts               # 共有型定義
```

**データフロー**: `startPolling` → `fetchFeed` → フィルタ → `buildEmbed` → `sendWebhook` → `markSent`

# Key Points

- 言語: TypeScript (Bun 1.3+)
- 設定バリデーション: 手書きバリデーション
- 設定ファイル: `config.json` (テンプレート: `config.example.json`)
- データ永続化: `data/sent.json` (フィードURL → 送信済みID配列)
- ログ: 独自Logger (コンソール ANSI色付き + ファイル JSON)
- シャットダウン: AbortController (SIGINT/SIGTERM)
- 共通設定: `@yuu1111/tsconfig`, `@yuu1111/biome-config`
