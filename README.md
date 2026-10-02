# ChatApp

A full-stack real-time chat app with group chats, voice notes, and peer-to-peer voice and video calls. Messages are end-to-end encrypted in the browser, so the server stores text it can't read, and an AI assistant can draft your next reply in the tone you pick.

[![Live demo](https://img.shields.io/badge/Live_demo-socket--chat-111?style=flat-square&logo=vercel)](https://socket-chat-nine-tau.vercel.app/)
[![Video tour](https://img.shields.io/badge/Video_tour-YouTube-c4302b?style=flat-square&logo=youtube)](https://youtu.be/9GX83N07K70)
[![CI](https://img.shields.io/github/actions/workflow/status/Sarcastic-Soul/ChatApp/ci.yml?style=flat-square&label=tests)](https://github.com/Sarcastic-Soul/ChatApp/actions/workflows/ci.yml)
[![Keep backend awake](https://img.shields.io/github/actions/workflow/status/Sarcastic-Soul/ChatApp/keep-alive.yml?style=flat-square&label=backend%20ping)](https://github.com/Sarcastic-Soul/ChatApp/actions/workflows/keep-alive.yml)
![React 19](https://img.shields.io/badge/React-19-222?style=flat-square&logo=react)
![Node 22](https://img.shields.io/badge/Node-22-222?style=flat-square&logo=nodedotjs)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose_9-222?style=flat-square&logo=mongodb)
![Socket.io](https://img.shields.io/badge/Socket.io-4-222?style=flat-square&logo=socketdotio)

![ChatApp group chat](./screenshots/chat_ss.png)

## Try it

Open the [live app](https://socket-chat-nine-tau.vercel.app/) and press **Try the demo account**, or log in by hand:

| Username | Password |
| --- | --- |
| `alice` | `password123` |

The demo account is shared, so its encryption passphrase is public too (`alice demo passphrase`) and is filled in for you. The seeded people it chats with have never logged in and have no keys, so those chats are encrypted on the server only. Sign up two accounts of your own to see end-to-end encryption.

The backend runs on Render's free tier. A GitHub Actions job pings it every 10 minutes to keep it awake, but if it has been asleep, the first request can take up to a minute.

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

**Messaging**
- One-on-one and group chats, with typing indicators, read receipts and online status
- Replies, edits, delete for everyone, reactions and forwarding
- Images, video and voice notes, uploaded straight from the browser to Cloudinary
- Search every chat's messages from the sidebar; picking a result jumps to that message. End-to-end encrypted messages are searched on the device, the rest on the server
- Messages written offline or while the server is waking up wait in an outbox and go out once it's reachable, never twice, in the same order on every device
- Chats open from an IndexedDB cache, then refresh from the server (75% faster on a 3G connection, see [Cache benchmark](#cache-benchmark))
- Can run on several servers at once, joined through Redis, so a message reaches the other person whichever server each is on (see [Load test](#load-test))

**Calls**
- Voice and video calls between browsers over WebRTC, with mute and camera toggles
- Missed and finished calls are logged in the chat
- Push notifications for new messages while the app is closed (on iPhone, after adding it to the home screen)

**Groups**
- Create groups, rename them, change the icon, add and remove members
- Several admins per group; the last admin can't be removed

**AI magic reply**
- Drafts your next message from the last few messages of the chat
- Pick a tone (Auto, Professional, Casual or Funny), then edit the draft before sending
- In an end-to-end encrypted chat it asks first, since the recent messages leave the browser as plain text

**Privacy and safety**
- End-to-end encryption for one-on-one chats and groups (ECDH P-256 and AES-GCM in the Web Crypto API), with a lock in the chat header when it's on
- A passphrase backup of your key, so a new browser can read your history; the server never sees the passphrase
- AES-256 encryption at rest for everything else: chats where someone has no key yet, call logs and group notices
- Profanity is masked (`****`) before a message is sent, in the browser for encrypted chats
- Private profiles don't show up in user lists, and can't be messaged by new people or added to groups

**Interface**
- Light, dark or system theme, with five accent colors
- Works on phones, with larger tap targets on touch screens
- Respects the "reduce motion" system setting

## Architecture

![ChatApp architecture](./docs/architecture.svg)

The diagram is written in [D2](https://d2lang.com) (`docs/architecture.d2`). To redraw it after a change:

```bash
d2 docs/architecture.d2 docs/architecture.svg
```

## How it works

**Requests.** The React app is a static build on Vercel. Vercel forwards every `/api/*` request to the Express server on Render, so the browser only ever talks to one domain and the login cookie works without third-party cookie rules.

**Login.** Logging in sets a JWT in an `HttpOnly` cookie. Every protected route checks it in `protectRoute`. The socket server lives on Render's own domain and can't read that cookie, so the app first asks `GET /api/auth/socket-token` for a token that lasts 5 minutes and is only valid for opening a socket.

**Real-time updates.** Each socket joins a room named after its user ID, plus one room per group the user is in. When a message is sent, edited, deleted or reacted to, the API saves it and then sends the change to the right rooms. A user with several tabs open gets updates in all of them.

**Delivery.** The browser gives every message a UUID (`clientId`) and saves it to an outbox in IndexedDB before sending, so it shows in the chat at once with a clock icon. If the request fails because the network or server is down, the message stays in the outbox and is sent again when the socket reconnects, the browser comes back online, or a retry timer fires (2 s, 5 s, 15 s, up to a minute). A unique index on sender and `clientId` means a retry of a send that already went through gets the saved copy back instead of making a second one. Each chat keeps a counter (`lastSeq`), and the server gives every message the next number with one atomic `$inc`, so all devices sort a chat the same way even when two people send at once. After a reconnect the open chat asks for `?after=<newest number it has>` and gets only what it missed. Read receipts carry the number read up to, and the sender's messages show as read only up to that number. Chats from before sequence numbers existed are numbered in send order the first time they're opened.

**Several servers.** Socket.IO keeps its rooms in each server's memory, so with two servers a message saved on one would never reach a user whose socket is on the other. When `REDIS_URL` is set, the backend uses `@socket.io/redis-adapter`: every broadcast goes through Redis pub/sub, and each server delivers it to its own sockets. Online status moves to Redis too: each server keeps a hash of its users and their open-socket counts, and refreshes a 30-second "alive" key every 10 seconds, so if a server crashes its users drop off the online list instead of staying online forever. The message rate limit counts in Redis (`rate-limit-redis`), so it holds across servers. Without `REDIS_URL` all of this stays in memory, which is what the single free Render instance uses. `docker-compose.scale.yml` runs three backends behind nginx locally: browsers start Socket.IO on long-polling, and every polling request must reach the server that holds the session, so those stick to one server by client IP. A client that opens a WebSocket straight away needs only one connection, so it can land on any server. API requests go round robin. See [Load test](#load-test) for numbers.

**End-to-end encryption.** Each user has a P-256 ECDH key pair made in the browser with the Web Crypto API. The public key goes to the server (`PUT /api/keys/me`). The private key is stored in IndexedDB as a non-extractable `CryptoKey`, so page scripts can use it but can't read it out. A copy of it, encrypted with AES-GCM under a key made from the user's passphrase (PBKDF2-SHA256, 600,000 rounds), is stored on the server so a new browser can restore it. The server never gets the passphrase. Each chat has a random AES-GCM-256 key. It's sealed once per member: a one-time ECDH key pair and the member's public key give a shared secret, HKDF-SHA256 turns that into an AES key, and that wraps the chat key. Once every member of a chat has a key, the server refuses plain text there (`409` with `code: "keys_changed"`), so every new message is ciphertext. A chat key is only used while its copies match the current members and their key versions exactly. When someone joins, leaves or resets their key, the next sender makes a new key (the next "epoch") and sends it along with the message. The server checks that it covers every member, and a unique index on chat and epoch means only one of two people racing to make it wins; the other gets a `409`, seals the message again with the winner's key and sends once more. New members can't read messages from before they joined. The browser decrypts messages wherever they come in (history, the socket, catch-up, the outbox) and keeps the readable copies in its IndexedDB cache until logout, which also deletes the private key.

**What end-to-end encryption doesn't cover.** Images, videos and voice notes sit on Cloudinary unencrypted. Reactions, who talks to whom and when, and edit and read states are visible to the server. There are no safety numbers yet, so a server that handed out a fake public key could read new messages; people have to trust the server's key list. A weak passphrase can be guessed offline by someone with the database, since PBKDF2 only slows that down. Push notifications say "New message" instead of the text. Magic reply sends recent messages to Groq as plain text after asking. Search only finds encrypted messages already in this browser's cache.

**Encryption at rest.** Text the server can read (chats where someone has no key yet, call logs, group notices) is encrypted with AES-256-CBC (Node `crypto`) and a random IV before it is saved, and decrypted only when a member of the chat asks for it. The server won't start without `ENCRYPTION_KEY`.

**Search.** Text encrypted at rest can't go in a MongoDB text index, so each message also gets a blind index: a list of keyed hashes (HMAC-SHA256, with a key derived from `ENCRYPTION_KEY`) of its words and word starts, from 3 to 12 letters (two-letter words are stored whole). "meeting" is stored as the hashes of "mee", "meet", ... "meeting", so typing "meet" finds it. A search hashes the query words the same way, finds messages with every hash in chats the user belongs to, then decrypts the hits and checks them again. Someone with only the database sees hashes, not words, but can tell when two messages share a word; that is the trade-off for searching on the server. Edits update the hashes and deletes clear them. `pnpm run backfill:search` adds hashes to messages saved before search existed. End-to-end encrypted messages get no hashes; the browser searches its own cache for them and merges the results.

**Input checks.** Every route that takes input runs its params, query and body through a [zod](https://zod.dev) schema (`backend/validation/schemas.ts`). Bad input gets a `400` with a readable message, and unknown fields are dropped before they reach the controller. The controllers take their request types from the same schemas (`ValidatedRequest<typeof sendMessageSchema>`), so a field the schema doesn't define is a type error. Socket event payloads are checked too, and malformed ones are ignored.

**Calls.** The two browsers swap WebRTC offers, answers and ICE candidates through the socket server, then send audio and video straight to each other. Google's STUN servers help each browser find its public address. When both people sit behind strict NATs, such as mobile data or office Wi-Fi, a direct path often can't be found, so the backend also hands out short-lived TURN relay credentials from Cloudflare or Metered (`GET /api/calls/ice-servers`). The provider key stays on the server, and the browser only sees credentials that expire within a day.

**Notifications.** When a message arrives for someone with no tab open, the backend sends a Web Push notification (`web-push`, VAPID keys) to every browser they turned notifications on in. The payload is encrypted for that browser, so the push service (Google, Mozilla or Apple) can't read the message preview. The service worker (`frontend/public/sw.js`) shows it, and clicking it opens that chat. Subscriptions the push service has dropped are deleted, and logging out turns notifications off for that browser.

**Magic reply.** The backend sends the last 10 messages (500 characters each, at most) to Groq's OpenAI-compatible chat API using `openai/gpt-oss-120b`. One draft uses a few hundred tokens, which keeps it far below the free tier's 8K tokens a minute. If Groq rate limits the request, the user is asked to try again in a minute.

**Uploads.** The backend signs a Cloudinary upload, and the browser uploads the file straight to Cloudinary. Files never pass through the API server.

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

The quickest way: one command starts MongoDB, the backend and the built frontend behind nginx. You need Docker with Compose.

```bash
git clone https://github.com/Sarcastic-Soul/ChatApp.git
cd ChatApp
docker compose up --build -d
docker compose exec backend node seed.ts   # demo users, password123
```

Open http://localhost:8080 and log in as `alice`. The compose file sets local-only secrets, so it runs with no setup. Uploads and magic reply need real keys: put `CLOUDINARY_*` and `GROQ_API_KEY` in a `.env` file next to `docker-compose.yml`. `docker compose down -v` stops everything and deletes the database.

nginx forwards `/api` to the backend the same way `vercel.json` does in production, and the browser opens the socket to `localhost:5000` directly.

To run three backends behind a load balancer, with Redis connecting them:

```bash
docker compose -f docker-compose.yml -f docker-compose.scale.yml up --build -d
```

Port 5000 is now nginx (`deploy/nginx-lb.conf`), which spreads requests over the three backends. Every response has an `X-Upstream` header saying which one answered.

### Without Docker

**You need:** Node.js 22, pnpm (`npm i -g pnpm`), and a MongoDB database (Atlas, or local with `docker run -d -p 27017:27017 mongo:8.2`).

```bash
git clone https://github.com/Sarcastic-Soul/ChatApp.git
cd ChatApp

cd backend && pnpm install
cd ../frontend && pnpm install
```

Create `backend/.env` (see [Environment variables](#environment-variables)), then load the demo data. **The seed script deletes all users, chats and messages first**, so only point it at a database you can wipe.

```bash
cd backend
pnpm run seed
```

Start both servers in two terminals:

```bash
# Terminal 1: API and sockets on http://localhost:5000
cd backend && pnpm run dev

# Terminal 2: app on http://localhost:3000
cd frontend && pnpm run dev
```

In development, Vite forwards `/api` to `VITE_API_URL` (default `http://localhost:5000`).

### Scripts

| Folder | Command | What it does |
| --- | --- | --- |
| `backend` | `pnpm run dev` | Start the server and restart on file changes (`node --watch`) |
| `backend` | `pnpm start` | Start the server |
| `backend` | `pnpm run seed` | Replace the database contents with demo data |
| `backend` | `pnpm run backfill:search` | Add search hashes to messages saved before search existed (uses `MONGO_DB_URI`) |
| `backend` | `pnpm run typecheck` | Check types with `tsc` (source strict, tests relaxed) |
| `backend` | `pnpm test` | Run the API and socket tests |
| `backend` | `pnpm run test:coverage` | Run the tests with a coverage report |
| `frontend` | `pnpm run dev` | Start the Vite dev server |
| `frontend` | `pnpm run build` | Build for production into `dist/` |
| `frontend` | `pnpm run typecheck` | Check types with `tsc` (strict) |
| `frontend` | `pnpm run lint` | Run ESLint |
| `frontend` | `pnpm test` | Run the component, store, cache and formatter tests |
| `frontend` | `pnpm run test:e2e` | Run the Playwright end-to-end tests (starts its own backend and in-memory MongoDB) |
| `frontend` | `pnpm run bench:cache` | Time opening a chat with and without the IndexedDB cache (writes `docs/benchmarks/cache.json`) |

## Testing

```bash
cd backend && pnpm test
cd frontend && pnpm test
cd frontend && pnpm exec playwright install chromium && pnpm run test:e2e
```

The backend tests need no setup and never touch a real database. They start an in-memory MongoDB with `mongodb-memory-server` (the binary, about 120 MB, downloads on the first run), give each test file its own database, and use fake secrets from `backend/vitest.config.ts`.

- **Backend (184 tests, about 86% line coverage):** every REST route through `supertest`, including login and cookies, validation errors, access checks (who can read, react, edit, delete, manage a group), encryption at rest, the profanity filter, the rate limit and magic reply with a mocked Groq response, TURN credentials from mocked Cloudflare and Metered responses, push notifications with a mocked `web-push` (who gets one, the payload, dropped subscriptions), message search (word starts, privacy across chats, edits and deletes, the backfill, and that hashes never reach the client), delivery (a retried or doubled send saved once, sequence numbers under concurrent sends, numbering older chats, catch-up with `after`), and end-to-end encryption (setting and resetting a key, plain text refused once a chat is ready, stale or partial chat keys refused, two people racing to make a key, ciphertext stored and returned untouched, each member seeing only their own key copy, rotation after a member leaves, no search hashes or push previews for ciphertext). Socket tests connect real `socket.io-client` sockets and check the handshake, message and typing delivery, call signaling, group rooms, online status, read receipts with the sequence number, and that bad payloads are dropped. Five more tests run only when `TEST_REDIS_URL` points at a Redis server (CI starts one): a message reaching a socket on a second server, online status across servers and tabs, a crashed server's users going offline, and the rate limit's keys in Redis.
- **Frontend (65 tests):** the login and sign-up pages with Testing Library on jsdom (form submit, server errors, client checks, the saved session check), the Zustand conversation store (ordering by sequence number, swapping an optimistic message for the saved one), the IndexedDB message cache and outbox (on `fake-indexeddb`), outbox sending (order, offline, retry after a server error, rejected messages, the first message of a new chat), the time formatters, and the encryption code with real Web Crypto (backup with right and wrong passphrases, key copies only their owner can open, the key saved in IndexedDB, sealing a first message for every member, undecryptable messages, the retry after a `409`).
- **End to end (Playwright):** starts the real backend on an in-memory MongoDB and the Vite app, then two browsers sign up, start a chat and swap messages live over the socket. The test checks that the send request carries only ciphertext. One goes offline, sends a message, comes back, and the other sees it exactly once. Then the second person logs in on a fresh browser, gets a wrong passphrase refused, unlocks with the right one and reads the history.

### Cache benchmark

Opening a chat first shows the messages saved in IndexedDB, then swaps in the server's copy. `pnpm run bench:cache` measures how much that helps: it builds the app for production, fills a chat with 50 messages, and times the click on the chat until its newest message is on screen. "No cache" deletes the IndexedDB database before each run; "with cache" keeps it. The network is slowed with Chrome DevTools' presets. Median of 10 runs each:

| Network | No cache | With cache | Faster by |
| --- | --- | --- | --- |
| No throttling | 198 ms | 166 ms | 16% |
| Fast 4G | 240 ms | 174 ms | 28% |
| Slow 4G | 289 ms | 111 ms | 62% |
| 3G | 407 ms | 104 ms | 75% |

These ran against a backend on the same machine, so the "no cache" column leaves out real server time; on the free Render instance each request adds more, and a sleeping instance adds seconds. The roughly 100 to 170 ms that's left with the cache is reading IndexedDB and rendering 50 messages. Raw numbers and p90s are in [`docs/benchmarks/cache.json`](docs/benchmarks/cache.json).

### Load test

`loadtest/chat.js` is a [k6](https://k6.io) script. It signs up pairs of users; in each pair one user sends a message every 2 seconds over the REST API and the other listens on a WebSocket, and the script times each message from the send until it arrives on the socket. A message not seen within 5 seconds of the last send counts as missing. Run it against a local backend only:

```bash
k6 run -e PAIRS=100 -e DURATION=60 -e SUMMARY=docs/benchmarks/k6-1-server-100.json loadtest/chat.js
```

Each run lasted 60 seconds. "3 servers" is `docker-compose.scale.yml`, where the listeners were spread evenly over the three backends (20 sockets each in a 60-pair check), so most messages crossed servers through Redis:

| Setup | Load | Delivered | Missing | p50 | p95 | p99 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 server | 100 pairs, 50 msg/s | 2,900 | 0 | 61 ms | 178 ms | 320 ms |
| 3 servers + Redis | 100 pairs, 50 msg/s | 2,898 | 2 | 56 ms | 213 ms | 376 ms |
| 1 server | 250 pairs, 125 msg/s | 7,249 | 1 | 17 ms | 398 ms | 747 ms |
| 3 servers + Redis | 250 pairs, 125 msg/s | 7,231 | 2 | 8 ms | 766 ms | 1,572 ms |

No send failed in any run. Everything (k6, nginx, Redis, MongoDB and the backends) ran in Docker on one 12-thread laptop, so three servers shared the same CPU as one and also paid for the extra Redis hop: they don't come out faster here, and the slower tail at 125 msg/s comes from that shared CPU. What the runs show is that messages still arrive, in under 100 ms for most of them, when the sender and the receiver are on different servers. Real gains from more servers need separate machines. Raw numbers, including p90 and the max, are in `docs/benchmarks/k6-*.json`.

GitHub Actions runs all three suites, ESLint and the production build on every push to `main` and on pull requests (`.github/workflows/ci.yml`).

## Environment variables

The backend reads `backend/.env` with Node's built-in `--env-file-if-exists`, so there is no `dotenv` package. Variables already set in the shell win over the file.

| Variable | Required | Description |
| --- | --- | --- |
| `MONGO_DB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret for signing login and socket tokens |
| `ENCRYPTION_KEY` | Yes | Secret for message encryption. The server won't start without it, and changing it makes old messages unreadable |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary account name |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API secret, used to sign uploads |
| `GROQ_API_KEY` | For magic reply | Key from [console.groq.com/keys](https://console.groq.com/keys) |
| `GROQ_MODEL` | No | Groq model ID. Defaults to `openai/gpt-oss-120b` |
| `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN` | No | Cloudflare Realtime TURN key. Lets calls connect through strict NATs (mobile data, office Wi-Fi) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | For push notifications | Make a pair with `npx web-push generate-vapid-keys`. Without them the notifications setting is hidden |
| `VAPID_SUBJECT` | With VAPID keys | Contact for the push services, e.g. `mailto:you@example.com` |
| `METERED_DOMAIN`, `METERED_API_KEY` | No | Metered TURN instead of Cloudflare, e.g. `yourapp.metered.live`. With neither set, calls use STUN only |
| `REDIS_URL` | No | Redis connection string, e.g. `redis://localhost:6379`. Needed only when running more than one backend; sockets, online status and the rate limit are shared through it |
| `PORT` | No | Defaults to `5000` |
| `NODE_ENV` | No | Set to `development` locally, so the login cookie works over plain HTTP |
| `CLIENT_ORIGINS` | No | Extra CORS origins, comma-separated. The Vercel URL and `localhost:3000` are allowed already |

The frontend has one optional variable, in `frontend/.env`:

| Variable | Description |
| --- | --- |
| `VITE_API_URL` | Backend URL. Used by the dev proxy, and by the socket client to reach the backend directly |

## API reference

All routes start with `/api`. Every route except signup, login and logout needs the login cookie. Errors come back as `{ "error": "message" }`; validation errors also include an `issues` array.

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/auth/signup` | Create an account and log in |
| `POST` | `/auth/login` | Log in |
| `POST` | `/auth/logout` | Log out |
| `GET` | `/auth/me` | Current user |
| `GET` | `/auth/socket-token` | Short-lived token for the socket connection |
| `GET` | `/users` | Public users other than you |
| `GET` | `/users/conversations` | Your chats and groups, newest first |
| `GET` | `/users/new` | Public users you don't have a chat with yet |
| `GET` | `/users/:username` | A user's profile |
| `PUT` | `/users/update-pic` | Change your profile picture |
| `PUT` | `/users/privacy` | Make your profile public or private |
| `GET` | `/messages/:id?before=&limit=` | Messages in a chat, newest first, 50 at a time |
| `GET` | `/messages/:id?after=&limit=` | Messages after a sequence number, oldest first (catch-up after a reconnect) |
| `GET` | `/messages/search?q=&limit=` | Search messages in your chats, newest first (20 by default, 50 at most) |
| `POST` | `/messages/send/:id` | Send a message to a chat, or to a user to start a chat. A repeat `clientId` returns the saved message. Encrypted messages carry `e2ee: { epoch, iv }`, plus `newKey` when they start a new chat key |
| `PUT` | `/messages/edit/:messageId` | Edit your message |
| `DELETE` | `/messages/delete/:messageId` | Delete your message for everyone |
| `POST` | `/messages/react/:messageId` | Add, change or remove a reaction |
| `POST` | `/messages/read/:id` | Mark a chat as read |
| `POST` | `/messages/magic-reply` | Draft a reply with AI |
| `GET` | `/keys/me` | Your public key, key version and passphrase backup |
| `PUT` | `/keys/me` | Save your public key and backup (`reset: true` replaces an existing key) |
| `GET` | `/keys/chats/:id` | A chat's members and their public keys, the newest chat key epoch, and your copies of each chat key. `:id` can be a user ID for a chat that doesn't exist yet |
| `POST` | `/groups/create` | Create a group |
| `GET` | `/groups/:groupId` | Group details |
| `PUT` | `/groups/:groupId/update` | Change the group name or icon (admins) |
| `PUT` | `/groups/:groupId/name` | Rename the group (admins) |
| `PUT` | `/groups/:groupId/participants/add` | Add a member (admins) |
| `PUT` | `/groups/:groupId/participants/remove` | Remove a member (admins), or leave the group |
| `PUT` | `/groups/:groupId/admins/add` | Make a member an admin (admins) |
| `PUT` | `/groups/:groupId/admins/remove` | Remove an admin (admins) |
| `DELETE` | `/groups/:groupId/delete` | Delete the group (admins) |
| `GET` | `/calls/ice-servers` | STUN and TURN servers for a call |
| `GET` | `/push/public-key` | VAPID public key (no login needed; `404` when push isn't set up) |
| `POST` | `/push/subscribe` | Save this browser's push subscription |
| `POST` | `/push/unsubscribe` | Remove this browser's push subscription |
| `GET` | `/cloudinary/signature` | Signed upload for chat media (also `/profile-pic` and `/group-icon`) |

`GET /healthz` (outside `/api`) returns `{ "status": "ok" }` and is what the keep-alive job pings.

## Deployment

Everything deploys from `main`.

- **Frontend (Vercel):** root directory `frontend`. `vercel.json` forwards `/api/*` to the Render backend and sends every other path to `index.html`. Set `VITE_API_URL` to the Render URL.
- **Backend (Render):** root directory `backend`, Node 22.18 or later (it runs the `.ts` files directly), build command `corepack enable && pnpm install --frozen-lockfile`, start command `pnpm start`, Render auto-deploy off. Set the required variables from the table above.
- **CI and backend deploys (GitHub Actions):** `.github/workflows/ci.yml` runs on every push. When the backend and end-to-end tests pass on `main` and the push changed something in `backend/`, it calls the Render deploy hook, stored in the `RENDER_DEPLOY_HOOK_URL` repository secret. Running the workflow by hand from the Actions tab always deploys.
- **Keep-alive (GitHub Actions):** `.github/workflows/keep-alive.yml` calls `/healthz` every 10 minutes so the free Render instance doesn't fall asleep. GitHub may start scheduled runs a few minutes late, and it turns scheduled workflows off after 60 days without commits; turn it back on from the Actions tab. It can also be run by hand from there.

## License

MIT. See [LICENSE](./LICENSE).
