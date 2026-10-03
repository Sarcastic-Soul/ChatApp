# Testing and benchmarks

[Back to the README](../README.md)

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

## Backend tests

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

## Frontend tests

| Area | What's checked |
| --- | --- |
| Login and sign-up pages | Form submit, server errors, client checks, the saved session check |
| Zustand conversation store | Ordering by sequence number, swapping an optimistic message for the saved one |
| IndexedDB | The message cache and the outbox |
| Outbox sending | Order, offline, retry after a server error, rejected messages, the first message of a new chat |
| Formatters | The time formatters |
| Encryption | Backup with right and wrong passphrases, key copies only their owner can open, the key saved in IndexedDB, sealing a first message for every member, undecryptable messages, the retry after a `409` |

## End-to-end test

The Playwright run goes through these steps:

1. Two browsers sign up, start a chat and swap messages live over the socket.
2. The test checks that the send request carries only ciphertext.
3. One person goes offline, sends a message and comes back. The other sees it exactly once.
4. The second person logs in on a fresh browser, gets a wrong passphrase refused, unlocks with the right one and reads the history.

## Cache benchmark

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
- Raw numbers and p90s are in [`docs/benchmarks/cache.json`](benchmarks/cache.json).

## Load test

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
- Raw numbers, including p90 and the max, are in [`docs/benchmarks/`](benchmarks/).
