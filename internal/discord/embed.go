package discord

import (
	"regexp"
	"time"

	"github.com/yuu1111/rss-discord/internal/config"
	"github.com/yuu1111/rss-discord/internal/feed"
)

const (
	titleMax       = 256
	descriptionMax = 4096
)

var htmlTagRegex = regexp.MustCompile(`<[^>]*>`)

type Embed struct {
	Title       string       `json:"title,omitempty"`
	Description string       `json:"description,omitempty"`
	URL         string       `json:"url,omitempty"`
	Color       int          `json:"color,omitempty"`
	Timestamp   string       `json:"timestamp,omitempty"`
	Author      *EmbedAuthor `json:"author,omitempty"`
	Footer      *EmbedFooter `json:"footer,omitempty"`
}

type EmbedAuthor struct {
	Name string `json:"name"`
}

type EmbedFooter struct {
	Text string `json:"text"`
}

func BuildEmbed(item feed.FeedItem, feedCfg config.FeedConfig) Embed {
	e := Embed{
		Title:  truncate(item.Title, titleMax),
		URL:    item.Link,
		Color:  feedCfg.Color,
		Author: &EmbedAuthor{Name: feedCfg.Name},
		Footer: &EmbedFooter{Text: "via " + feedCfg.Name},
	}

	if item.Description != "" {
		e.Description = truncate(stripHTML(item.Description), descriptionMax)
	}

	if item.PubDate != "" {
		if t, err := time.Parse(time.RFC3339, item.PubDate); err == nil {
			e.Timestamp = t.Format(time.RFC3339)
		}
	}

	return e
}

func truncate(text string, max int) string {
	runes := []rune(text)
	if len(runes) <= max {
		return text
	}
	return string(runes[:max-3]) + "..."
}

func stripHTML(html string) string {
	return htmlTagRegex.ReplaceAllString(html, "")
}
