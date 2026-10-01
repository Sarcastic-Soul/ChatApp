import { expect, test } from "@playwright/test";

const stamp = Date.now().toString(36);

const signUp = async (page, fullName, username) => {
    await page.goto("/signup");
    await page.getByRole("textbox", { name: "Full name" }).fill(fullName);
    await page.getByRole("textbox", { name: "Username" }).fill(username);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("password123");
    await page.getByRole("textbox", { name: "Confirm password" }).fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("navigation", { name: "Chats" })).toBeVisible();
};

test("two people chat in real time", async ({ browser }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const alice = await aliceContext.newPage();
    const bob = await bobContext.newPage();

    await signUp(alice, "Alice Test", `alice_${stamp}`);
    await signUp(bob, "Bob Test", `bob_${stamp}`);

    // Alice starts a chat with Bob
    await alice.getByRole("button", { name: "New chat or group" }).click();
    await alice.getByRole("menuitem", { name: "New chat" }).click();
    await alice.getByRole("dialog").getByText("Bob Test").click();
    await alice.getByRole("textbox", { name: "Message", exact: true }).fill("Hi Bob, it's Alice");
    await alice.getByRole("button", { name: "Send" }).click();
    await expect(alice.getByText("Hi Bob, it's Alice")).toBeVisible();

    // Bob opens the chat after a reload and sees the message
    await bob.reload();
    await bob.getByRole("navigation", { name: "Chats" }).getByText("Alice Test").click();
    await expect(bob.getByText("Hi Bob, it's Alice")).toBeVisible();

    // From here on, messages arrive over the socket with no reload
    await bob.getByRole("textbox", { name: "Message", exact: true }).fill("Hey Alice!");
    await bob.getByRole("button", { name: "Send" }).click();
    await expect(alice.getByText("Hey Alice!")).toBeVisible();

    await alice.getByRole("textbox", { name: "Message", exact: true }).fill("Profanity check: shit happens");
    await alice.getByRole("button", { name: "Send" }).click();
    await expect(bob.getByText("Profanity check: **** happens")).toBeVisible();

    // A message written offline waits in the outbox and goes out once the
    // connection is back, exactly once
    await aliceContext.setOffline(true);
    await alice.getByRole("textbox", { name: "Message", exact: true }).fill("Written on the train");
    await alice.getByRole("button", { name: "Send" }).click();
    await expect(alice.getByText("Written on the train")).toBeVisible();
    await expect(alice.getByLabel("Sending")).toBeVisible();

    await aliceContext.setOffline(false);
    await expect(bob.getByText("Written on the train")).toHaveCount(1);
    await expect(alice.getByLabel("Sending")).toHaveCount(0);

    await aliceContext.close();
    await bobContext.close();
});

test("a wrong password shows an error", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Username" }).fill("nobody_here");
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Invalid username or password")).toBeVisible();
});
