# Commands

```bash
# 開発
bun run dev                           # ポーリング開始
bun run dev --once                    # 1回実行して終了

# 品質チェック
bun test                              # 単体テスト
bun run lint                          # Biome lint
bun run typecheck                     # TypeScript型チェック

# ビルド
bun run build                         # dist/にバンドル
```

# Architecture

RSS/Atomフィードをポーリングし、Discord Webhookで新着を通知するCLIアプリ。
設定は Docker / Pterodactyl / FeatherPanel で扱いやすい環境変数に一本化している。

```
src/
├── main.ts                # エントリーポイント、シグナル処理、ポーリング
├── config.ts              # 環境変数読み込み、バリデーション
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
- 設定: 環境変数 (`.env.example` を参照)
- データ永続化: `data/sent.json` (フィードURL → 送信済みID配列)
- ログ: 独自Logger (コンソール ANSI色付き + ファイル JSON)
- シャットダウン: AbortController (SIGINT/SIGTERM)
- 共通設定: `@yuu1111/tsconfig`, `@yuu1111/biome-config`
