package discord

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"time"
)

const (
	githubAvatarURL = "https://github.com/github.png"
	rssAvatarURL    = "https://raw.githubusercontent.com/getsetmind/RSS-Discord/main/assets/rss-icon.png"
)

type webhookPayload struct {
	Embeds    []Embed `json:"embeds"`
	Username  string  `json:"username,omitempty"`
	AvatarURL string  `json:"avatar_url,omitempty"`
}

type webhookIdentity struct {
	username  string
	avatarURL string
}

type rateLimitResponse struct {
	RetryAfter float64 `json:"retry_after"`
}

func SendWebhook(ctx context.Context, webhookURL string, embed Embed, feedURL string) error {
	identity := resolveWebhookIdentity(feedURL)
	payload := webhookPayload{
		Embeds:    []Embed{embed},
		Username:  identity.username,
		AvatarURL: identity.avatarURL,
	}

	statusCode, body, err := doPostWebhook(ctx, webhookURL, payload)
	if err != nil {
		return err
	}

	if statusCode == http.StatusTooManyRequests {
		var rl rateLimitResponse
		_ = json.Unmarshal(body, &rl)
		waitSec := rl.RetryAfter
		if waitSec <= 0 {
			waitSec = 1
		}

		slog.Warn("Rate limited", "retry_after_ms", int(waitSec*1000))

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Duration(waitSec*1000) * time.Millisecond):
		}

		retryStatus, _, retryErr := doPostWebhook(ctx, webhookURL, payload)
		if retryErr != nil {
			return retryErr
		}
		if !isSuccessStatus(retryStatus) {
			return fmt.Errorf("Discord webhook failed after retry: HTTP %d", retryStatus)
		}
		return nil
	}

	if !isSuccessStatus(statusCode) {
		return fmt.Errorf("Discord webhook error: HTTP %d - %s", statusCode, string(body))
	}

	return nil
}

func doPostWebhook(ctx context.Context, webhookURL string, payload webhookPayload) (int, []byte, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	data, err := json.Marshal(payload)
	if err != nil {
		return 0, nil, fmt.Errorf("ペイロードのシリアライズ失敗: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, webhookURL, bytes.NewReader(data))
	if err != nil {
		return 0, nil, fmt.Errorf("リクエスト作成失敗: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, nil, fmt.Errorf("Webhook送信失敗: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	body, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, body, nil
}

func resolveWebhookIdentity(feedURL string) webhookIdentity {
	if u, err := url.Parse(feedURL); err == nil && u.Hostname() == "github.com" {
		return webhookIdentity{username: "GitHub", avatarURL: githubAvatarURL}
	}
	return webhookIdentity{username: "RSS", avatarURL: rssAvatarURL}
}

func isSuccessStatus(code int) bool {
	return code == http.StatusNoContent || (code >= 200 && code < 300)
}
