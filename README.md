# ChatApp

A full-stack real-time chat app with group chats, voice notes, and peer-to-peer voice and video calls. Messages are encrypted with AES-256 before they are stored, and an AI assistant can draft your next reply in the tone you pick.

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
- Chats load instantly from an IndexedDB cache, then refresh from the server

**Calls**
- Voice and video calls between browsers over WebRTC, with mute and camera toggles
- Missed and finished calls are logged in the chat

**Groups**
- Create groups, rename them, change the icon, add and remove members
- Several admins per group; the last admin can't be removed

**AI magic reply**
- Drafts your next message from the last few messages of the chat
- Pick a tone (Auto, Professional, Casual or Funny), then edit the draft before sending

**Privacy and safety**
- AES-256 encryption for every message stored in the database
- Profanity is masked (`****`) before a message is saved
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

**Encryption.** Message text is encrypted with AES-256-CBC (Node `crypto`) and a random IV before it is saved, and decrypted only when a member of the chat asks for it. The server won't start without `ENCRYPTION_KEY`.

**Input checks.** Every route that takes input runs its params, query and body through a [zod](https://zod.dev) schema (`backend/validation/schemas.js`). Bad input gets a `400` with a readable message, and unknown fields are dropped before they reach the controller. Socket event payloads are checked too, and malformed ones are ignored.

**Calls.** The two browsers swap WebRTC offers, answers and ICE candidates through the socket server, then send audio and video straight to each other. Google's STUN servers help each browser find its public address.

**Magic reply.** The backend sends the last 10 messages (500 characters each, at most) to Groq's OpenAI-compatible chat API using `openai/gpt-oss-120b`. One draft uses a few hundred tokens, which keeps it far below the free tier's 8K tokens a minute. If Groq rate limits the request, the user is asked to try again in a minute.

**Uploads.** The backend signs a Cloudinary upload, and the browser uploads the file straight to Cloudinary. Files never pass through the API server.

## Tech stack

| Area | Tools |
| --- | --- |
| Frontend | React 19, Vite 8, Mantine 9, React Router 7, Zustand 5, Motion, Phosphor Icons, Socket.io client, `idb` |
| Backend | Node.js 22, Express 5, Socket.io 4, Mongoose 9, zod 4, JWT, bcrypt, helmet, `express-rate-limit`, `leo-profanity` |
| Services | MongoDB Atlas, Cloudinary, Groq, Google STUN |
| Hosting | Vercel (frontend and `/api` proxy), Render (API and sockets), GitHub Actions (keep-alive ping) |
| Tooling | pnpm, Vitest, supertest, mongodb-memory-server, ESLint 10 (flat config), GitHub Actions CI, D2 |

## Project structure

```text
ChatApp/
├── .github/workflows/
│   ├── ci.yml            # Lint, tests and build on every push
│   └── keep-alive.yml    # Pings the backend every 10 minutes
├── backend/
│   ├── config/           # Allowed CORS origins
│   ├── controllers/      # Route handlers (auth, messages, groups, users, uploads)
│   ├── db/               # MongoDB connection
│   ├── middleware/       # Auth check, rate limit, zod validation
│   ├── models/           # Mongoose schemas (User, Message, Conversation)
│   ├── routes/           # REST routes
│   ├── socket/           # Socket.io server, rooms and WebRTC signaling
│   ├── utils/            # Encryption, profanity filter, JWT and Cloudinary helpers
│   ├── validation/       # zod schemas for requests and socket events
│   ├── tests/            # Vitest API and socket tests
│   ├── app.js            # Express app with every route attached
│   ├── seed.js           # Demo data
│   └── server.js         # Entry point, starts the server
├── docs/
│   └── architecture.d2   # Architecture diagram source
└── frontend/
    ├── src/
    │   ├── components/   # Chat, sidebar, call and modal components
    │   ├── context/      # Auth, socket and call state
    │   ├── hooks/        # Data fetching and actions
    │   ├── pages/        # Landing, login, sign-up, chat, profile and group pages
    │   ├── utils/        # IndexedDB cache and formatters
    │   └── zustand/      # Global stores
    └── vercel.json       # /api proxy and SPA fallback
```

## Running locally

**You need:** Node.js 22, pnpm (`npm i -g pnpm`), and a MongoDB database (Atlas, or local with `docker run -d -p 27017:27017 mongo:7`).

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
| `backend` | `pnpm test` | Run the API and socket tests |
| `backend` | `pnpm run test:coverage` | Run the tests with a coverage report |
| `frontend` | `pnpm run dev` | Start the Vite dev server |
| `frontend` | `pnpm run build` | Build for production into `dist/` |
| `frontend` | `pnpm run lint` | Run ESLint |
| `frontend` | `pnpm test` | Run the store, cache and formatter tests |

## Testing

```bash
cd backend && pnpm test
cd frontend && pnpm test
```

The backend tests need no setup and never touch a real database. They start an in-memory MongoDB with `mongodb-memory-server` (the binary, about 120 MB, downloads on the first run), give each test file its own database, and use fake secrets from `backend/vitest.config.js`.

- **Backend (110 tests, about 87% line coverage):** every REST route through `supertest`, including login and cookies, validation errors, access checks (who can read, react, edit, delete, manage a group), encryption at rest, the profanity filter, the rate limit and magic reply with a mocked Groq response. Socket tests connect real `socket.io-client` sockets and check the handshake, message and typing delivery, call signaling, group rooms, online status and that bad payloads are dropped.
- **Frontend (30 tests):** the Zustand conversation store, the IndexedDB message cache (on `fake-indexeddb`) and the time formatters.

GitHub Actions runs both suites, ESLint and the production build on every push to `main` and on pull requests (`.github/workflows/ci.yml`).

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
| `POST` | `/messages/send/:id` | Send a message to a chat, or to a user to start a chat |
| `PUT` | `/messages/edit/:messageId` | Edit your message |
| `DELETE` | `/messages/delete/:messageId` | Delete your message for everyone |
| `POST` | `/messages/react/:messageId` | Add, change or remove a reaction |
| `POST` | `/messages/read/:id` | Mark a chat as read |
| `POST` | `/messages/magic-reply` | Draft a reply with AI |
| `POST` | `/groups/create` | Create a group |
| `GET` | `/groups/:groupId` | Group details |
| `PUT` | `/groups/:groupId/update` | Change the group name or icon (admins) |
| `PUT` | `/groups/:groupId/name` | Rename the group (admins) |
| `PUT` | `/groups/:groupId/participants/add` | Add a member (admins) |
| `PUT` | `/groups/:groupId/participants/remove` | Remove a member (admins), or leave the group |
| `PUT` | `/groups/:groupId/admins/add` | Make a member an admin (admins) |
| `PUT` | `/groups/:groupId/admins/remove` | Remove an admin (admins) |
| `DELETE` | `/groups/:groupId/delete` | Delete the group (admins) |
| `GET` | `/cloudinary/signature` | Signed upload for chat media (also `/profile-pic` and `/group-icon`) |

`GET /healthz` (outside `/api`) returns `{ "status": "ok" }` and is what the keep-alive job pings.

## Deployment

Everything deploys from `main`.

- **Frontend (Vercel):** root directory `frontend`. `vercel.json` forwards `/api/*` to the Render backend and sends every other path to `index.html`. Set `VITE_API_URL` to the Render URL.
- **Backend (Render):** root directory `backend`, Node 22, build command `corepack enable && pnpm install --frozen-lockfile`, start command `pnpm start`, Render auto-deploy off. Set the required variables from the table above.
- **CI and backend deploys (GitHub Actions):** `.github/workflows/ci.yml` runs on every push. When the backend tests pass on `main` and the push changed something in `backend/`, it calls the Render deploy hook, stored in the `RENDER_DEPLOY_HOOK_URL` repository secret. Running the workflow by hand from the Actions tab always deploys.
- **Keep-alive (GitHub Actions):** `.github/workflows/keep-alive.yml` calls `/healthz` every 10 minutes so the free Render instance doesn't fall asleep. GitHub may start scheduled runs a few minutes late, and it turns scheduled workflows off after 60 days without commits; turn it back on from the Actions tab. It can also be run by hand from there.

## License

MIT. See [LICENSE](./LICENSE).
