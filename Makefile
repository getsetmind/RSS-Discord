BINARY_NAME := rss-discord
OUT_DIR := out

.PHONY: install build build-all build-linux build-windows build-darwin lint test clean

install:
	bun install --frozen-lockfile

build:
	bun run build

build-all: build

build-linux: build

build-windows: build

build-darwin: build

lint:
	bun run lint

test:
	bun test

clean:
	rm -rf dist
	rm -rf $(OUT_DIR)
