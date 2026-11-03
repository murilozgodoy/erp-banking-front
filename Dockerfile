# syntax=docker/dockerfile:1

# ---------- Stage 1: build da SPA ----------
FROM node:22-alpine AS build
WORKDIR /app

# As VITE_* são embutidas no bundle em tempo de build (sobrescreva com --build-arg).
# Nada aqui é segredo: tudo que vai para o bundle é público.
ARG VITE_ONBOARDING_API_URL=http://localhost:8080/onboarding
ARG VITE_SCORE_API_URL=http://localhost:8080/score
ARG VITE_TRANSACTIONS_API_URL=http://localhost:8080/transactions
ARG VITE_GATEWAY_URL=http://localhost:8080
ARG VITE_GRAFANA_URL=http://localhost:8081
ARG VITE_PROMETHEUS_URL=http://localhost:8082
ARG VITE_API_TIMEOUT_MS=10000
ARG VITE_AUTH0_DOMAIN=dev-slbrfj6dwk1pdeox.us.auth0.com
ARG VITE_AUTH0_CLIENT_ID=OHeEe32c8zz3iLmp1pnrdfe3wCUElgab
ARG VITE_AUTH0_AUDIENCE=https://erp-banking-api

ENV VITE_ONBOARDING_API_URL=$VITE_ONBOARDING_API_URL \
    VITE_SCORE_API_URL=$VITE_SCORE_API_URL \
    VITE_TRANSACTIONS_API_URL=$VITE_TRANSACTIONS_API_URL \
    VITE_GATEWAY_URL=$VITE_GATEWAY_URL \
    VITE_GRAFANA_URL=$VITE_GRAFANA_URL \
    VITE_PROMETHEUS_URL=$VITE_PROMETHEUS_URL \
    VITE_API_TIMEOUT_MS=$VITE_API_TIMEOUT_MS \
    VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN \
    VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID \
    VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- Stage 2: nginx não-root ----------
FROM nginxinc/nginx-unprivileged:1.27-alpine

LABEL org.opencontainers.image.source=https://github.com/murilozgodoy/erp-banking-front \
      org.opencontainers.image.title="erp-banking-front" \
      org.opencontainers.image.description="Frontend do ERP Banking (SPA React servida por nginx)"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
