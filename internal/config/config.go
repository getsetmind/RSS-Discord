package config

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strings"
)

type FeedConfig struct {
	Name            string  `json:"name"`
	URL             string  `json:"url"`
	WebhookURL      string  `json:"webhookUrl"`
	Color           int     `json:"color"`
	IntervalMinutes float64 `json:"intervalMinutes"`
}

type AppConfig struct {
	Feeds []FeedConfig `json:"feeds"`
}

func Load(path string) (*AppConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("設定ファイルの読み込みに失敗: %w", err)
	}

	var cfg AppConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("設定ファイルのパースに失敗: %w", err)
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("設定バリデーションエラー: %w", err)
	}

	return &cfg, nil
}

func (c *AppConfig) Validate() error {
	if len(c.Feeds) == 0 {
		return fmt.Errorf("feeds は1件以上必要です")
	}

	for i, f := range c.Feeds {
		if strings.TrimSpace(f.Name) == "" {
			return fmt.Errorf("feeds[%d].name は空にできません", i)
		}

		if _, err := url.ParseRequestURI(f.URL); err != nil {
			return fmt.Errorf("feeds[%d].url が不正です: %s", i, f.URL)
		}

		if !strings.HasPrefix(f.WebhookURL, "https://discord.com/api/webhooks/") {
			return fmt.Errorf("feeds[%d].webhookUrl は https://discord.com/api/webhooks/ で始まる必要があります", i)
		}

		if f.Color < 0 {
			return fmt.Errorf("feeds[%d].color は0以上である必要があります", i)
		}

		if f.IntervalMinutes <= 0 {
			return fmt.Errorf("feeds[%d].intervalMinutes は正の数である必要があります", i)
		}
	}

	return nil
}
