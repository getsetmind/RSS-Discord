package feed

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/mmcdole/gofeed"
)

type FeedItem struct {
	ID          string
	Title       string
	Link        string
	Description string
	PubDate     string
	Author      string
}

func FetchFeed(ctx context.Context, url string) ([]FeedItem, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("リクエスト作成失敗: %w", err)
	}
	req.Header.Set("User-Agent", "rss-discord/1.0")
	req.Header.Set("Accept", "application/rss+xml, application/atom+xml, application/xml, text/xml")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("フィード取得失敗: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		_, _ = io.ReadAll(resp.Body)
		return nil, fmt.Errorf("HTTP %d fetching %s", resp.StatusCode, url)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("レスポンス読み取り失敗: %w", err)
	}

	parser := gofeed.NewParser()
	parsed, err := parser.ParseString(string(body))
	if err != nil {
		return nil, fmt.Errorf("フィードパース失敗: %w", err)
	}

	items := make([]FeedItem, 0, len(parsed.Items))
	for _, item := range parsed.Items {
		fi := normalize(item)
		if fi.ID != "" {
			items = append(items, fi)
		}
	}

	return items, nil
}

func normalize(item *gofeed.Item) FeedItem {
	id := item.GUID
	if id == "" {
		id = item.Link
	}
	if id == "" {
		id = item.Title
	}

	title := item.Title
	if title == "" {
		title = "Untitled"
	}

	var pubDate string
	if item.PublishedParsed != nil {
		pubDate = item.PublishedParsed.Format(time.RFC3339)
	} else if item.UpdatedParsed != nil {
		pubDate = item.UpdatedParsed.Format(time.RFC3339)
	} else if item.Published != "" {
		pubDate = item.Published
	}

	var author string
	if item.Author != nil {
		author = item.Author.Name
	}

	return FeedItem{
		ID:          id,
		Title:       title,
		Link:        item.Link,
		Description: item.Description,
		PubDate:     pubDate,
		Author:      author,
	}
}
