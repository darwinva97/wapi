# ===========================================================================
# Stage 1: Build the Elixir release
# ===========================================================================
FROM hexpm/elixir:1.17.3-erlang-27.1.2-debian-bookworm-20241016-slim AS elixir-build

RUN apt-get update -y && \
    apt-get install -y build-essential git && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install hex + rebar
RUN mix local.hex --force && \
    mix local.rebar --force

# Set build ENV
ENV MIX_ENV=prod

# Install mix dependencies
COPY mix.exs mix.lock ./
RUN mix deps.get --only $MIX_ENV
RUN mkdir config

# Copy compile-time config
COPY config/config.exs config/${MIX_ENV}.exs config/
RUN mix deps.compile

# Copy application source
COPY lib lib
COPY priv/repo priv/repo

# Compile the release
RUN mix compile

# Copy runtime config
COPY config/runtime.exs config/

# Build release
RUN mix release

# ===========================================================================
# Stage 2: Build the Node.js baileys-bridge
# ===========================================================================
FROM node:20-slim AS node-build

WORKDIR /app/baileys-bridge

COPY priv/baileys-bridge/package.json priv/baileys-bridge/package-lock.json* ./
RUN npm ci --omit=dev

COPY priv/baileys-bridge/ ./

# ===========================================================================
# Stage 3: Runtime image
# ===========================================================================
FROM debian:bookworm-slim AS runtime

RUN apt-get update -y && \
    apt-get install -y libstdc++6 openssl libncurses5 locales curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Node.js runtime (needed for baileys-bridge)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Set locale
RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

WORKDIR /app

# Create non-root user
RUN useradd --create-home --shell /bin/bash wapi
RUN mkdir -p /app/data/sessions /app/data/media && \
    chown -R wapi:wapi /app

# Copy Elixir release
COPY --from=elixir-build --chown=wapi:wapi /app/_build/prod/rel/wapi ./

# Copy Node.js baileys-bridge
COPY --from=node-build --chown=wapi:wapi /app/baileys-bridge ./priv/baileys-bridge

USER wapi

# Runtime environment
ENV PHX_HOST=localhost
ENV PORT=4000
ENV NODE_PATH=/usr/bin/node
ENV BRIDGE_SCRIPT=/app/priv/baileys-bridge/index.js
ENV SESSIONS_DIR=/app/data/sessions
ENV MEDIA_DIR=/app/data/media

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["bin/wapi", "start"]
