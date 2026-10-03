<h1 align="center">ChatApp</h1>

<p align="center">
  A full-stack real-time chat app with group chats, voice notes, and peer-to-peer voice and video calls.<br>
  Messages are end-to-end encrypted in the browser, so the server stores text it can't read.
</p>

<p align="center">
  <a href="https://socket-chat-nine-tau.vercel.app/"><img alt="Live demo" src="https://img.shields.io/badge/Live_demo-socket--chat-111?style=flat-square&logo=vercel"></a>
  <a href="https://youtu.be/9GX83N07K70"><img alt="Video tour" src="https://img.shields.io/badge/Video_tour-YouTube-c4302b?style=flat-square&logo=youtube"></a>
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
  <a href="#api-reference">API</a> ·
  <a href="#deployment">Deployment</a>
</p>

<p align="center">
  <img alt="ChatApp group chat" src="./screenshots/chat_ss.png">
</p>

## Try it

Open the [live app](https://socket-chat-nine-tau.vercel.app/) and press **Try the demo account**, or log in by hand:

| Username | Password | Encryption passphrase |
| --- | --- | --- |
| `alice` | `password123` | `alice demo passphrase` (filled in for you) |

Good to know:

- **The demo account is shared**, so its passphrase is public.
- **Demo chats are not end-to-end encrypted.** The seeded people have never logged in and have no keys, so those chats are encrypted on the server only.
- **To see end-to-end encryption**, sign up two accounts of your own.
- **The first request can be slow.** The backend runs on Render's free tier. A GitHub Actions job pings it every 10 minutes, but if it has been asleep, the first request can take up to a minute.

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Running locally](#running-locally)
- [Testing](#testing)
- [Environment variables](#environment-variables)
- [API reference](#api-reference)
- [Deployment](#deployment)

## Features

### Messaging

- One-on-one and group chats, with typing indicators, read receipts and online status
- Replies, edits, delete for everyone, reactions and forwarding
- Images, video and voice notes, uploaded straight from the browser to Cloudinary
- **Search** every chat's messages from the sidebar; picking a result jumps to that message
- **Offline sending:** messages written offline wait in an outbox and go out once the server is reachable, never twice, in the same order on every device
- **Fast opening:** chats open from an IndexedDB cache, then refresh from the server (75% faster on 3G, see [Cache benchmark](#cache-benchmark))
- **Several servers:** can run on many servers at once, joined through Redis (see [Load test](#load-test))

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
| [Requests](#requests) | Vercel serves the app and forwards `/api/*` to Render |
| [Login](#login) | JWT in an `HttpOnly` cookie, plus a 5-minute token for the socket |
| [Real-time updates](#real-time-updates) | One socket room per user and per group |
| [Delivery](#delivery) | Outbox, client-made IDs and per-chat sequence numbers |
| [Several servers](#several-servers) | Redis joins the Socket.IO servers together |
| [End-to-end encryption](#end-to-end-encryption) | Keys made in the browser; the server only sees ciphertext |
| [Encryption at rest](#encryption-at-rest) | AES-256-CBC for text the server can read |
| [Search](#search) | Keyed hashes of words, so encrypted text can still be found |
| [Input checks](#input-checks) | zod schemas on every route and socket event |
| [Calls](#calls) | WebRTC between browsers, with STUN and TURN |
| [Notifications](#notifications) | Web Push with VAPID keys and a service worker |
| [Magic reply](#magic-reply) | Last 10 messages go to Groq for a draft |
| [Uploads](#uploads) | Browser uploads straight to Cloudinary |

### Requests

- The React app is a static build on Vercel.
- Vercel forwards every `/api/*` request to the Express server on Render.
- So the browser only ever talks to one domain, and the login cookie works without third-party cookie rules.

### Login

- Logging in sets a JWT in an `HttpOnly` cookie.
- Every protected route checks it in `protectRoute`.
- The socket server lives on Render's own domain and can't read that cookie.
- So the app first asks `GET /api/auth/socket-token` for a token that lasts 5 minutes and is only valid for opening a socket.

### Real-time updates

- Each socket joins a room named after its user ID, plus one room per group the user is in.
- When a message is sent, edited, deleted or reacted to, the API saves it and then sends the change to the right rooms.
- A user with several tabs open gets updates in all of them.

### Delivery

| Problem | How it's handled |
| --- | --- |
| A sent message should show at once | The browser gives it a UUID (`clientId`) and saves it to an outbox in IndexedDB before sending. It shows in the chat with a clock icon. |
| The network or server is down | The message stays in the outbox. It is sent again when the socket reconnects, the browser comes back online, or a retry timer fires (2 s, 5 s, 15 s, up to a minute). |
| A retry could create a duplicate | A unique index on sender and `clientId` means a retry of a send that already went through gets the saved copy back. |
| Two people send at the same time | Each chat keeps a counter (`lastSeq`). The server gives every message the next number with one atomic `$inc`, so all devices sort a chat the same way. |
| A device missed messages while offline | After a reconnect the open chat asks for `?after=<newest number it has>` and gets only what it missed. |
| Read state must be exact | Read receipts carry the number read up to. The sender's messages show as read only up to that number. |
| Chats older than sequence numbers | They are numbered in send order the first time they're opened. |

### Several servers

**The problem:** Socket.IO keeps its rooms in each server's memory. With two servers, a message saved on one would never reach a user whose socket is on the other.

**With `REDIS_URL` set:**

- **Broadcasts** go through Redis pub/sub (`@socket.io/redis-adapter`), and each server delivers them to its own sockets.
- **Online status** lives in Redis. Each server keeps a hash of its users and their open-socket counts, and refreshes a 30-second "alive" key every 10 seconds. If a server crashes, its users drop off the online list instead of staying online forever.
- **The message rate limit** counts in Redis (`rate-limit-redis`), so it holds across servers.

**Without `REDIS_URL`:** all of this stays in memory. That is what the single free Render instance uses.

**Local three-server setup** (`docker-compose.scale.yml`, three backends behind nginx):

| Request type | How nginx routes it | Why |
| --- | --- | --- |
| Socket.IO long-polling | Sticks to one server by client IP | Every polling request must reach the server that holds the session |
| WebSocket opened straight away | Any server | It needs only one connection |
| API requests | Round robin | They hold no state on the server |

See [Load test](#load-test) for numbers.

### End-to-end encryption

**User keys**

| What | Where it lives | Notes |
| --- | --- | --- |
| Public key (P-256 ECDH) | Server (`PUT /api/keys/me`) | Made in the browser with the Web Crypto API |
| Private key | IndexedDB, as a non-extractable `CryptoKey` | Page scripts can use it but can't read it out |
| Private key backup | Server | Encrypted with AES-GCM under a key made from the passphrase (PBKDF2-SHA256, 600,000 rounds), so a new browser can restore it |
| Passphrase | Only in the user's head | The server never gets it |

**Chat keys**

- Each chat has a random AES-GCM-256 key.
- It's sealed once per member: a one-time ECDH key pair and the member's public key give a shared secret, HKDF-SHA256 turns that into an AES key, and that wraps the chat key.
- Once every member of a chat has a key, the server refuses plain text there (`409` with `code: "keys_changed"`), so every new message is ciphertext.

**Key changes**

- A chat key is only used while its copies match the current members and their key versions exactly.
- When someone joins, leaves or resets their key, the next sender makes a new key (the next "epoch") and sends it along with the message.
- The server checks that the new key covers every member.
- A unique index on chat and epoch means only one of two people racing to make it wins. The other gets a `409`, seals the message again with the winner's key and sends once more.
- New members can't read messages from before they joined.

**In the browser**

- Messages are decrypted wherever they come in: history, the socket, catch-up and the outbox.
- The readable copies stay in the IndexedDB cache until logout, which also deletes the private key.

**What it doesn't cover**

| Gap | Detail |
| --- | --- |
| Media | Images, videos and voice notes sit on Cloudinary unencrypted |
| Metadata | Reactions, who talks to whom and when, and edit and read states are visible to the server |
| No safety numbers yet | A server that handed out a fake public key could read new messages; people have to trust the server's key list |
| Weak passphrases | Can be guessed offline by someone with the database, since PBKDF2 only slows that down |
| Push notifications | Say "New message" instead of the text |
| Magic reply | Sends recent messages to Groq as plain text, after asking |
| Search | Only finds encrypted messages already in this browser's cache |

### Encryption at rest

- **What:** text the server can read (chats where someone has no key yet, call logs, group notices).
- **How:** AES-256-CBC (Node `crypto`) with a random IV before it is saved.
- **When it's decrypted:** only when a member of the chat asks for it.
- The server won't start without `ENCRYPTION_KEY`.

### Search

Text encrypted at rest can't go in a MongoDB text index, so each message also gets a **blind index**.

- **What's stored:** keyed hashes (HMAC-SHA256, with a key derived from `ENCRYPTION_KEY`) of each word and its word starts, from 3 to 12 letters. Two-letter words are stored whole.
- **Example:** "meeting" is stored as the hashes of "mee", "meet", ... "meeting", so typing "meet" finds it.
- **A search** hashes the query words the same way, finds messages with every hash in chats the user belongs to, then decrypts the hits and checks them again.
- **The trade-off:** someone with only the database sees hashes, not words, but can tell when two messages share a word.
- **Edits and deletes:** edits update the hashes and deletes clear them.
- **Older messages:** `pnpm run backfill:search` adds hashes to messages saved before search existed.
- **End-to-end encrypted messages** get no hashes. The browser searches its own cache for them and merges the results.

### Input checks

- Every route that takes input runs its params, query and body through a [zod](https://zod.dev) schema (`backend/validation/schemas.ts`).
- Bad input gets a `400` with a readable message.
- Unknown fields are dropped before they reach the controller.
- The controllers take their request types from the same schemas (`ValidatedRequest<typeof sendMessageSchema>`), so a field the schema doesn't define is a type error.
- Socket event payloads are checked too, and malformed ones are ignored.

### Calls

- The two browsers swap WebRTC offers, answers and ICE candidates through the socket server, then send audio and video straight to each other.
- **STUN:** Google's STUN servers help each browser find its public address.
- **TURN:** when both people sit behind strict NATs (mobile data, office Wi-Fi), a direct path often can't be found. The backend hands out short-lived TURN relay credentials from Cloudflare or Metered (`GET /api/calls/ice-servers`).
- The provider key stays on the server. The browser only sees credentials that expire within a day.

### Notifications

- When a message arrives for someone with no tab open, the backend sends a Web Push notification (`web-push`, VAPID keys) to every browser they turned notifications on in.
- The payload is encrypted for that browser, so the push service (Google, Mozilla or Apple) can't read the message preview.
- The service worker (`frontend/public/sw.js`) shows it, and clicking it opens that chat.
- Subscriptions the push service has dropped are deleted.
- Logging out turns notifications off for that browser.

### Magic reply

- The backend sends the last 10 messages (500 characters each, at most) to Groq's OpenAI-compatible chat API using `openai/gpt-oss-120b`.
- One draft uses a few hundred tokens, far below the free tier's 8K tokens a minute.
- If Groq rate limits the request, the user is asked to try again in a minute.

### Uploads

- The backend signs a Cloudinary upload.
- The browser uploads the file straight to Cloudinary.
- Files never pass through the API server.

## Tech stack

| Area | Tools |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8, Mantine 9, React Router 7, Zustand 5, Motion, Phosphor Icons, Socket.io client, `idb` |
| Backend | Node.js 22, TypeScript (run by Node directly), Express 5, Socket.io 4, Mongoose 9, zod 4, JWT, bcrypt, helmet, `express-rate-limit`, `leo-profanity` |
| Services | MongoDB Atlas, Cloudinary, Groq, Google STUN, Cloudflare TURN |
| Hosting | Vercel (frontend and `/api` proxy), Render (API and sockets), GitHub Actions (keep-alive ping) |
| Tooling | Docker Compose, nginx, Redis, k6, pnpm, Vitest, supertest, mongodb-memory-server, ESLint 10 (flat config, typescript-eslint), GitHub Actions CI, D2 |

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
│   ├── scripts/          # e2e server on an in-memory MongoDB, search backfill
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
│   └── benchmarks/       # Cache and load test results
├── docker-compose.yml    # MongoDB, backend and frontend together
├── docker-compose.scale.yml  # Adds Redis, three backends and nginx in front
├── frontend/
│   ├── e2e/              # Playwright end-to-end tests
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

**Backend** (run in `backend/`)

| Command | What it does |
| --- | --- |
| `pnpm run dev` | Start the server and restart on file changes (`node --watch`) |
| `pnpm start` | Start the server |
| `pnpm run seed` | Replace the database contents with demo data |
| `pnpm run backfill:search` | Add search hashes to messages saved before search existed (uses `MONGO_DB_URI`) |
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

### Backend tests

The backend tests need no setup and never touch a real database.

- They start an in-memory MongoDB with `mongodb-memory-server` (the binary, about 120 MB, downloads on the first run).
- Each test file gets its own database.
- Secrets are fake ones from `backend/vitest.config.ts`.

Every REST route is tested through `supertest`:

| Area | What's checked |
| --- | --- |
| Auth | Login and cookies |
| Validation | Validation errors |
| Access | Who can read, react, edit, delete and manage a group |
| Safety | Encryption at rest, the profanity filter, the rate limit |
| Magic reply | A mocked Groq response |
| Calls | TURN credentials from mocked Cloudflare and Metered responses |
| Push | A mocked `web-push`: who gets a notification, the payload, dropped subscriptions |
| Search | Word starts, privacy across chats, edits and deletes, the backfill, and that hashes never reach the client |
| Delivery | A retried or doubled send saved once, sequence numbers under concurrent sends, numbering older chats, catch-up with `after` |
| End-to-end encryption | Setting and resetting a key, plain text refused once a chat is ready, stale or partial chat keys refused, two people racing to make a key, ciphertext stored and returned untouched, each member seeing only their own key copy, rotation after a member leaves, no search hashes or push previews for ciphertext |
| Sockets | The handshake, message and typing delivery, call signaling, group rooms, online status, read receipts with the sequence number, and that bad payloads are dropped |
| Redis (5 tests) | Run only when `TEST_REDIS_URL` points at a Redis server (CI starts one): a message reaching a socket on a second server, online status across servers and tabs, a crashed server's users going offline, and the rate limit's keys in Redis |

### Frontend tests

| Area | What's checked |
| --- | --- |
| Login and sign-up pages | Form submit, server errors, client checks, the saved session check |
| Zustand conversation store | Ordering by sequence number, swapping an optimistic message for the saved one |
| IndexedDB | The message cache and the outbox |
| Outbox sending | Order, offline, retry after a server error, rejected messages, the first message of a new chat |
| Formatters | The time formatters |
| Encryption | Backup with right and wrong passphrases, key copies only their owner can open, the key saved in IndexedDB, sealing a first message for every member, undecryptable messages, the retry after a `409` |

### End-to-end test

The Playwright run goes through these steps:

1. Two browsers sign up, start a chat and swap messages live over the socket.
2. The test checks that the send request carries only ciphertext.
3. One person goes offline, sends a message and comes back. The other sees it exactly once.
4. The second person logs in on a fresh browser, gets a wrong passphrase refused, unlocks with the right one and reads the history.

### Cache benchmark

Opening a chat first shows the messages saved in IndexedDB, then swaps in the server's copy. `pnpm run bench:cache` measures how much that helps.

**How it's measured**

- Builds the app for production and fills a chat with 50 messages.
- Times the click on the chat until its newest message is on screen.
- "No cache" deletes the IndexedDB database before each run; "with cache" keeps it.
- The network is slowed with Chrome DevTools' presets.
- Each number is the median of 10 runs.

| Network | No cache | With cache | Faster by |
| --- | --- | --- | --- |
| No throttling | 198 ms | 166 ms | 16% |
| Fast 4G | 240 ms | 174 ms | 28% |
| Slow 4G | 289 ms | 111 ms | 62% |
| 3G | 407 ms | 104 ms | 75% |

**Reading the numbers**

- These ran against a backend on the same machine, so the "no cache" column leaves out real server time. On the free Render instance each request adds more, and a sleeping instance adds seconds.
- The roughly 100 to 170 ms that's left with the cache is reading IndexedDB and rendering 50 messages.
- Raw numbers and p90s are in [`docs/benchmarks/cache.json`](docs/benchmarks/cache.json).

### Load test

`loadtest/chat.js` is a [k6](https://k6.io) script.

**How it's measured**

- It signs up pairs of users.
- In each pair, one user sends a message every 2 seconds over the REST API and the other listens on a WebSocket.
- The script times each message from the send until it arrives on the socket.
- A message not seen within 5 seconds of the last send counts as missing.
- Each run lasted 60 seconds.

Run it against a local backend only:

```bash
k6 run -e PAIRS=100 -e DURATION=60 -e SUMMARY=docs/benchmarks/k6-1-server-100.json loadtest/chat.js
```

| Setup | Load | Delivered | Missing | p50 | p95 | p99 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 server | 100 pairs, 50 msg/s | 2,900 | 0 | 61 ms | 178 ms | 320 ms |
| 3 servers + Redis | 100 pairs, 50 msg/s | 2,898 | 2 | 56 ms | 213 ms | 376 ms |
| 1 server | 250 pairs, 125 msg/s | 7,249 | 1 | 17 ms | 398 ms | 747 ms |
| 3 servers + Redis | 250 pairs, 125 msg/s | 7,231 | 2 | 8 ms | 766 ms | 1,572 ms |

**Reading the numbers**

- No send failed in any run.
- "3 servers" is `docker-compose.scale.yml`. The listeners were spread evenly over the three backends (20 sockets each in a 60-pair check), so most messages crossed servers through Redis.
- Everything (k6, nginx, Redis, MongoDB and the backends) ran in Docker on one 12-thread laptop. Three servers shared the same CPU as one and also paid for the extra Redis hop, so they don't come out faster here. The slower tail at 125 msg/s comes from that shared CPU.
- What the runs show: messages still arrive, in under 100 ms for most of them, when the sender and the receiver are on different servers.
- Real gains from more servers need separate machines.
- Raw numbers, including p90 and the max, are in `docs/benchmarks/k6-*.json`.

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

- All routes start with `/api`.
- Every route except signup, login and logout needs the login cookie.
- Errors come back as `{ "error": "message" }`; validation errors also include an `issues` array.

### Auth

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/auth/signup` | Create an account and log in |
| `POST` | `/auth/login` | Log in |
| `POST` | `/auth/logout` | Log out |
| `GET` | `/auth/me` | Current user |
| `GET` | `/auth/socket-token` | Short-lived token for the socket connection |

### Users

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/users` | Public users other than you |
| `GET` | `/users/conversations` | Your chats and groups, newest first |
| `GET` | `/users/new` | Public users you don't have a chat with yet |
| `GET` | `/users/:username` | A user's profile |
| `PUT` | `/users/update-pic` | Change your profile picture |
| `PUT` | `/users/privacy` | Make your profile public or private |

### Messages

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/messages/:id?before=&limit=` | Messages in a chat, newest first, 50 at a time |
| `GET` | `/messages/:id?after=&limit=` | Messages after a sequence number, oldest first (catch-up after a reconnect) |
| `GET` | `/messages/search?q=&limit=` | Search messages in your chats, newest first (20 by default, 50 at most) |
| `POST` | `/messages/send/:id` | Send a message to a chat, or to a user to start a chat. A repeat `clientId` returns the saved message. Encrypted messages carry `e2ee: { epoch, iv }`, plus `newKey` when they start a new chat key |
| `PUT` | `/messages/edit/:messageId` | Edit your message |
| `DELETE` | `/messages/delete/:messageId` | Delete your message for everyone |
| `POST` | `/messages/react/:messageId` | Add, change or remove a reaction |
| `POST` | `/messages/read/:id` | Mark a chat as read |
| `POST` | `/messages/magic-reply` | Draft a reply with AI |

### Keys

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/keys/me` | Your public key, key version and passphrase backup |
| `PUT` | `/keys/me` | Save your public key and backup (`reset: true` replaces an existing key) |
| `GET` | `/keys/chats/:id` | A chat's members and their public keys, the newest chat key epoch, and your copies of each chat key. `:id` can be a user ID for a chat that doesn't exist yet |

### Groups

Routes marked "admins" can only be called by a group admin.

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/groups/create` | Create a group |
| `GET` | `/groups/:groupId` | Group details |
| `PUT` | `/groups/:groupId/update` | Change the group name or icon (admins) |
| `PUT` | `/groups/:groupId/name` | Rename the group (admins) |
| `PUT` | `/groups/:groupId/participants/add` | Add a member (admins) |
| `PUT` | `/groups/:groupId/participants/remove` | Remove a member (admins), or leave the group |
| `PUT` | `/groups/:groupId/admins/add` | Make a member an admin (admins) |
| `PUT` | `/groups/:groupId/admins/remove` | Remove an admin (admins) |
| `DELETE` | `/groups/:groupId/delete` | Delete the group (admins) |

### Calls, push and uploads

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/calls/ice-servers` | STUN and TURN servers for a call |
| `GET` | `/push/public-key` | VAPID public key (no login needed; `404` when push isn't set up) |
| `POST` | `/push/subscribe` | Save this browser's push subscription |
| `POST` | `/push/unsubscribe` | Remove this browser's push subscription |
| `GET` | `/cloudinary/signature` | Signed upload for chat media (also `/profile-pic` and `/group-icon`) |

### Health

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/healthz` (outside `/api`) | Returns `{ "status": "ok" }`. This is what the keep-alive job pings |

## Deployment

Everything deploys from `main`.

### Frontend (Vercel)

- **Root directory:** `frontend`
- **Routing:** `vercel.json` forwards `/api/*` to the Render backend and sends every other path to `index.html`
- **Variables:** set `VITE_API_URL` to the Render URL

### Backend (Render)

| Setting | Value |
| --- | --- |
| Root directory | `backend` |
| Node version | 22.18 or later (it runs the `.ts` files directly) |
| Build command | `corepack enable && pnpm install --frozen-lockfile` |
| Start command | `pnpm start` |
| Auto-deploy | Off |
| Variables | The required ones from [Environment variables](#environment-variables) |

### CI and backend deploys (GitHub Actions)

- `.github/workflows/ci.yml` runs on every push.
- It calls the Render deploy hook when both of these are true on `main`:
  - the backend and end-to-end tests pass
  - the push changed something in `backend/`
- The hook URL is stored in the `RENDER_DEPLOY_HOOK_URL` repository secret.
- Running the workflow by hand from the Actions tab always deploys.

### Keep-alive (GitHub Actions)

- `.github/workflows/keep-alive.yml` calls `/healthz` every 10 minutes so the free Render instance doesn't fall asleep.
- GitHub may start scheduled runs a few minutes late.
- GitHub turns scheduled workflows off after 60 days without commits; turn it back on from the Actions tab.
- It can also be run by hand from there.

## License

MIT. See [LICENSE](./LICENSE).
