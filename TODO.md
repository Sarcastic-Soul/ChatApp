# TODO

Planned upgrades, easiest first. Everything here runs on the current hosting
(Vercel, Render free tier, MongoDB Atlas, GitHub Actions) unless it says
otherwise.

## Next up

- [ ] **Tests and CI**
  - [x] Backend API tests with Vitest, supertest and mongodb-memory-server:
        auth, messages, groups, users, validation, rate limiting, encryption
  - [x] Socket tests: token auth, rooms, typing relay, bad payloads
  - [x] Frontend tests for the Zustand store, the IndexedDB cache and the
        time formatters
  - [x] GitHub Actions workflow running lint, tests and build on every push
  - [ ] Switch Render auto-deploy to "After CI checks pass"
  - [ ] Component tests for the login, sign-up and chat screens
        (Testing Library, needs a jsdom setup for Mantine)
  - [ ] One end-to-end Playwright run: log in, send a message, see it arrive
        in a second browser
- [ ] **Docker setup for local work**
  - [ ] Dockerfile for the backend
  - [ ] docker-compose with backend, frontend and MongoDB, so the app runs
        with one command
- [ ] **Measure the IndexedDB cache speed-up**
  - [ ] Time "open chat until messages show" with and without the cache
        (Playwright or Lighthouse), on a throttled network
  - [ ] Put the before and after numbers in the README

## Later

- [ ] **TURN server for calls** (needs a free account: Cloudflare or Metered)
  - [ ] Fetch short-lived TURN credentials from the backend
  - [ ] Add them to the `RTCPeerConnection` ICE servers next to Google STUN
  - Fixes calls that connect with no audio or video on mobile data and
    office networks
- [ ] **Web Push notifications**
  - [ ] Generate VAPID keys, store push subscriptions per user
  - [ ] Service worker that shows a notification for new messages while the
        tab is closed
  - On iPhone this only works when the app is added to the home screen
- [ ] **Message search**
  - Messages are encrypted in the database, so a MongoDB text index can't
    search them. Options: search the IndexedDB cache in the browser, or keep
    a separate keyword index
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
