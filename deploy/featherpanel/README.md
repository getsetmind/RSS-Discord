# FeatherPanel deployment

RSS Discord runs as a Bun process without an HTTP listener. FeatherPanel still
requires one allocation, but its port must not be opened in the firewall.

## Runtime layout

- Application: `/opt/rss-discord/cli.js` in the immutable image
- Sent-item store: `/home/container/data/sent.json`
- Logs: `/home/container/logs`
- Image: `ghcr.io/getsetmind/rss-discord:latest`
- Rollback image: `ghcr.io/getsetmind/rss-discord:sha-<full commit SHA>`

The image uses a non-root user and keeps all runtime writes under
`/home/container`.

GitHub Actions publishes `latest` and the commit SHA tag, then calls the
FeatherPanel restart API. Repository secrets `FEATHERPANEL_URL`,
`FEATHERPANEL_API_KEY`, and `FEATHERPANEL_SERVER_ID` must be configured.

## Deploy

Copy `rss-discord.env.example` to the ignored `rss-discord.env` and fill in the
two feed definitions. Keep the FeatherPanel URL and API key in a separate,
ignored environment file.

```powershell
pwsh -NoProfile -File .\deploy\featherpanel\deploy.ps1 `
  -PanelEnvFile C:\path\to\panel.env `
  -AppEnvFile .\deploy\featherpanel\rss-discord.env `
  -NoStart
```

Use `-NoStart` during migration. The script immediately requests a stop because
FeatherPanel can auto-start a newly created server. Confirm that it is offline,
copy the existing `data/sent.json`, stop the old instance, and then start the
FeatherPanel server. This avoids duplicate Discord notifications.

The two webhook variables are hidden and non-editable in FeatherPanel. To add
more feeds, extend the Spell variable list and the expected variable list in
`deploy.ps1` together.
