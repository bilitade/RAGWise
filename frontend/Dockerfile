# =============================================================================
# Stage 1 – build
#   Builds the React/Vite app. VITE_API_BASE_URL is intentionally left empty
#   so all /api/* calls are relative — nginx proxies them to the backend.
# =============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies (layer-cached when package files don't change)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN VITE_API_BASE_URL="" npm run build


# =============================================================================
# Stage 2 – serve
#   Lightweight nginx image that only ships the compiled static files.
# =============================================================================
FROM nginx:stable-alpine AS runtime

# Replace default nginx config with ours (SPA fallback + API proxy)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled assets from build stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
