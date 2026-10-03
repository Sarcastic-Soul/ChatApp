# Development

[Back to the README](../README.md)

## With Docker

The quickest way. One command starts MongoDB, the backend and the built frontend behind nginx. You need Docker with Compose.

```bash
git clone https://github.com/Sarcastic-Soul/ChatApp.git
cd ChatApp
docker compose up --build -d
docker compose exec backend node seed.ts   # demo users, password123
```

Then open http://localhost:8080 and log in as `alice`.

- **No setup needed:** the compose file sets local-only secrets.
- **Uploads and magic reply need real keys:** put `CLOUDINARY_*` and `GROQ_API_KEY` in a `.env` file next to `docker-compose.yml`.
- **To stop and delete the database:** `docker compose down -v`.
- **Routing:** nginx forwards `/api` to the backend the same way `vercel.json` does in production, and the browser opens the socket to `localhost:5000` directly.

**Three backends behind a load balancer**, with Redis connecting them:

```bash
docker compose -f docker-compose.yml -f docker-compose.scale.yml up --build -d
```

- Port 5000 is now nginx (`deploy/nginx-lb.conf`), which spreads requests over the three backends.
- Every response has an `X-Upstream` header saying which one answered.

## Without Docker

**You need:**

- Node.js 22
- pnpm (`npm i -g pnpm`)
- A MongoDB database (Atlas, or local with `docker run -d -p 27017:27017 mongo:8.2`)

**1. Clone and install**

```bash
git clone https://github.com/Sarcastic-Soul/ChatApp.git
cd ChatApp

cd backend && pnpm install
cd ../frontend && pnpm install
```

**2. Create `backend/.env`** (see [Environment variables](#environment-variables))

**3. Load the demo data**

> [!WARNING]
> The seed script deletes all users, chats and messages first. Only point it at a database you can wipe.

```bash
cd backend
pnpm run seed
```

**4. Start both servers** in two terminals

```bash
# Terminal 1: API and sockets on http://localhost:5000
cd backend && pnpm run dev

# Terminal 2: app on http://localhost:3000
cd frontend && pnpm run dev
```

In development, Vite forwards `/api` to `VITE_API_URL` (default `http://localhost:5000`).

## Scripts

**Backend** (run in `backend/`)

| Command | What it does |
| --- | --- |
| `pnpm run dev` | Start the server and restart on file changes (`node --watch`) |
| `pnpm start` | Start the server |
| `pnpm run seed` | Replace the database contents with demo data |
| `pnpm run backfill:search` | Add search hashes to messages saved before search existed (uses `MONGO_DB_URI`) |
| `pnpm run openapi` | Rebuild `frontend/public/openapi.json` from the zod schemas |
| `pnpm run typecheck` | Check types with `tsc` (source strict, tests relaxed) |
| `pnpm test` | Run the API and socket tests |
| `pnpm run test:coverage` | Run the tests with a coverage report |

**Frontend** (run in `frontend/`)

| Command | What it does |
| --- | --- |
| `pnpm run dev` | Start the Vite dev server |
| `pnpm run build` | Build for production into `dist/` |
| `pnpm run typecheck` | Check types with `tsc` (strict) |
| `pnpm run lint` | Run ESLint |
| `pnpm test` | Run the component, store, cache and formatter tests |
| `pnpm run test:e2e` | Run the Playwright end-to-end tests (starts its own backend and in-memory MongoDB) |
| `pnpm run bench:cache` | Time opening a chat with and without the IndexedDB cache (writes `docs/benchmarks/cache.json`) |

## Environment variables

The backend reads `backend/.env` with Node's built-in `--env-file-if-exists`, so there is no `dotenv` package. Variables already set in the shell win over the file.

**Required**

| Variable | Description |
| --- | --- |
| `MONGO_DB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing login and socket tokens |
| `ENCRYPTION_KEY` | Secret for message encryption. The server won't start without it, and changing it makes old messages unreadable |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret, used to sign uploads |

**Optional features**

| Variable | Turns on | Description |
| --- | --- | --- |
| `GROQ_API_KEY` | Magic reply | Key from [console.groq.com/keys](https://console.groq.com/keys) |
| `GROQ_MODEL` | | Groq model ID. Defaults to `openai/gpt-oss-120b` |
| `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN` | Calls through strict NATs | Cloudflare Realtime TURN key. Lets calls connect on mobile data and office Wi-Fi |
| `METERED_DOMAIN`, `METERED_API_KEY` | Calls through strict NATs | Metered TURN instead of Cloudflare, e.g. `yourapp.metered.live`. With neither set, calls use STUN only |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Push notifications | Make a pair with `npx web-push generate-vapid-keys`. Without them the notifications setting is hidden |
| `VAPID_SUBJECT` | Push notifications | Needed with the VAPID keys. Contact for the push services, e.g. `mailto:you@example.com` |
| `REDIS_URL` | More than one backend | Redis connection string, e.g. `redis://localhost:6379`. Sockets, online status and the rate limit are shared through it |

**Other**

| Variable | Description |
| --- | --- |
| `PORT` | Defaults to `5000` |
| `NODE_ENV` | Set to `development` locally, so the login cookie works over plain HTTP |
| `CLIENT_ORIGINS` | Extra CORS origins, comma-separated. The Vercel URL and `localhost:3000` are allowed already |

**Frontend** (optional, in `frontend/.env`)

| Variable | Description |
| --- | --- |
| `VITE_API_URL` | Backend URL. Used by the dev proxy, and by the socket client to reach the backend directly |

## Project structure

```text
ChatApp/
├── .github/workflows/
│   ├── ci.yml            # Type checks, lint, tests and build on every push
│   └── keep-alive.yml    # Pings the backend every 10 minutes
├── backend/
│   ├── config/           # Allowed CORS origins, required env variables, Redis setup
│   ├── controllers/      # Route handlers (auth, messages, groups, users, uploads)
│   ├── db/               # MongoDB connection
│   ├── middleware/       # Auth check, rate limit, zod validation
│   ├── models/           # Mongoose schemas (User, Message, Conversation)
│   ├── routes/           # REST routes
│   ├── socket/           # Socket.io server, rooms, online status and WebRTC signaling
│   ├── utils/            # Encryption, profanity filter, JWT and Cloudinary helpers
│   ├── validation/       # zod schemas for requests and socket events
│   ├── scripts/          # e2e server on an in-memory MongoDB, search backfill, OpenAPI file
│   ├── tests/            # Vitest API and socket tests
│   ├── types/            # Express request type additions (req.user)
│   ├── app.ts            # Express app with every route attached
│   ├── Dockerfile        # Production image
│   ├── seed.ts           # Demo data
│   ├── server.ts         # Entry point, starts the server
│   └── tsconfig.json     # Type checking only; Node runs the .ts files
├── deploy/
│   └── nginx-lb.conf     # Load balancer for the three-server setup
├── docs/
│   ├── architecture.d2   # Architecture diagram source
│   ├── benchmarks/       # Cache and load test results
│   ├── how-it-works.md   # Delivery, scaling, encryption and search in detail
│   ├── testing.md        # What the tests cover, and the benchmarks
│   ├── development.md    # Running locally, scripts and environment variables
│   └── deployment.md     # Vercel, Render and GitHub Actions setup
├── docker-compose.yml    # MongoDB, backend and frontend together
├── docker-compose.scale.yml  # Adds Redis, three backends and nginx in front
├── frontend/
│   ├── e2e/              # Playwright end-to-end tests
│   ├── public/           # Icons, service worker, openapi.json and the /docs page
│   ├── src/
│   │   ├── components/   # Chat, sidebar, call and modal components
│   │   ├── context/      # Auth, socket and call state
│   │   ├── hooks/        # Data fetching and actions
│   │   ├── pages/        # Landing, login, sign-up, chat, profile and group pages
│   │   ├── test/         # Vitest setup and a render helper with the app's providers
│   │   ├── utils/        # IndexedDB cache, uploads, push and formatters
│   │   ├── zustand/      # Global stores
│   │   ├── main.tsx      # Entry point
│   │   └── types.ts      # API response and socket event types
│   ├── Dockerfile        # Build, then serve with nginx
│   ├── nginx.conf        # /api proxy and SPA fallback for Docker
│   ├── tsconfig.json     # Type checking only; Vite strips the types
│   └── vercel.json       # /api proxy and SPA fallback on Vercel
└── loadtest/
    └── chat.js           # k6 load test: message delivery latency
```

## Diagram and API reference

The architecture diagram is written in [D2](https://d2lang.com) (`docs/architecture.d2`). To redraw it after a change:

```bash
d2 docs/architecture.d2 docs/architecture.svg
```

The API reference page reads [`frontend/public/openapi.json`](../frontend/public/openapi.json), which is built from the same zod schemas the server checks input with. After changing a route, run `pnpm run openapi` in `backend/`. Locally the page is at http://localhost:3000/docs.
