# FeatherPanel へのデプロイ

[English](README.md)

RSS Discord は HTTP リスナーを持たない Bun プロセスとして動作します。
FeatherPanel では allocation が1つ必要ですが、そのポートをファイアウォールで
開放する必要はありません。

## 実行時の構成

- アプリケーション: イミュータブルイメージ内の `/opt/rss-discord/cli.js`
- 送信済みアイテムの保存先: `/home/container/data/sent.json`
- ログ: `/home/container/logs`
- イメージ: `ghcr.io/getsetmind/rss-discord:latest`
- ロールバック用イメージ: `ghcr.io/getsetmind/rss-discord:sha-<完全なコミットSHA>`

イメージは非 root ユーザーを使用し、実行時の書き込み先をすべて
`/home/container` 配下に限定しています。

GitHub Actions は `latest` タグとコミット SHA タグを公開したあと、
FeatherPanel の再起動 API を呼び出します。リポジトリの Secrets に
`FEATHERPANEL_URL`、`FEATHERPANEL_API_KEY`、`FEATHERPANEL_SERVER_ID`
を設定してください。

## デプロイ

`rss-discord.env.example` を、Git の追跡対象外である
`rss-discord.env` にコピーし、2つのフィード定義を入力します。
FeatherPanel の URL と API キーは、別の Git の追跡対象外の環境変数ファイルに
保存してください。

```powershell
pwsh -NoProfile -File .\deploy\featherpanel\deploy.ps1 `
  -PanelEnvFile C:\path\to\panel.env `
  -AppEnvFile .\deploy\featherpanel\rss-discord.env `
  -NoStart
```

移行時は `-NoStart` を使用してください。FeatherPanel が新しく作成したサーバーを
自動起動する場合があるため、スクリプトは作成直後に停止を要求します。
サーバーがオフラインになったことを確認し、既存の `data/sent.json` をコピーして、
旧インスタンスを停止してから FeatherPanel のサーバーを起動してください。
これにより Discord への重複通知を防げます。

2つの Webhook 変数は FeatherPanel 上で非表示かつ編集不可に設定されています。
フィードを追加する場合は、Spell の変数一覧と `deploy.ps1` の期待する変数一覧を
同時に拡張してください。
