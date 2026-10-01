import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/user.model.js";
import Conversation from "./models/conversation.model.js";
import Message from "./models/message.model.js";
import { encryptText } from "./utils/encryption.js";


const seedDatabase = async () => {
    try {
        console.log("🌱 Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_DB_URI);
        console.log("✅ Connected.");

        console.log("🗑️ Clearing existing data...");
        await User.deleteMany({});
        await Conversation.deleteMany({});
        await Message.deleteMany({});

        console.log("👥 Creating dummy users...");
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("password123", salt);

        const usersData = [
            {
                fullName: "Alice Smith",
                username: "alice",
                password: hashedPassword,
                profilePic:
                    "https://ui-avatars.com/api/?name=Alice+Smith&background=random",
                isPublic: true,
            },
            {
                fullName: "Bob Johnson",
                username: "bob",
                password: hashedPassword,
                profilePic:
                    "https://ui-avatars.com/api/?name=Bob+Johnson&background=random",
                isPublic: true,
            },
            {
                fullName: "Charlie Private",
                username: "charlie",
                password: hashedPassword,
                profilePic:
                    "https://ui-avatars.com/api/?name=Charlie+Private&background=random",
                isPublic: false,
            },
            {
                fullName: "David Lee",
                username: "david",
                password: hashedPassword,
                profilePic:
                    "https://ui-avatars.com/api/?name=David+Lee&background=random",
                isPublic: true,
            },
            {
                fullName: "Emma Watson",
                username: "emma",
                password: hashedPassword,
                profilePic:
                    "https://ui-avatars.com/api/?name=Emma+Watson&background=random",
                isPublic: true,
            },
            {
                fullName: "Frank Castle",
                username: "frank",
                password: hashedPassword,
                profilePic:
                    "https://ui-avatars.com/api/?name=Frank+Castle&background=random",
                isPublic: true,
            },
            {
                fullName: "Grace Hopper",
                username: "grace",
                password: hashedPassword,
                profilePic:
                    "https://ui-avatars.com/api/?name=Grace+Hopper&background=random",
                isPublic: true,
            },
            {
                fullName: "Henry Ford",
                username: "henry",
                password: hashedPassword,
                profilePic:
                    "https://ui-avatars.com/api/?name=Henry+Ford&background=random",
                isPublic: true,
            },
        ];

        const createdUsers = await User.insertMany(usersData);
        const [alice, bob, charlie, david, emma, frank, grace, henry] =
            createdUsers;

        console.log("💬 Creating 1-on-1 conversation (Alice & Bob)...");
        const conv1 = await Conversation.create({
            participants: [alice._id, bob._id],
            isGroupChat: false,
        });

        // Create a long list of messages for Alice & Bob to test search, scrolling, and magic reply
        const aliceBobMessages = [
            {
                sender: alice,
                text: "Hey Bob, how have you been?",
                status: "read",
            },
            {
                sender: bob,
                text: "I'm doing great Alice! Just testing out the new chat app features.",
                status: "read",
                reaction: { userId: alice._id, emoji: "❤️" },
            },
            {
                sender: alice,
                text: "Same here. I heard they added search and magic replies.",
                status: "read",
            },
            {
                sender: bob,
                text: "Yeah! Let's test the search feature. Can you find the word 'banana' in this chat?",
                status: "read",
            },
            {
                sender: alice,
                text: "Haha, I see what you did there. Banana found!",
                status: "read",
                reaction: { userId: bob._id, emoji: "😂" },
            },
            {
                sender: bob,
                text: "Look at this cool image I found!",
                status: "read",
                mediaUrl:
                    "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0",
                mediaType: "image",
            },
            {
                sender: alice,
                text: "Wow, that is beautiful! 😮",
                status: "read",
                reaction: { userId: bob._id, emoji: "👍" },
            },
            {
                sender: bob,
                text: "What are your plans for the weekend?",
                status: "read",
            },
            {
                sender: alice,
                text: "Probably just relaxing and doing some coding. You?",
                status: "read",
            },
            {
                sender: bob,
                text: "I might go hiking if the weather is nice.",
                status: "read",
            },

            {
                sender: alice,
                text: "That sounds awesome. Make sure to take pictures!",
                status: "read",
            },
            {
                sender: bob,
                text: "I actually meant to say mountain biking, not hiking!",
                status: "read",
                isEdited: true,
            },
            {
                sender: alice,
                text: "Oh wow, that's even better!",
                status: "read",
            },
            {
                sender: alice,
                text: "This message was deleted",
                status: "read",
                isDeleted: true,
            },
            {
                sender: bob,
                text: "Will do. Btw, have you tried the new video calling yet?",
                status: "sent",
            },

        ];


        for (const msgData of aliceBobMessages) {
            const msg = await Message.create({
                senderId: msgData.sender._id,
                receiverId: conv1._id,
                message: msgData.text ? encryptText(msgData.text) : "",
                status: msgData.status,
                isEdited: msgData.isEdited || false,
                isDeleted: msgData.isDeleted || false,

                mediaUrl: msgData.mediaUrl || null,
                mediaType: msgData.mediaType || "text",
                reactions: msgData.reaction
                    ? [
                          {
                              userId: msgData.reaction.userId,
                              reaction: msgData.reaction.emoji,
                          },
                      ]
                    : [],
            });
            conv1.messages.push(msg._id);
        }
        await conv1.save();

        console.log("💬 Creating 1-on-1 conversation (Bob & Charlie)...");
        const conv2 = await Conversation.create({
            participants: [bob._id, charlie._id],
            isGroupChat: false,
        });

        const msg13 = await Message.create({
            senderId: bob._id,
            receiverId: conv2._id,
            message: encryptText(
                "Hey Charlie, I know your profile is private but we have an existing chat!",
            ),
            status: "read",
        });

        const msg14 = await Message.create({
            senderId: charlie._id,
            receiverId: conv2._id,
            message: encryptText(
                "Yes, existing connections are preserved! Thanks for checking.",
            ),
            status: "read",
            reactions: [{ userId: bob._id, reaction: "👍" }],
        });

        conv2.messages.push(msg13._id, msg14._id);
        await conv2.save();

        console.log("💬 Creating 1-on-1 conversation (Emma & Frank)...");
        const conv3 = await Conversation.create({
            participants: [emma._id, frank._id],
            isGroupChat: false,
        });

        const msg15 = await Message.create({
            senderId: emma._id,
            receiverId: conv3._id,
            message: encryptText(
                "Hey Frank! Did you see the new dark mode theme?",
            ),
            status: "read",
        });

        const msg16 = await Message.create({
            senderId: frank._id,
            receiverId: conv3._id,
            message: encryptText(
                "Yes! It looks amazing. Way better than the old white theme.",
            ),
            status: "sent",
            reactions: [{ userId: emma._id, reaction: "😎" }],
        });

        conv3.messages.push(msg15._id, msg16._id);
        await conv3.save();

        console.log(
            "👥 Creating Group Chat (Alice, Bob, David, Emma, Frank)...",
        );
        const groupConv = await Conversation.create({
            participants: [alice._id, bob._id, david._id, emma._id, frank._id],
            isGroupChat: true,
            groupName: "The Dev Team 💻",
            admins: [alice._id, bob._id], // Multiple admins to test dismiss admin feature
        });

        const groupMessages = [
            {
                sender: alice,
                text: "Welcome to the group guys! I've made Bob an admin too.",
                status: "read",
            },
            {
                sender: bob,
                text: "Thanks Alice! Now I can add or remove people too.",
                status: "read",
                reaction: { userId: alice._id, emoji: "🎉" },
            },
            {
                sender: david,
                text: "Glad to be here! When is the next meeting?",
                status: "read",
            },
            {
                sender: emma,
                text: "I think it's on Tuesday. Alice can confirm.",
                status: "read",
            },
            {
                sender: frank,
                text: "Can we test the video call feature in a group?",
                status: "read",
            },
            {
                sender: alice,
                text: "Currently we only support 1-on-1 video calls, but group calls are coming soon!",
                status: "read",
                reaction: { userId: frank._id, emoji: "😢" },
            },
            {
                sender: bob,
                text: "Let's test the search feature here. Everyone say a random fruit.",
                status: "read",
            },
            { sender: david, text: "Apple 🍎", status: "read" },
            { sender: emma, text: "Mango 🥭", status: "read" },
            {
                sender: frank,
                text: "Watermelon 🍉",
                status: "sent",
                reaction: { userId: david._id, emoji: "😂" },
            },
        ];

        for (const msgData of groupMessages) {
            const msg = await Message.create({
                senderId: msgData.sender._id,
                receiverId: groupConv._id,
                message: msgData.text ? encryptText(msgData.text) : "",
                status: msgData.status,
                reactions: msgData.reaction
                    ? [
                          {
                              userId: msgData.reaction.userId,
                              reaction: msgData.reaction.emoji,
                          },
                      ]
                    : [],
            });
            groupConv.messages.push(msg._id);
        }
        await groupConv.save();

        console.log(
            "🎉 Database seeded successfully with extensive mock data!",
        );
        process.exit(0);
    } catch (error) {
        console.error("❌ Error seeding database:", error);
        process.exit(1);
    }
};

seedDatabase();
