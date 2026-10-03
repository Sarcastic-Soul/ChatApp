<h1 align="center">ChatApp</h1>

<p align="center">
  A full-stack real-time chat app with group chats, voice notes, and peer-to-peer voice and video calls.<br>
  Messages are end-to-end encrypted in the browser, so the server stores text it can't read.
</p>

<p align="center">
  <a href="https://chatapp-e2e.vercel.app/"><img alt="Live demo" src="https://img.shields.io/badge/Live_demo-chatapp--e2e-111?style=flat-square&logo=vercel"></a>
  <a href="https://github.com/Sarcastic-Soul/ChatApp/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/Sarcastic-Soul/ChatApp/ci.yml?style=flat-square&label=tests"></a>
  <a href="https://github.com/Sarcastic-Soul/ChatApp/actions/workflows/keep-alive.yml"><img alt="Keep backend awake" src="https://img.shields.io/github/actions/workflow/status/Sarcastic-Soul/ChatApp/keep-alive.yml?style=flat-square&label=backend%20ping"></a>
</p>

<p align="center">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-222?style=flat-square&logo=react">
  <img alt="Node 22" src="https://img.shields.io/badge/Node-22-222?style=flat-square&logo=nodedotjs">
  <img alt="MongoDB" src="https://img.shields.io/badge/MongoDB-Mongoose_9-222?style=flat-square&logo=mongodb">
  <img alt="Socket.io" src="https://img.shields.io/badge/Socket.io-4-222?style=flat-square&logo=socketdotio">
</p>

<p align="center">
  <a href="#try-it">Try it</a> ·
  <a href="#features">Features</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#tech-stack">Tech stack</a> ·
  <a href="#running-locally">Running locally</a> ·
  <a href="#testing">Testing</a> ·
  <a href="https://chatapp-e2e.vercel.app/docs/">API reference</a> ·
  <a href="#deployment">Deployment</a>
</p>

<p align="center">
  <img alt="ChatApp group chat" src="./screenshots/chat_ss.png">
</p>

## Try it

Open the [live app](https://chatapp-e2e.vercel.app/) and press **Try the demo account**, or log in by hand:

| Username | Password | Encryption passphrase |
| --- | --- | --- |
| `alice` | `password123` | `alice demo passphrase` (filled in for you) |

Good to know:

- **The demo account is shared**, so its passphrase is public.
- **Alice's chats show every feature**: photos, a video, an audio clip, replies, reactions, edited, deleted and forwarded messages, call logs and two groups.
- **Demo chats are not end-to-end encrypted.** The seeded people have never logged in and have no keys, so those chats are encrypted on the server only.
- **To see end-to-end encryption**, sign up two accounts of your own.
- **The first request can be slow.** The backend runs on Render's free tier. A GitHub Actions job pings it every 10 minutes, but if it has been asleep, the first request can take up to a minute.

## Features

### Messaging

- One-on-one and group chats, with typing indicators, read receipts and online status
- Replies, edits, delete for everyone, reactions and forwarding
- Images, video and voice notes, uploaded straight from the browser to Cloudinary
- **Search** every chat's messages from the sidebar; picking a result jumps to that message
- **Offline sending:** messages written offline wait in an outbox and go out once the server is reachable, never twice, in the same order on every device
- **Fast opening:** chats open from an IndexedDB cache, then refresh from the server (75% faster on 3G, see [Cache benchmark](docs/testing.md#cache-benchmark))
- **Several servers:** can run on many servers at once, joined through Redis (see [Load test](docs/testing.md#load-test))

### Calls and notifications

- Voice and video calls between browsers over WebRTC, with mute and camera toggles
- Missed and finished calls are logged in the chat
- Push notifications for new messages while the app is closed (on iPhone, after adding it to the home screen)

### Groups

- Create groups, rename them, change the icon, add and remove members
- Several admins per group; the last admin can't be removed

### AI magic reply

- Drafts your next message from the last few messages of the chat
- Pick a tone (Auto, Professional, Casual or Funny), then edit the draft before sending
- In an end-to-end encrypted chat it asks first, since the recent messages leave the browser as plain text

### Privacy and safety

- **End-to-end encryption** for one-on-one chats and groups (ECDH P-256 and AES-GCM in the Web Crypto API), with a lock in the chat header when it's on
- **Passphrase backup** of your key, so a new browser can read your history; the server never sees the passphrase
- **AES-256 encryption at rest** for everything else: chats where someone has no key yet, call logs and group notices
- **Profanity is masked** (`****`) before a message is sent, in the browser for encrypted chats
- **Private profiles** don't show up in user lists, and can't be messaged by new people or added to groups

### Interface

- Light, dark or system theme, with five accent colors
- Works on phones, with larger tap targets on touch screens
- Respects the "reduce motion" system setting

## Architecture

<p align="center">
  <img alt="ChatApp architecture" src="./docs/architecture.svg">
</p>

The diagram is written in [D2](https://d2lang.com) (`docs/architecture.d2`). To redraw it after a change:

```bash
d2 docs/architecture.d2 docs/architecture.svg
```

## How it works

| Topic | In one line |
| --- | --- |
| [Requests](docs/how-it-works.md#requests) | Vercel serves the app and forwards `/api/*` to Render |
| [Login](docs/how-it-works.md#login) | JWT in an `HttpOnly` cookie, plus a 5-minute token for the socket |
| [Real-time updates](docs/how-it-works.md#real-time-updates) | One socket room per user and per group |
| [Delivery](docs/how-it-works.md#delivery) | Outbox, client-made IDs and per-chat sequence numbers |
| [Several servers](docs/how-it-works.md#several-servers) | Redis joins the Socket.IO servers together |
| [End-to-end encryption](docs/how-it-works.md#end-to-end-encryption) | Keys made in the browser; the server only sees ciphertext |
| [Encryption at rest](docs/how-it-works.md#encryption-at-rest) | AES-256-CBC for text the server can read |
| [Search](docs/how-it-works.md#search) | Keyed hashes of words, so encrypted text can still be found |
| [Input checks](docs/how-it-works.md#input-checks) | zod schemas on every route and socket event |
| [Calls](docs/how-it-works.md#calls) | WebRTC between browsers, with STUN and TURN |
| [Notifications](docs/how-it-works.md#notifications) | Web Push with VAPID keys and a service worker |
| [Magic reply](docs/how-it-works.md#magic-reply) | Last 10 messages go to Groq for a draft |
| [Uploads](docs/how-it-works.md#uploads) | Browser uploads straight to Cloudinary |

The full write-up, with the delivery, scaling and encryption details, is in [docs/how-it-works.md](docs/how-it-works.md).

## Tech stack

| Area | Tools |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8, Mantine 9, React Router 7, Zustand 5, Motion, Phosphor Icons, Socket.io client, `idb` |
| Backend | Node.js 22, TypeScript (run by Node directly), Express 5, Socket.io 4, Mongoose 9, zod 4, JWT, bcrypt, helmet, `express-rate-limit`, `leo-profanity` |
| Services | MongoDB Atlas, Cloudinary, Groq, Google STUN, Cloudflare TURN |
| Hosting | Vercel (frontend and `/api` proxy), Render (API and sockets), GitHub Actions (keep-alive ping) |
| Tooling | Docker Compose, nginx, Redis, k6, pnpm, Vitest, supertest, mongodb-memory-server, ESLint 10 (flat config, typescript-eslint), GitHub Actions CI, D2 |

## Project structure

<details>
<summary>Show the folder tree</summary>

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

</details>

## Running locally

### With Docker

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

### Without Docker

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

### Scripts

<details>
<summary>Show every script</summary>

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

</details>

## Testing

```bash
cd backend && pnpm test
cd frontend && pnpm test
cd frontend && pnpm exec playwright install chromium && pnpm run test:e2e
```

| Suite | Size | Runs on |
| --- | --- | --- |
| Backend | 184 tests, about 86% line coverage | Vitest, `supertest`, `mongodb-memory-server`, real `socket.io-client` sockets |
| Frontend | 65 tests | Vitest, Testing Library on jsdom, `fake-indexeddb`, real Web Crypto |
| End to end | One full two-browser run | Playwright, the real backend on an in-memory MongoDB, and the Vite app |

GitHub Actions runs all three suites, ESLint and the production build on every push to `main` and on pull requests (`.github/workflows/ci.yml`).

What each suite checks is listed in [docs/testing.md](docs/testing.md).

### Benchmarks

**Opening a chat, with and without the IndexedDB cache** (median of 10 runs, 50 messages):

| Network | No cache | With cache | Faster by |
| --- | --- | --- | --- |
| No throttling | 198 ms | 166 ms | 16% |
| Fast 4G | 240 ms | 174 ms | 28% |
| Slow 4G | 289 ms | 111 ms | 62% |
| 3G | 407 ms | 104 ms | 75% |

**Message delivery latency under load** (k6, 60-second runs, all on one laptop):

| Setup | Load | Delivered | Missing | p50 | p95 | p99 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 server | 100 pairs, 50 msg/s | 2,900 | 0 | 61 ms | 178 ms | 320 ms |
| 3 servers + Redis | 100 pairs, 50 msg/s | 2,898 | 2 | 56 ms | 213 ms | 376 ms |
| 1 server | 250 pairs, 125 msg/s | 7,249 | 1 | 17 ms | 398 ms | 747 ms |
| 3 servers + Redis | 250 pairs, 125 msg/s | 7,231 | 2 | 8 ms | 766 ms | 1,572 ms |

How these were measured, and how to read them, is in [docs/testing.md](docs/testing.md#cache-benchmark).

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

## API reference

The full reference is a live page: **[chatapp-e2e.vercel.app/docs](https://chatapp-e2e.vercel.app/docs/)**

- 39 routes in 9 groups: auth, users, messages, keys, groups, calls, push, uploads and health.
- All routes start with `/api`. Every route except signup, login, logout and the push public key needs the login cookie.
- Errors come back as `{ "error": "message" }`; validation errors also include an `issues` array.
- The page reads [`frontend/public/openapi.json`](frontend/public/openapi.json), which is built from the same zod schemas the server checks input with. After changing a route, run `pnpm run openapi` in `backend/`.
- Locally the page is at http://localhost:3000/docs.

## Deployment

Everything deploys from `main`.

| Part | Where | How |
| --- | --- | --- |
| Frontend | Vercel | Root directory `frontend`. `vercel.json` forwards `/api/*` to Render |
| Backend | Render | Root directory `backend`, Node 22.18 or later, started with `pnpm start` |
| Backend deploys | GitHub Actions | `ci.yml` calls the Render deploy hook after the tests pass on `main` |
| Keep-alive | GitHub Actions | `keep-alive.yml` pings `/healthz` every 10 minutes |

Settings, variables and caveats are in [docs/deployment.md](docs/deployment.md).

## License

MIT. See [LICENSE](./LICENSE).
