# TODO

Planned upgrades, easiest first. Everything here runs on the current hosting
(Vercel, Render free tier, MongoDB Atlas, GitHub Actions) unless it says
otherwise.

## Next up

- [x] **Tests and CI**
  - [x] Backend API tests with Vitest, supertest and mongodb-memory-server:
        auth, messages, groups, users, validation, rate limiting, encryption
  - [x] Socket tests: token auth, rooms, typing relay, bad payloads
  - [x] Frontend tests for the Zustand store, the IndexedDB cache and the
        time formatters
  - [x] GitHub Actions workflow running lint, tests and build on every push
  - [x] Deploy the backend from CI through the Render deploy hook, only
        after the backend and end-to-end tests pass
  - [x] Component tests for the login and sign-up pages (Testing Library)
  - [x] End-to-end Playwright run: two browsers sign up and chat live
- [x] **Docker setup for local work**
  - [x] Dockerfile for the backend
  - [x] docker-compose with backend, frontend and MongoDB, so the app runs
        with one command
- [x] **Measure the IndexedDB cache speed-up**
  - [x] Time "open chat until messages show" with and without the cache
        (Playwright or Lighthouse), on a throttled network
  - [x] Put the before and after numbers in the README

## Later

- [ ] **TURN server for calls** (needs a free account: Cloudflare or Metered)
  - [x] Fetch short-lived TURN credentials from the backend
  - [x] Add them to the `RTCPeerConnection` ICE servers next to Google STUN
  - [ ] Create the TURN key and set its variables on Render
  - Fixes calls that connect with no audio or video on mobile data and
    office networks
- [ ] **Web Push notifications**
  - [x] Generate VAPID keys, store push subscriptions per user
  - [x] Service worker that shows a notification for new messages while the
        tab is closed
  - [ ] Set the VAPID variables on Render
  - On iPhone this only works when the app is added to the home screen
- [ ] **Message search**
  - [x] Blind index: keyed hashes of each word and word start, saved next to
        the encrypted text and kept in sync on edit and delete
  - [x] `GET /api/messages/search`, sidebar results and jump to the message
  - [ ] Run `pnpm run backfill:search` against production so older messages
        can be found
- [ ] **TypeScript**
  - [ ] Move the backend first (zod schemas can supply the request types),
        then the frontend
- [ ] **Reliable message delivery**
  - [ ] Client-made message IDs, so a retried send never creates a duplicate
  - [ ] Per-chat sequence numbers from the server, so every device shows the
        same order
  - [ ] Outbox in IndexedDB that retries unsent messages after reconnecting
  - [ ] On reconnect, send "last sequence number I have" and get only what's
        missing
  - [ ] Drive sent and read states from acks tied to message IDs
- [ ] **Scale Socket.IO across several servers** (needs Redis: Render Key
      Value free tier or Upstash)
  - [ ] `@socket.io/redis-adapter`, with online status and typing state in
        Redis
  - [ ] 2 to 3 instances behind Nginx with sticky sessions, run locally in
        docker-compose (the Render free tier allows one instance)
  - [ ] Load test with k6, recording p50 and p95 delivery latency and error
        rate in the repo
- [ ] **End-to-end encryption**
  - [ ] Key pair per browser with the Web Crypto API; only public keys go to
        the server
  - [ ] ECDH shared key plus AES-GCM for one-on-one chats
  - [ ] Random group key, encrypted for each member, rotated when someone
        leaves
  - [ ] Private keys in IndexedDB, plus a passphrase-protected backup for new
        devices
  - The server could no longer read messages, so magic reply and the
    profanity filter would have to move to the browser or become opt-in per
    chat. Search gets harder too

## Not planned

- Group video calls on a mediasoup SFU. They need a VPS with a public IP and
  open UDP ports, which the current hosting can't provide.

## Done

- [x] React 19, Vite 8, Mantine 9, React Router 7, Zustand 5 upgrade and UI
      redesign
- [x] Node 22 (built-in `--env-file`), Express 5, Mongoose 9
- [x] Socket auth with short-lived tokens; group events reach every member
- [x] Gemini replaced with Groq (`openai/gpt-oss-120b`)
- [x] Server refuses to start without `ENCRYPTION_KEY`
- [x] zod validation for every route and socket event
- [x] Keep-alive GitHub Actions cron for the Render backend
- [x] README rewrite, D2 architecture diagram, MIT license
- [x] Render builds with pnpm and auto-deploys on push
