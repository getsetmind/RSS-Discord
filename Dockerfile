FROM oven/bun:1.3.14-alpine AS build

WORKDIR /build

COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile

COPY src ./src
RUN bun run build

FROM oven/bun:1.3.14-alpine

RUN apk add --no-cache bash \
	&& adduser -D -h /home/container -s /bin/bash container

WORKDIR /opt/rss-discord

COPY --from=build /build/dist/cli.js ./cli.js
COPY deploy/featherpanel/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh \
	&& mkdir -p /home/container/data /home/container/logs \
	&& chown -R container:container /home/container

USER container

ENV USER=container \
	HOME=/home/container

WORKDIR /home/container

CMD ["/bin/bash", "/entrypoint.sh"]
