# ElyraPOS Backend

Backend for ElyraPOS Multi-Tenant Point of Sale system. Built with Express.js, TypeScript, Drizzle ORM, and PostgreSQL.

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Run Tests:
   ```bash
   npm test
   ```

## Production Deployment (VPS / Self-Hosted)

We use **PM2** in `cluster` mode to utilize all CPU cores on the server and ensure zero-downtime reloads. The backend is completely stateless and relies on Redis for Socket.io broadcasting and tenant resolution caching.

### 1. Prerequisite Setup
Ensure you have PM2 and `pm2-logrotate` installed globally:
```bash
npm install -g pm2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 2. PgBouncer Configuration (CRITICAL)
If you deploy 4 instances (on a 4-core machine), and `poolManager.ts` is set to `max: 20` connections per worker:
- **Max Client Connections**: The Node.js apps can open up to `4 * 20 = 80` connections.
- Your `/etc/pgbouncer/pgbouncer.ini` must have `max_client_conn` set to at least `100`.
- Keep `default_pool_size` (the actual connections PgBouncer makes to PostgreSQL) reasonable (e.g., `20-40`).

### 3. Build & Deploy
Compile the TypeScript code and start the cluster:
```bash
npm run build
pm2 start ecosystem.config.js
```

### 4. Zero-Downtime Updates
When deploying a new version without dropping ongoing requests:
```bash
git pull origin main
npm install
npm run build
pm2 reload pos-api
```

### 5. Persistence & Monitoring
To ensure the backend starts automatically when the VPS reboots:
```bash
pm2 save
pm2 startup
```

Monitor worker metrics (CPU/RAM):
```bash
pm2 monit
```

View aggregated logs from all workers:
```bash
pm2 logs pos-api
```
