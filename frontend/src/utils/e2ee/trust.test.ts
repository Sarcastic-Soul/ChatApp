import { describe, expect, it } from "vitest";
import { checkPeers, rememberPeer, safetyNumber } from "./trust";

const alice = { _id: "alice", publicKey: "QUxJQ0U=" };
const bob = { _id: "bob", publicKey: "Qk9C" };

describe("safetyNumber", () => {
    it("is twelve groups of five digits, the same from both sides", async () => {
        const mine = await safetyNumber(alice, bob);
        expect(mine).toHaveLength(12);
        expect(mine.every((group) => /^\d{5}$/.test(group))).toBe(true);
        expect(await safetyNumber(bob, alice)).toEqual(mine);
    });

    it("changes when either key changes", async () => {
        const before = await safetyNumber(alice, bob);
        const after = await safetyNumber(alice, { ...bob, publicKey: "Qk9CMg==" });
        expect(after).not.toEqual(before);
    });
});

describe("remembered keys", () => {
    it("remembers a contact on first sight and warns when the key changes", async () => {
        const me = `me-${Math.random()}`;
        expect(await checkPeers(me, [bob])).toEqual([{ ...bob, changed: false, verified: false }]);
        expect((await checkPeers(me, [bob]))[0].changed).toBe(false);

        const newBob = { ...bob, publicKey: "Qk9CMg==" };
        expect((await checkPeers(me, [newBob]))[0].changed).toBe(true);
        // Still a warning until the user accepts the new key
        expect((await checkPeers(me, [newBob]))[0].changed).toBe(true);
        await rememberPeer(me, newBob, false);
        expect((await checkPeers(me, [newBob]))[0].changed).toBe(false);
    });

    it("keeps a verification only for the key that was verified", async () => {
        const me = `me-${Math.random()}`;
        await checkPeers(me, [bob]);
        await rememberPeer(me, bob, true);
        expect((await checkPeers(me, [bob]))[0].verified).toBe(true);

        const changed = (await checkPeers(me, [{ ...bob, publicKey: "Qk9CMg==" }]))[0];
        expect(changed).toMatchObject({ changed: true, verified: false });
    });

    it("keeps each account's contacts apart", async () => {
        await rememberPeer("me-one", bob, true);
        expect((await checkPeers("me-two", [bob]))[0].verified).toBe(false);
    });
});
