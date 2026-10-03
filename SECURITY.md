# Security

ChatApp is a personal project, not an audited product. This page says what it protects, what it doesn't, and how to report a problem.

## Reporting a problem

Please don't open a public issue for a security bug.

- Use **[Report a vulnerability](https://github.com/Sarcastic-Soul/ChatApp/security/advisories/new)** on GitHub. It opens a private report only the maintainer can see.
- Say what you found, how to reproduce it and what an attacker could do with it.

The live demo at [chatapp-e2e.vercel.app](https://chatapp-e2e.vercel.app/) is fine to test against with your own accounts. Please don't flood it, and don't touch other people's accounts.

## What is protected

| Data | Protection | Who can read it |
| --- | --- | --- |
| Messages in a chat where every member has a key | End-to-end: AES-GCM-256 in the browser, chat key sealed per member with ECDH P-256 | Only the members |
| Messages in a chat where someone has no key yet, call logs, group notices | AES-256-CBC before saving | The server, and members when they ask |
| Private keys | Kept in the browser as non-extractable keys. The server holds a backup encrypted with a key made from the passphrase (PBKDF2-SHA256, 600,000 rounds) | Only someone with the passphrase |
| Passwords | bcrypt hashes | Nobody |
| Login | JWT in an `httpOnly` cookie | Not readable by page scripts |
| Search | Keyed hashes of words, not the words | The server sees which messages share a word, not which word |

## What is not protected

| Gap | Detail |
| --- | --- |
| Media | Images, videos and voice notes are stored on Cloudinary unencrypted. Anyone with the link can open them |
| Metadata | The server sees who talks to whom and when, reactions, and edit and read states |
| No key checking | There are no safety numbers. A server that handed out a fake public key could read new messages |
| Weak passphrases | Someone with the database can guess them offline. PBKDF2 only slows that down |
| Magic reply | Sends recent messages to Groq as plain text. It asks first in encrypted chats |
| The demo account | `alice` and her passphrase are public. Don't put anything private there |

The full design is in [docs/how-it-works.md](docs/how-it-works.md#end-to-end-encryption).

## Secrets

- Secrets live in environment variables and are never committed. See [Environment variables](docs/development.md#environment-variables).
- An early commit in this repo's history contains an old `.env` file. Every value in it has been replaced, so it no longer opens anything.
