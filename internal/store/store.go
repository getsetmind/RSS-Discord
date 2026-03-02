package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

type Store struct {
	mu         sync.Mutex
	data       map[string][]string
	path       string
	maxHistory int
}

func New(path string, maxHistory int) *Store {
	return &Store{
		data:       make(map[string][]string),
		path:       path,
		maxHistory: maxHistory,
	}
}

func (s *Store) Load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	raw, err := os.ReadFile(s.path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("ストア読み込み失敗: %w", err)
	}

	if err := json.Unmarshal(raw, &s.data); err != nil {
		return fmt.Errorf("ストアパース失敗: %w", err)
	}

	return nil
}

func (s *Store) HasSent(feedURL, itemID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	ids, ok := s.data[feedURL]
	if !ok {
		return false
	}
	for _, id := range ids {
		if id == itemID {
			return true
		}
	}
	return false
}

func (s *Store) MarkSent(feedURL, itemID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.data[feedURL] = append(s.data[feedURL], itemID)

	if len(s.data[feedURL]) > s.maxHistory {
		s.data[feedURL] = s.data[feedURL][len(s.data[feedURL])-s.maxHistory:]
	}

	return s.save()
}

func (s *Store) save() error {
	dir := filepath.Dir(s.path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("ストアディレクトリ作成失敗: %w", err)
	}

	data, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return fmt.Errorf("ストアのシリアライズ失敗: %w", err)
	}

	return os.WriteFile(s.path, data, 0644)
}
