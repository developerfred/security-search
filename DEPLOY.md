# Community Sync Deployment

## Deploying the Community API

### Option 1: Cloudflare Workers (Recommended - Free)

```bash
# Install wrangler
npm install -g wrangler

# Login
wrangler login

# Deploy
cd api
wrangler deploy
```

### Option 2: Vercel

```bash
# Install vercel
npm install -g vercel

# Deploy
cd api
vercel --prod
```

### Option 3: Self-hosted

```bash
# Using Node.js
cd api
npm init -y
npm install hono
npx hono deploy node worker.js
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/list` | Get community scam/safe lists |
| POST | `/api/report` | Submit a new report |
| GET | `/api/stats` | Get community statistics |

## Environment Variables

Set your community API URL in `background.js`:
```javascript
COMMUNITY_API: 'https://your-api.workers.dev/api'
```

## Community Reporting Flow

1. User reports scam/safe site in popup
2. Extension saves locally first
3. Extension submits to community API (async)
4. Other users sync on "Sync Community"
5. Reports with 3+ votes are considered verified

## Rate Limiting

Recommended: 10 requests per minute per IP

## Moderation

Reports with high votes (5+) are auto-verified.
Manual review endpoint can be added for edge cases.
