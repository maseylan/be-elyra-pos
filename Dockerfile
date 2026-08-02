FROM node:20-alpine AS builder

WORKDIR /app

# Salin HANYA package json terlebih dahulu untuk memaksimalkan layer caching
COPY package*.json ./
# Gunakan 'install' untuk instalasi
RUN npm install

# Source code disalin setelah dependensi (jika kode berubah, npm install tidak diulang)
COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

# Install PM2 di layer awal agar selalu ter-cache meskipun package.json berubah
RUN npm install -g pm2

# Salin package json untuk production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Salin artifact dari builder stage
COPY --from=builder /app/dist ./dist
COPY ecosystem.config.js ./
COPY drizzle ./drizzle

RUN mkdir -p logs

EXPOSE 3000

CMD ["pm2-runtime", "start", "ecosystem.config.js", "--env", "production"]
