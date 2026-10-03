import mongoose, { type Types } from "mongoose";
import bcrypt from "bcryptjs";
import User, { type UserDocument } from "./models/user.model.ts";
import Conversation from "./models/conversation.model.ts";
import Message from "./models/message.model.ts";
import ChatKey from "./models/chatKey.model.ts";
import PushSubscription from "./models/pushSubscription.model.ts";
import { encryptText } from "./utils/encryption.ts";
import { searchTokensFor } from "./utils/searchIndex.ts";
import { requireEnv } from "./config/env.ts";

// Sample media for the demo chats: Unsplash photos, a CC0 clip from MDN and
// a generated tune, all kept in one Cloudinary folder
const MEDIA = "https://res.cloudinary.com/dhagorcpe";
const photo = (name: string) => `${MEDIA}/image/upload/MERN-ChatApp/demo/${name}`;
const clip = (name: string) => `${MEDIA}/video/upload/MERN-ChatApp/demo/${name}`;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type SeedMessage = {
    // Shorthand used by replyTo to point at an earlier message in the chat
    key?: string;
    from: UserDocument;
    // How long before "now" the message was sent, in milliseconds
    ago: number;
    text?: string;
    image?: string;
    video?: string;
    audio?: string;
    replyTo?: string;
    reactions?: [UserDocument, string][];
    unread?: boolean;
    edited?: boolean;
    deleted?: boolean;
    forwarded?: boolean;
    call?: boolean;
    system?: boolean;
};

type SeedChat = {
    participants: UserDocument[];
    group?: { name: string; admins: UserDocument[]; icon?: string };
    messages: SeedMessage[];
};

// Saves a chat the way the app would have: numbered messages, search
// hashes, and timestamps spread over the past days instead of all "now"
const createChat = async ({ participants, group, messages }: SeedChat) => {
    const now = Date.now();
    const conversationId = new mongoose.Types.ObjectId();
    const ordered = [...messages].sort((a, b) => b.ago - a.ago);
    const ids = ordered.map(() => new mongoose.Types.ObjectId());
    const idByKey = new Map<string, Types.ObjectId>();
    ordered.forEach((message, index) => {
        if (message.key) idByKey.set(message.key, ids[index]);
    });

    const docs = ordered.map((message, index) => {
        const sentAt = new Date(now - message.ago);
        const text = message.deleted ? "This message was deleted" : message.text;
        const searchable = text && !message.deleted && !message.call && !message.system;
        const mediaUrl = message.image || message.video || message.audio || null;
        return {
            _id: ids[index],
            senderId: message.from._id,
            receiverId: conversationId,
            message: text ? encryptText(text) : "",
            searchTokens: searchable ? searchTokensFor(text) : undefined,
            mediaUrl: message.deleted ? null : mediaUrl,
            mediaType: message.deleted
                ? "text"
                : message.image
                  ? "image"
                  : message.video
                    ? "video"
                    : message.audio
                      ? "audio"
                      : "text",
            status: message.unread ? "sent" : "read",
            isEdited: !!message.edited,
            isDeleted: !!message.deleted,
            isForwarded: !!message.forwarded,
            isCall: !!message.call,
            isSystem: !!message.system,
            seq: index + 1,
            replyTo: message.replyTo ? idByKey.get(message.replyTo) : null,
            reactions: (message.reactions || []).map(([user, reaction]) => ({
                userId: user._id,
                reaction,
            })),
            createdAt: sentAt,
            updatedAt: sentAt,
        };
    });

    // A message still marked "sent" is unread for everyone but its sender
    const unread = Object.fromEntries(
        participants.map((user) => [
            user._id.toString(),
            docs.filter((doc) => doc.status === "sent" && !doc.isSystem && !doc.senderId.equals(user._id)).length,
        ]),
    );

    const first = docs[0].createdAt;
    const last = docs[docs.length - 1].createdAt;
    await Conversation.insertMany(
        [
            {
                _id: conversationId,
                participants: participants.map((user) => user._id),
                lastSeq: docs.length,
                lastMessage: ids[ids.length - 1],
                lastMessageSeq: docs.length,
                unread,
                isGroupChat: !!group,
                groupName: group?.name,
                groupIcon: group?.icon,
                admins: group?.admins.map((user) => user._id) || [],
                createdAt: first,
                updatedAt: last,
            },
        ],
        { timestamps: false },
    );
    await Message.insertMany(docs, { timestamps: false });
};

const seedDatabase = async () => {
    try {
        console.log("🌱 Connecting to MongoDB...");
        await mongoose.connect(requireEnv("MONGO_DB_URI"));
        console.log("✅ Connected.");

        console.log("🗑️ Clearing existing data...");
        await Promise.all([
            User.deleteMany({}),
            Conversation.deleteMany({}),
            Message.deleteMany({}),
            ChatKey.deleteMany({}),
            PushSubscription.deleteMany({}),
        ]);

        console.log("👥 Creating demo users...");
        const password = await bcrypt.hash("password123", await bcrypt.genSalt(10));
        const person = (fullName: string, username: string, isPublic = true) => ({
            fullName,
            username,
            password,
            profilePic: photo(`av-${username}.png`),
            isPublic,
        });
        const [alice, bob, charlie, david, emma, frank, grace, henry] = await User.insertMany([
            person("Alice Smith", "alice"),
            person("Bob Johnson", "bob"),
            person("Charlie Private", "charlie", false),
            person("David Lee", "david"),
            person("Emma Wilson", "emma"),
            person("Frank Costa", "frank"),
            person("Grace Kim", "grace"),
            person("Henry Okafor", "henry"),
        ]);

        // Alice is the public demo account, so her chats show every feature
        console.log("💬 Creating Alice's chats...");
        await createChat({
            participants: [alice, bob],
            messages: [
                { from: alice, ago: 6 * DAY + 5 * HOUR, text: "Hey Bob! How's it going?" },
                {
                    from: bob,
                    ago: 6 * DAY + 5 * HOUR - 2 * MINUTE,
                    text: "All good! Just trying out this chat app.",
                    reactions: [[alice, "❤️"]],
                },
                {
                    from: alice,
                    ago: 6 * DAY + 5 * HOUR - 4 * MINUTE,
                    text: "Same here. Try the search box: look for the word banana.",
                },
                {
                    from: bob,
                    ago: 6 * DAY + 5 * HOUR - 5 * MINUTE,
                    text: "Banana found! Search works across every chat.",
                    reactions: [[alice, "😂"]],
                },
                {
                    key: "plans",
                    from: bob,
                    ago: 4 * DAY + 3 * HOUR,
                    text: "What are your plans for the weekend?",
                },
                {
                    from: alice,
                    ago: 4 * DAY + 3 * HOUR - 3 * MINUTE,
                    text: "Mostly coding and a long walk. You?",
                    replyTo: "plans",
                },
                {
                    from: bob,
                    ago: 4 * DAY + 3 * HOUR - 5 * MINUTE,
                    text: "Mountain biking on the ridge trail, if the weather holds.",
                    edited: true,
                },
                {
                    from: alice,
                    ago: 4 * DAY + 3 * HOUR - 6 * MINUTE,
                    text: "Nice. Take pictures!",
                },
                {
                    key: "trail",
                    from: bob,
                    ago: 2 * DAY + 7 * HOUR,
                    text: "Made it to the top. Look at this view!",
                    image: photo("trail.jpg"),
                    reactions: [[alice, "😮"]],
                },
                {
                    from: alice,
                    ago: 2 * DAY + 7 * HOUR - 4 * MINUTE,
                    text: "Wow, that is beautiful.",
                    replyTo: "trail",
                    reactions: [[bob, "👍"]],
                },
                {
                    from: alice,
                    ago: 2 * DAY + 6 * HOUR,
                    text: "My walk was calmer. Found this on the way.",
                    video: clip("flower.mp4"),
                    reactions: [[bob, "❤️"]],
                },
                { from: alice, ago: 2 * DAY + 6 * HOUR - 2 * MINUTE, deleted: true },
                {
                    from: bob,
                    ago: DAY + 4 * HOUR,
                    text: "I recorded the tune I've been practicing. Be honest!",
                    audio: clip("tune.mp3"),
                },
                {
                    from: alice,
                    ago: DAY + 4 * HOUR - 6 * MINUTE,
                    text: "That's catchy! Keep going.",
                    reactions: [[bob, "👍"]],
                },
                { from: bob, ago: DAY + 2 * HOUR, text: "Missed voice call", call: true },
                { from: alice, ago: DAY + HOUR, text: "Sorry, was in a meeting. Calling you back." },
                { from: alice, ago: DAY + HOUR - MINUTE, text: "Video call ended • 12:47", call: true },
                {
                    from: bob,
                    ago: 3 * HOUR,
                    text: "Emma sent me this spot for the next ride.",
                    image: photo("valley.jpg"),
                    forwarded: true,
                },
                {
                    from: bob,
                    ago: 25 * MINUTE,
                    text: "Are you free on Saturday? We could all go.",
                    unread: true,
                },
                {
                    from: bob,
                    ago: 24 * MINUTE,
                    text: "Also, try the magic reply button next to the message box.",
                    unread: true,
                },
            ],
        });

        await createChat({
            participants: [alice, emma],
            messages: [
                {
                    from: emma,
                    ago: 3 * DAY + 2 * HOUR,
                    text: "Hi Alice! Did you see the new dark mode?",
                },
                {
                    from: alice,
                    ago: 3 * DAY + 2 * HOUR - 3 * MINUTE,
                    text: "Yes! I switched to the rust accent color too.",
                    reactions: [[emma, "👍"]],
                },
                {
                    key: "desk",
                    from: emma,
                    ago: 2 * DAY + 2 * HOUR,
                    text: "New desk setup for the hackathon.",
                    image: photo("laptop.jpg"),
                },
                {
                    from: alice,
                    ago: 2 * DAY + 2 * HOUR - 5 * MINUTE,
                    text: "Clean. Which keyboard is that?",
                    replyTo: "desk",
                },
                {
                    from: emma,
                    ago: 2 * DAY + 2 * HOUR - 7 * MINUTE,
                    text: "A cheap mechanical one. Loud but fun.",
                },
                { from: emma, ago: 20 * HOUR, text: "Missed video call", call: true },
                {
                    from: emma,
                    ago: 20 * HOUR - MINUTE,
                    text: "Call me when you can, I have a question about the project.",
                },
                { from: alice, ago: 19 * HOUR, text: "Voice call ended • 04:12", call: true },
                {
                    from: emma,
                    ago: 19 * HOUR - 6 * MINUTE,
                    text: "Thanks, that cleared it up!",
                    reactions: [[alice, "👍"]],
                },
            ],
        });

        await createChat({
            participants: [alice, david],
            messages: [
                {
                    from: david,
                    ago: 5 * DAY,
                    text: "Hey Alice, can you send me the notes from Tuesday's meeting?",
                },
                {
                    from: alice,
                    ago: 5 * DAY - 10 * MINUTE,
                    text: "Sure: ship the search feature first, then group calls.",
                },
                {
                    from: david,
                    ago: 5 * DAY - 12 * MINUTE,
                    text: "Perfect, thank you.",
                    reactions: [[alice, "👍"]],
                },
                {
                    from: david,
                    ago: 30 * HOUR,
                    text: "Lunch today was worth the walk.",
                    image: photo("food.jpg"),
                },
                {
                    from: alice,
                    ago: 30 * HOUR - 8 * MINUTE,
                    text: "Now I'm hungry. Where is that?",
                },
                {
                    from: david,
                    ago: 30 * HOUR - 10 * MINUTE,
                    text: "The new place near the station. Let's go next week.",
                },
            ],
        });

        await createChat({
            participants: [alice, grace],
            messages: [
                {
                    from: grace,
                    ago: 6 * DAY,
                    text: "Hi! Bob gave me your username. I'm joining the dev team next month.",
                },
                {
                    from: alice,
                    ago: 6 * DAY - 20 * MINUTE,
                    text: "Welcome, Grace! I'll add you to the group chat.",
                    reactions: [[grace, "👍"]],
                },
            ],
        });

        console.log("👥 Creating group chats...");
        await createChat({
            participants: [alice, bob, david, emma, frank, grace],
            group: { name: "The Dev Team 💻", admins: [alice, bob] },
            messages: [
                {
                    from: alice,
                    ago: 7 * DAY,
                    text: 'created group "The Dev Team 💻"',
                    system: true,
                },
                {
                    from: alice,
                    ago: 7 * DAY - 2 * MINUTE,
                    text: "Welcome to the group, everyone! I've made Bob an admin too.",
                },
                {
                    from: bob,
                    ago: 7 * DAY - 4 * MINUTE,
                    text: "Thanks Alice! Now I can add or remove people too.",
                    reactions: [[alice, "👍"]],
                },
                {
                    key: "meeting",
                    from: david,
                    ago: 7 * DAY - 9 * MINUTE,
                    text: "Glad to be here! When is the next meeting?",
                },
                {
                    from: emma,
                    ago: 7 * DAY - 11 * MINUTE,
                    text: "Tuesday at 10, in the usual room.",
                    replyTo: "meeting",
                    reactions: [
                        [david, "👍"],
                        [alice, "👍"],
                    ],
                },
                {
                    from: alice,
                    ago: 6 * DAY - 30 * MINUTE,
                    text: "added Grace Kim to the group",
                    system: true,
                },
                { from: grace, ago: 6 * DAY - 40 * MINUTE, text: "Hello team!" },
                {
                    from: frank,
                    ago: 3 * DAY + 5 * HOUR,
                    text: "Can we do video calls in a group?",
                },
                {
                    from: alice,
                    ago: 3 * DAY + 5 * HOUR - 3 * MINUTE,
                    text: "Calls are one-to-one for now. Group calls are on the list.",
                    reactions: [[frank, "😢"]],
                },
                {
                    from: bob,
                    ago: 26 * HOUR,
                    text: "Let's test search here. Everyone name a random fruit.",
                },
                { from: david, ago: 26 * HOUR - MINUTE, text: "Apple 🍎" },
                { from: emma, ago: 26 * HOUR - 2 * MINUTE, text: "Mango 🥭" },
                { from: frank, ago: 26 * HOUR - 3 * MINUTE, text: "Watermelon 🍉" },
                { from: alice, ago: 26 * HOUR - 4 * MINUTE, text: "Banana 🍌, obviously." },
                {
                    key: "shot",
                    from: emma,
                    ago: 5 * HOUR,
                    text: "The search screen is ready for review.",
                    image: photo("laptop.jpg"),
                    reactions: [
                        [alice, "👍"],
                        [bob, "❤️"],
                    ],
                },
                {
                    from: bob,
                    ago: 5 * HOUR - 6 * MINUTE,
                    text: "Looks great. Merging after lunch.",
                    replyTo: "shot",
                },
                {
                    from: frank,
                    ago: 50 * MINUTE,
                    text: "Demo is at 4 today, don't be late!",
                    unread: true,
                },
            ],
        });

        await createChat({
            participants: [emma, alice, bob, david, henry],
            group: { name: "Weekend Hikers", admins: [emma], icon: photo("lake.jpg") },
            messages: [
                { from: emma, ago: 5 * DAY + 6 * HOUR, text: 'created group "Weekend Hikers"', system: true },
                {
                    from: emma,
                    ago: 5 * DAY + 6 * HOUR - MINUTE,
                    text: "changed the group icon",
                    system: true,
                },
                {
                    from: emma,
                    ago: 5 * DAY + 6 * HOUR - 3 * MINUTE,
                    text: "Who's in for the lake trail this month?",
                },
                { from: bob, ago: 5 * DAY + 5 * HOUR, text: "Me! I'll bring the bike." },
                { from: alice, ago: 5 * DAY + 4 * HOUR, text: "I'm in. Walking, not biking." },
                {
                    from: emma,
                    ago: 4 * DAY + 8 * HOUR,
                    text: "added Henry Okafor to the group",
                    system: true,
                },
                {
                    from: henry,
                    ago: 4 * DAY + 7 * HOUR,
                    text: "Thanks for adding me. This is the lake from last year.",
                    image: photo("lake.jpg"),
                    reactions: [
                        [emma, "😮"],
                        [alice, "❤️"],
                    ],
                },
                {
                    key: "start",
                    from: david,
                    ago: 2 * DAY + 9 * HOUR,
                    text: "What time do we start?",
                },
                {
                    from: emma,
                    ago: 2 * DAY + 9 * HOUR - 5 * MINUTE,
                    text: "7 am at the car park. Bring water.",
                    replyTo: "start",
                },
                {
                    from: bob,
                    ago: 2 * DAY + 8 * HOUR,
                    text: "Trail check from today. It's dry.",
                    image: photo("trail.jpg"),
                    forwarded: true,
                },
                {
                    from: henry,
                    ago: 8 * HOUR,
                    text: "Weather looks clear for Saturday.",
                    reactions: [[bob, "👍"]],
                },
            ],
        });

        // Chats Alice isn't part of, so the other accounts aren't empty
        console.log("💬 Creating the other chats...");
        await createChat({
            participants: [bob, charlie],
            messages: [
                {
                    from: bob,
                    ago: 4 * DAY,
                    text: "Hey Charlie, your profile is private but our chat still works!",
                },
                {
                    from: charlie,
                    ago: 4 * DAY - 15 * MINUTE,
                    text: "Yes, private only hides me from search. Existing chats stay.",
                    reactions: [[bob, "👍"]],
                },
            ],
        });

        await createChat({
            participants: [emma, frank],
            messages: [
                { from: emma, ago: 2 * DAY, text: "Frank, did you push the fix?" },
                {
                    from: frank,
                    ago: 2 * DAY - 9 * MINUTE,
                    text: "Yes, it's on main. Tests are green.",
                    unread: true,
                },
            ],
        });

        console.log("✅ Database seeded.");
        console.log("Log in with any username below, password: password123");
        console.log("- alice (the demo account: every feature shows up in her chats)");
        console.log("- bob, david, emma, frank, grace, henry");
        console.log("- charlie (private profile, hidden from search)");

        process.exit(0);
    } catch (error) {
        console.error("❌ Error seeding database:", error);
        process.exit(1);
    }
};

seedDatabase();
