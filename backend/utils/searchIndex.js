import crypto from "crypto";

// Messages are encrypted with a random IV, so the database can't search
// them. Instead each message stores a "blind index": keyed hashes (HMAC) of
// its words and their prefixes. A search hashes the query words the same
// way and matches hashes, so the server never stores the words themselves.
// The trade-off: someone with the database but not the key can still see
// that two messages share a word, just not which word.

// A separate key derived from ENCRYPTION_KEY, so the index key and the
// encryption key are never the same bytes
const indexKey = crypto
    .createHmac("sha256", process.env.ENCRYPTION_KEY)
    .update("message-search-index")
    .digest();

const MIN_PREFIX = 3;
const MAX_PREFIX = 12;
const MAX_WORDS = 200;

const hash = (token) =>
    crypto.createHmac("sha256", indexKey).update(token).digest("base64url").slice(0, 16);

// Lowercase, accents removed, split on anything that isn't a letter or digit
export const words = (text) =>
    (text || "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .match(/[\p{L}\p{N}]+/gu) || [];

// Two-letter words are indexed whole; longer words by every prefix from 3
// to 12 letters, so "meet" finds "meeting"
export const searchTokensFor = (text) => {
    const tokens = new Set();
    for (const word of [...new Set(words(text))].slice(0, MAX_WORDS)) {
        if (word.length < 2) continue;
        if (word.length === 2) {
            tokens.add(hash(`w:${word}`));
            continue;
        }
        for (let n = MIN_PREFIX; n <= Math.min(word.length, MAX_PREFIX); n++) {
            tokens.add(hash(`p:${word.slice(0, n)}`));
        }
    }
    return [...tokens];
};

// Hashes a message must have to match the query. Empty when nothing in the
// query is long enough to search for.
export const queryTokensFor = (query) =>
    [...new Set(words(query))]
        .filter((word) => word.length >= 2)
        .map((word) => (word.length === 2 ? hash(`w:${word}`) : hash(`p:${word.slice(0, MAX_PREFIX)}`)));

// The index matches prefixes of up to 12 letters, so results are checked
// again against the decrypted text: every query word must start a word in it
export const matchesQuery = (text, query) => {
    const textWords = words(text);
    return words(query)
        .filter((word) => word.length >= 2)
        .every((q) => textWords.some((w) => (q.length === 2 ? w === q : w.startsWith(q))));
};
