# How ChatApp works

[Back to the README](../README.md)

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

## Requests

- The React app is a static build on Vercel.
- Vercel forwards every `/api/*` request to the Express server on Render.
- So the browser only ever talks to one domain, and the login cookie works without third-party cookie rules.

## Login

- Logging in sets a JWT in an `HttpOnly` cookie.
- Every protected route checks it in `protectRoute`.
- The socket server lives on Render's own domain and can't read that cookie.
- So the app first asks `GET /api/auth/socket-token` for a token that lasts 5 minutes and is only valid for opening a socket.

## Real-time updates

- Each socket joins a room named after its user ID, plus one room per group the user is in.
- When a message is sent, edited, deleted or reacted to, the API saves it and then sends the change to the right rooms.
- A user with several tabs open gets updates in all of them.

## Delivery

| Problem | How it's handled |
| --- | --- |
| A sent message should show at once | The browser gives it a UUID (`clientId`) and saves it to an outbox in IndexedDB before sending. It shows in the chat with a clock icon. |
| The network or server is down | The message stays in the outbox. It is sent again when the socket reconnects, the browser comes back online, or a retry timer fires (2 s, 5 s, 15 s, up to a minute). |
| A retry could create a duplicate | A unique index on sender and `clientId` means a retry of a send that already went through gets the saved copy back. |
| Two people send at the same time | Each chat keeps a counter (`lastSeq`). The server gives every message the next number with one atomic `$inc`, so all devices sort a chat the same way. |
| A device missed messages while offline | After a reconnect the open chat asks for `?after=<newest number it has>` and gets only what it missed. |
| Read state must be exact | Read receipts carry the number read up to. The sender's messages show as read only up to that number. |
| Chats older than sequence numbers | They are numbered in send order the first time they're opened. |
| The chat list needs previews and unread counts | Each chat stores its newest message, and the list counts messages numbered after the one each person last read. Encrypted previews are decrypted in the browser. |
| The app should open with no network | The service worker keeps the app's files, and the chat list and messages come from the IndexedDB cache. |

**Disappearing messages**

- A chat can be set to delete new messages after 1 hour, 1 day or 7 days (`PUT /api/messages/timer/:id`). In a group only admins can change it.
- Each message sent while the timer is on gets an `expiresAt` time. A MongoDB TTL index deletes it then, and browsers drop it from the screen and the cache.
- Messages sent before the timer was set stay, and so does the notice saying it changed.

## Several servers

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

See [Load test](testing.md#load-test) for numbers.

## End-to-end encryption

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

**Attachments**

- In an end-to-end chat the browser makes a new AES-GCM-256 key for each file, encrypts the file and uploads the ciphertext.
- The file's key, type, size and a tiny blurred preview go inside the encrypted message, sealed with the chat key.
- The server refuses an attachment without that sealed part in an encrypted chat, so nothing readable can be uploaded there by mistake.
- Forwarding to another encrypted chat reuses the same upload and only shares the key again.
- Photos load blurred first, and a video is only downloaded when someone presses play.

**Checking keys**

- Each pair of people has a safety number: a SHA-512 hash of both user IDs and public keys, shown as groups of five digits. If both see the same number, nobody swapped a key.
- The browser remembers the key it first saw for each contact. If the server later hands out a different one, the chat shows a warning until the number is checked again.

**In the browser**

- Messages are decrypted wherever they come in: history, the socket, catch-up and the outbox.
- The readable copies stay in the IndexedDB cache until logout, which also deletes the private key.

**What it doesn't cover**

| Gap | Detail |
| --- | --- |
| Media metadata | The server sees that a message has a photo, video or voice note, and Cloudinary sees the encrypted file's size |
| Metadata | Reactions, who talks to whom and when, and edit and read states are visible to the server |
| Unchecked keys | Safety numbers only protect people who compare them |
| Weak passphrases | Can be guessed offline by someone with the database, since PBKDF2 only slows that down |
| Push notifications | Say "New message" instead of the text |
| Magic reply | Sends recent messages to Groq as plain text, after asking |
| Search | Only finds encrypted messages already in this browser's cache |

## Encryption at rest

- **What:** text the server can read (chats where someone has no key yet, call logs, group notices).
- **How:** AES-256-CBC (Node `crypto`) with a random IV before it is saved.
- **When it's decrypted:** only when a member of the chat asks for it.
- The server won't start without `ENCRYPTION_KEY`.

## Search

Text encrypted at rest can't go in a MongoDB text index, so each message also gets a **blind index**.

- **What's stored:** keyed hashes (HMAC-SHA256, with a key derived from `ENCRYPTION_KEY`) of each word and its word starts, from 3 to 12 letters. Two-letter words are stored whole.
- **Example:** "meeting" is stored as the hashes of "mee", "meet", ... "meeting", so typing "meet" finds it.
- **A search** hashes the query words the same way, finds messages with every hash in chats the user belongs to, then decrypts the hits and checks them again.
- **The trade-off:** someone with only the database sees hashes, not words, but can tell when two messages share a word.
- **Edits and deletes:** edits update the hashes and deletes clear them.
- **Older messages:** `pnpm run backfill:search` adds hashes to messages saved before search existed.
- **End-to-end encrypted messages** get no hashes. The browser searches its own cache for them and merges the results.

## Input checks

- Every route that takes input runs its params, query and body through a [zod](https://zod.dev) schema (`backend/validation/schemas.ts`).
- Bad input gets a `400` with a readable message.
- Unknown fields are dropped before they reach the controller.
- The controllers take their request types from the same schemas (`ValidatedRequest<typeof sendMessageSchema>`), so a field the schema doesn't define is a type error.
- Socket event payloads are checked too, and malformed ones are ignored.

## Calls

- The two browsers swap WebRTC offers, answers and ICE candidates through the socket server, then send audio and video straight to each other.
- **STUN:** Google's STUN servers help each browser find its public address.
- **TURN:** when both people sit behind strict NATs (mobile data, office Wi-Fi), a direct path often can't be found. The backend hands out short-lived TURN relay credentials from Cloudflare or Metered (`GET /api/calls/ice-servers`).
- The provider key stays on the server. The browser only sees credentials that expire within a day.

## Notifications

- When a message arrives for someone with no tab open, the backend sends a Web Push notification (`web-push`, VAPID keys) to every browser they turned notifications on in.
- The payload is encrypted for that browser, so the push service (Google, Mozilla or Apple) can't read the message preview.
- The service worker (`frontend/public/sw.js`) shows it, and clicking it opens that chat.
- Subscriptions the push service has dropped are deleted.
- Logging out turns notifications off for that browser.

## Magic reply

- The backend sends the last 10 messages (500 characters each, at most) to Groq's OpenAI-compatible chat API using `openai/gpt-oss-120b`.
- One draft uses a few hundred tokens, far below the free tier's 8K tokens a minute.
- If Groq rate limits the request, the user is asked to try again in a minute.

## Uploads

- The backend signs a Cloudinary upload.
- The browser uploads the file straight to Cloudinary.
- Files never pass through the API server.
- Photos larger than 1600 pixels are scaled down in the browser first.
- In end-to-end chats the file is encrypted before upload (see [End-to-end encryption](#end-to-end-encryption)), up to 10 MB.
- Photos and avatars the server can read are requested at the size shown, in the best format the browser takes.
