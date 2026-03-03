FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -ldflags "-s -w" -o /rss-discord ./cmd/rss-discord

FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=build /rss-discord .
VOLUME ["/app/logs", "/app/data"]
ENTRYPOINT ["./rss-discord"]
