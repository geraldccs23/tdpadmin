# ============================================================
# restaurantdp — Frontend build stage
# ============================================================
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ============================================================
# Production stage with nginx
# ============================================================
FROM nginx:alpine
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
EXPOSE 80
