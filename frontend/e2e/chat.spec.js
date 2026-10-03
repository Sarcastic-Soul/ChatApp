import { expect, test } from "@playwright/test";

const stamp = Date.now().toString(36);

const PASSPHRASE = "e2e test passphrase";

const signUp = async (page, fullName, username) => {
    await page.goto("/signup");
    await page.getByRole("textbox", { name: "Full name" }).fill(fullName);
    await page.getByRole("textbox", { name: "Username" }).fill(username);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("password123");
    await page.getByRole("textbox", { name: "Confirm password" }).fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();

    // A new account picks the passphrase that backs up its key
    await expect(page.getByRole("heading", { name: "Choose a passphrase" })).toBeVisible();
    await page.getByRole("textbox", { name: "Passphrase", exact: true }).fill(PASSPHRASE);
    await page.getByRole("textbox", { name: "Confirm passphrase" }).fill(PASSPHRASE);
    await page.getByRole("button", { name: "Turn on encryption" }).click();
    await expect(page.getByRole("navigation", { name: "Chats" })).toBeVisible();
};

// A 1x1 PNG
const PHOTO = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
);

// The bytes of the "file" field in an upload form
const uploadedFile = (request) => {
    const body = request.postDataBuffer();
    const start = body.indexOf("\r\n\r\n", body.indexOf('name="file"')) + 4;
    const boundary = body.subarray(0, body.indexOf("\r\n"));
    return body.subarray(start, body.indexOf(Buffer.concat([Buffer.from("\r\n"), boundary]), start));
};

// Stands in for the media host: keeps what's uploaded and serves it back
const fakeMediaHost = async (context, uploads) => {
    const headers = { "access-control-allow-origin": "*" };
    await context.route("https://api.cloudinary.com/**", async (route) => {
        uploads.push(uploadedFile(route.request()));
        const url = `https://res.cloudinary.com/e2e-cloud/raw/upload/v1/${uploads.length - 1}.bin`;
        await route.fulfill({ json: { secure_url: url }, headers });
    });
    await context.route("https://res.cloudinary.com/**", async (route) => {
        const id = Number(route.request().url().match(/(\d+)\.bin$/)?.[1]);
        await route.fulfill({ body: uploads[id], contentType: "application/octet-stream", headers });
    });
};

const isSend = (request) => request.method() === "POST" && request.url().includes("/api/messages/send/");

test("two people chat in real time", async ({ browser }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const uploads = [];
    await fakeMediaHost(aliceContext, uploads);
    await fakeMediaHost(bobContext, uploads);
    const alice = await aliceContext.newPage();
    const bob = await bobContext.newPage();

    await signUp(alice, "Alice Test", `alice_${stamp}`);
    await signUp(bob, "Bob Test", `bob_${stamp}`);

    // Alice starts a chat with Bob
    await alice.getByRole("button", { name: "New chat or group" }).click();
    await alice.getByRole("menuitem", { name: "New chat" }).click();
    await alice.getByRole("dialog").getByText("Bob Test").click();
    await alice.getByRole("textbox", { name: "Message", exact: true }).fill("Hi Bob, it's Alice");
    const firstSend = alice.waitForRequest(isSend);
    await alice.getByRole("button", { name: "Send" }).click();
    await expect(alice.getByRole("main").getByText("Hi Bob, it's Alice")).toBeVisible();

    // Both have keys, so the server only ever sees ciphertext
    const sent = (await firstSend).postDataJSON();
    expect(sent.e2ee).toBeTruthy();
    expect(sent.newKey.envelopes).toHaveLength(2);
    expect(JSON.stringify(sent)).not.toContain("Hi Bob");
    await expect(alice.getByLabel("End-to-end encrypted")).toBeVisible();

    // Bob's chat list shows the decrypted message and that it is unread
    await bob.reload();
    const bobChats = bob.getByRole("navigation", { name: "Chats" });
    await expect(bobChats.getByText("Hi Bob, it's Alice")).toBeVisible();
    await expect(bobChats.getByLabel("1 unread")).toBeVisible();

    // He opens the chat and sees the message; the unread count clears
    await bobChats.getByText("Alice Test").click();
    await expect(bobChats.getByLabel("1 unread")).toHaveCount(0);
    await expect(bob.getByRole("main").getByText("Hi Bob, it's Alice")).toBeVisible();

    // From here on, messages arrive over the socket with no reload
    await bob.getByRole("textbox", { name: "Message", exact: true }).fill("Hey Alice!");
    await bob.getByRole("button", { name: "Send" }).click();
    await expect(alice.getByRole("main").getByText("Hey Alice!")).toBeVisible();

    await alice.getByRole("textbox", { name: "Message", exact: true }).fill("Profanity check: shit happens");
    await alice.getByRole("button", { name: "Send" }).click();
    await expect(bob.getByRole("main").getByText("Profanity check: **** happens")).toBeVisible();

    // A photo is encrypted before it's uploaded: the media host gets bytes
    // it can't read, and the key travels inside the encrypted message
    await alice.locator('input[type="file"]').setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PHOTO });
    await alice.getByRole("textbox", { name: "Message", exact: true }).fill("Photo from the trip");
    const photoSend = alice.waitForRequest(isSend);
    await alice.getByRole("button", { name: "Send" }).click();
    const photo = (await photoSend).postDataJSON();
    expect(photo.e2ee.media).toBeTruthy();
    expect(photo.mediaSecret).toBeUndefined();
    expect(uploads).toHaveLength(1);
    expect(uploads[0].includes("PNG")).toBe(false);
    await expect(bob.getByRole("main").getByText("Photo from the trip")).toBeVisible();
    await expect(bob.getByRole("main").getByAltText("Shared image")).toHaveAttribute("src", /^blob:/);

    // A message written offline waits in the outbox and goes out once the
    // connection is back, exactly once
    await aliceContext.setOffline(true);
    await alice.getByRole("textbox", { name: "Message", exact: true }).fill("Written on the train");
    await alice.getByRole("button", { name: "Send" }).click();
    await expect(alice.getByRole("main").getByText("Written on the train")).toBeVisible();
    await expect(alice.getByLabel("Sending")).toBeVisible();

    await aliceContext.setOffline(false);
    await expect(bob.getByRole("main").getByText("Written on the train")).toHaveCount(1);
    await expect(alice.getByLabel("Sending")).toHaveCount(0);

    // On a new browser Bob unlocks his key with the passphrase and can
    // read the history
    const bobLaptop = await (await browser.newContext()).newPage();
    await bobLaptop.goto("/login");
    await bobLaptop.getByRole("textbox", { name: "Username" }).fill(`bob_${stamp}`);
    await bobLaptop.getByRole("textbox", { name: "Password", exact: true }).fill("password123");
    await bobLaptop.getByRole("button", { name: "Log in" }).click();
    await bobLaptop.getByRole("textbox", { name: "Passphrase", exact: true }).fill("not the passphrase");
    await bobLaptop.getByRole("button", { name: "Unlock" }).click();
    await expect(bobLaptop.getByRole("main").getByText("That passphrase didn't work.")).toBeVisible();
    await bobLaptop.getByRole("textbox", { name: "Passphrase", exact: true }).fill(PASSPHRASE);
    await bobLaptop.getByRole("button", { name: "Unlock" }).click();
    await bobLaptop.getByRole("navigation", { name: "Chats" }).getByText("Alice Test").click();
    await expect(bobLaptop.getByRole("main").getByText("Hi Bob, it's Alice")).toBeVisible();
    await expect(bobLaptop.getByRole("main").getByText("Profanity check: **** happens")).toBeVisible();

    await aliceContext.close();
    await bobContext.close();
    await bobLaptop.context().close();
});

test("a wrong password shows an error", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Username" }).fill("nobody_here");
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Invalid username or password")).toBeVisible();
});
