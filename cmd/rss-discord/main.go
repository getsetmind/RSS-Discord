package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/yuu1111/rss-discord/internal/config"
	"github.com/yuu1111/rss-discord/internal/discord"
	"github.com/yuu1111/rss-discord/internal/feed"
	"github.com/yuu1111/rss-discord/internal/store"
)

var version = "dev"

const (
	sendDelayMs = 600
	maxHistory  = 200
	storePath   = "data/sent.json"
)

// ANSI色コード
const (
	colorReset  = "\033[0m"
	colorDim    = "\033[2m"
	colorBright = "\033[1m"
	colorCyan   = "\033[36m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorRed    = "\033[31m"
)

var levelColors = map[slog.Level]string{
	slog.LevelDebug: colorCyan,
	slog.LevelInfo:  colorGreen,
	slog.LevelWarn:  colorYellow,
	slog.LevelError: colorRed,
}

type consoleHandler struct {
	level slog.Level
	mu    sync.Mutex
	w     io.Writer
}

func (h *consoleHandler) Enabled(_ context.Context, level slog.Level) bool {
	return level >= h.level
}

func (h *consoleHandler) Handle(_ context.Context, r slog.Record) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	timestamp := r.Time.Format(time.RFC3339)
	color := levelColors[r.Level]
	levelStr := strings.ToUpper(r.Level.String())
	for len(levelStr) < 5 {
		levelStr += " "
	}

	var attrs strings.Builder
	r.Attrs(func(a slog.Attr) bool {
		if a.Key == "error" {
			fmt.Fprintf(&attrs, " %sError: %s%s", colorRed, a.Value.String(), colorReset)
		} else {
			fmt.Fprintf(&attrs, " %s=%s", a.Key, a.Value.String())
		}
		return true
	})

	line := fmt.Sprintf("%s[%s]%s %s%s%s %s%s%s",
		colorDim, timestamp, colorReset,
		color, levelStr, colorReset,
		colorBright, r.Message, colorReset,
	)
	if attrs.Len() > 0 {
		line += attrs.String()
	}

	if r.Level >= slog.LevelWarn {
		_, _ = fmt.Fprintln(os.Stderr, line)
	} else {
		_, _ = fmt.Fprintln(os.Stdout, line)
	}

	return nil
}

func (h *consoleHandler) WithAttrs(_ []slog.Attr) slog.Handler { return h }
func (h *consoleHandler) WithGroup(_ string) slog.Handler      { return h }

type fileHandler struct {
	level   slog.Level
	logDir  string
	mu      sync.Mutex
	ensured bool
}

func (h *fileHandler) ensureDir() {
	if h.ensured {
		return
	}
	if err := os.MkdirAll(h.logDir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create log directory: %v\n", err)
	}
	h.ensured = true
}

func getDateString() string {
	jst := time.FixedZone("JST", 9*60*60)
	return time.Now().In(jst).Format("2006-01-02")
}

func (h *fileHandler) Enabled(_ context.Context, level slog.Level) bool {
	return level >= h.level
}

func (h *fileHandler) Handle(_ context.Context, r slog.Record) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.ensureDir()

	entry := map[string]any{
		"timestamp": r.Time.Format(time.RFC3339),
		"level":     strings.ToLower(r.Level.String()),
		"message":   r.Message,
	}

	metadata := make(map[string]any)
	r.Attrs(func(a slog.Attr) bool {
		metadata[a.Key] = a.Value.Any()
		return true
	})
	if len(metadata) > 0 {
		entry["metadata"] = metadata
	}

	data, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	logLine := string(data) + "\n"

	dateStr := getDateString()
	appPath := filepath.Join(h.logDir, "app-"+dateStr+".log")
	h.appendToFile(appPath, logLine)

	if r.Level >= slog.LevelError {
		errPath := filepath.Join(h.logDir, "error-"+dateStr+".log")
		h.appendToFile(errPath, logLine)
	}

	return nil
}

func (h *fileHandler) appendToFile(path, line string) {
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to write log to %s: %v\n", path, err)
		return
	}
	defer func() { _ = f.Close() }()
	_, _ = f.WriteString(line)
}

func (h *fileHandler) WithAttrs(_ []slog.Attr) slog.Handler { return h }
func (h *fileHandler) WithGroup(_ string) slog.Handler      { return h }

type multiHandler struct {
	handlers []slog.Handler
}

func (m *multiHandler) Enabled(ctx context.Context, level slog.Level) bool {
	for _, h := range m.handlers {
		if h.Enabled(ctx, level) {
			return true
		}
	}
	return false
}

func (m *multiHandler) Handle(ctx context.Context, r slog.Record) error {
	for _, h := range m.handlers {
		if h.Enabled(ctx, r.Level) {
			if err := h.Handle(ctx, r); err != nil {
				return err
			}
		}
	}
	return nil
}

func (m *multiHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	handlers := make([]slog.Handler, len(m.handlers))
	for i, h := range m.handlers {
		handlers[i] = h.WithAttrs(attrs)
	}
	return &multiHandler{handlers: handlers}
}

func (m *multiHandler) WithGroup(name string) slog.Handler {
	handlers := make([]slog.Handler, len(m.handlers))
	for i, h := range m.handlers {
		handlers[i] = h.WithGroup(name)
	}
	return &multiHandler{handlers: handlers}
}

func setupLogger() {
	handler := &multiHandler{
		handlers: []slog.Handler{
			&consoleHandler{level: slog.LevelInfo, w: os.Stdout},
			&fileHandler{level: slog.LevelInfo, logDir: "./logs"},
		},
	}
	slog.SetDefault(slog.New(handler))
}

func printBanner() {
	fmt.Print("\033]0;RSS Discord\007")
	fmt.Printf(`
  ╦═╗╔═╗╔═╗  ╔╦╗┬┌─┐┌─┐┌─┐┬─┐┌┬┐
  ╠╦╝╚═╗╚═╗   ║║│└─┐│  │ │├┬┘ ││
  ╩╚═╚═╝╚═╝  ═╩╝┴└─┘└─┘└─┘┴└──┴┘  v%s
`, version)
	fmt.Println()
}

func main() {
	setupLogger()
	printBanner()

	args := os.Args[1:]
	configPath := "config.json"
	runOnce := false

	for _, arg := range args {
		switch {
		case arg == "--once":
			runOnce = true
		case !strings.HasPrefix(arg, "--"):
			configPath = arg
		}
	}

	if err := run(configPath, runOnce); err != nil {
		slog.Error("致命的なエラー", "error", err)
		os.Exit(1)
	}
}

func run(configPath string, runOnce bool) error {
	cfg, err := config.Load(configPath)
	if err != nil {
		return err
	}

	s := store.New(storePath, maxHistory)
	if err := s.Load(); err != nil {
		return err
	}

	slog.Info("設定読み込み完了", "feeds", len(cfg.Feeds), "config", configPath)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if runOnce {
		var wg sync.WaitGroup
		for i := range cfg.Feeds {
			wg.Add(1)
			go func(fc config.FeedConfig) {
				defer wg.Done()
				processFeed(ctx, fc, s)
			}(cfg.Feeds[i])
		}
		wg.Wait()
		slog.Info("Done.")
		return nil
	}

	var wg sync.WaitGroup
	for i := range cfg.Feeds {
		wg.Add(1)
		go func(fc config.FeedConfig) {
			defer wg.Done()
			startPolling(ctx, fc, s)
		}(cfg.Feeds[i])
	}

	slog.Info("ポーリング開始 (Ctrl+C で停止)")
	wg.Wait()
	slog.Info("シャットダウン完了")

	return nil
}

func startPolling(ctx context.Context, fc config.FeedConfig, s *store.Store) {
	interval := time.Duration(fc.IntervalMinutes * float64(time.Minute))
	slog.Info("ポーリング開始", "feed", fc.Name, "interval", fc.IntervalMinutes)

	processFeed(ctx, fc, s)

	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(interval):
			processFeed(ctx, fc, s)
		}
	}
}

func processFeed(ctx context.Context, fc config.FeedConfig, s *store.Store) {
	slog.Info("Fetching...", "feed", fc.Name)

	items, err := feed.FetchFeed(ctx, fc.URL)
	if err != nil {
		slog.Error("フィード取得失敗", "feed", fc.Name, "error", err)
		return
	}

	var newItems []feed.FeedItem
	for _, item := range items {
		if item.ID != "" && !s.HasSent(fc.URL, item.ID) {
			newItems = append(newItems, item)
		}
	}

	if len(newItems) == 0 {
		slog.Info("No new items.", "feed", fc.Name)
		return
	}

	slog.Info("新着アイテム検出", "feed", fc.Name, "count", len(newItems))

	// 古い順に送信 (Discordでの表示が時系列順になるよう)
	for i := len(newItems) - 1; i >= 0; i-- {
		item := newItems[i]
		embed := discord.BuildEmbed(item, fc)
		if err := discord.SendWebhook(ctx, fc.WebhookURL, embed, fc.URL); err != nil {
			slog.Error("送信失敗", "feed", fc.Name, "title", item.Title, "error", err)
			break
		}
		if err := s.MarkSent(fc.URL, item.ID); err != nil {
			slog.Error("ストア保存失敗", "feed", fc.Name, "error", err)
			break
		}
		slog.Info("Sent", "feed", fc.Name, "title", item.Title)

		select {
		case <-ctx.Done():
			return
		case <-time.After(sendDelayMs * time.Millisecond):
		}
	}
}
