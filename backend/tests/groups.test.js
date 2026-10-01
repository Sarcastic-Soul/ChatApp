import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { createUser, missingId } from "./helpers.js";

let owner, member, outsider, privateUser;

beforeAll(async () => {
    [owner, member, outsider, privateUser] = await Promise.all([
        createUser({ fullName: "Group Owner" }),
        createUser({ fullName: "Group Member" }),
        createUser({ fullName: "Outsider" }),
        createUser({ fullName: "Private Person" }),
    ]);
    await privateUser.agent.put("/api/users/privacy").send({ isPublic: false });
});

const createGroup = (user, body) => user.agent.post("/api/groups/create").send(body);

const systemTexts = async (groupId) => {
    const group = await Conversation.findById(groupId).populate("messages");
    return group.messages.filter((m) => m.isSystem).length;
};

describe("creating groups", () => {
    test("the creator becomes the only admin and duplicates are dropped", async () => {
        const res = await createGroup(owner, {
            name: "  Weekend trip  ",
            participants: [member.user._id, member.user._id, owner.user._id],
        });

        expect(res.status).toBe(201);
        expect(res.body.groupName).toBe("Weekend trip");
        expect(res.body.isGroupChat).toBe(true);
        expect(res.body.admins).toEqual([owner.user._id]);
        expect(res.body.participants.sort()).toEqual([owner.user._id, member.user._id].sort());
        expect(await systemTexts(res.body._id)).toBe(1);
    });

    test("private users can't be added at creation", async () => {
        const res = await createGroup(owner, { name: "Nope", participants: [privateUser.user._id] });
        expect(res.status).toBe(403);
    });

    test("unknown users are 404", async () => {
        const res = await createGroup(owner, { name: "Ghosts", participants: [missingId] });
        expect(res.status).toBe(404);
    });

    test.each([
        ["no name", { name: "", participants: ["0123456789abcdef01234567"] }, "Group name is required"],
        ["a name over 50 characters", { name: "a".repeat(51), participants: ["0123456789abcdef01234567"] }, "Group name must be 50 characters or fewer"],
        ["no participants", { name: "Empty", participants: [] }, "Pick at least one person"],
        ["a bad participant id", { name: "Bad", participants: ["nope"] }, "Participant is not a valid id"],
    ])("rejects %s", async (_name, body, error) => {
        const res = await createGroup(owner, body);
        expect(res.status).toBe(400);
        expect(res.body.error).toBe(error);
    });
});

describe("managing a group", () => {
    let groupId;
    const url = (path = "") => `/api/groups/${groupId}${path}`;

    beforeEach(async () => {
        const res = await createGroup(owner, { name: "Team", participants: [member.user._id] });
        groupId = res.body._id;
    });

    test("members can see the group, outsiders can't", async () => {
        const seen = await member.agent.get(url());
        expect(seen.status).toBe(200);
        expect(seen.body.participants.map((p) => p.fullName).sort()).toEqual(["Group Member", "Group Owner"]);

        const hidden = await outsider.agent.get(url());
        expect(hidden.status).toBe(403);
    });

    test("only admins can rename", async () => {
        const denied = await member.agent.put(url("/name")).send({ name: "Mine now" });
        expect(denied.status).toBe(403);

        const res = await owner.agent.put(url("/name")).send({ name: "Renamed" });
        expect(res.status).toBe(200);
        expect(res.body.groupName).toBe("Renamed");
    });

    test("update needs a name or an https icon", async () => {
        const empty = await owner.agent.put(url("/update")).send({});
        expect(empty.status).toBe(400);
        expect(empty.body.error).toBe("Nothing to update");

        const badIcon = await owner.agent.put(url("/update")).send({ groupIcon: "http://insecure.example/icon.png" });
        expect(badIcon.status).toBe(400);

        const res = await owner.agent
            .put(url("/update"))
            .send({ groupIcon: "https://res.cloudinary.com/demo/image/upload/icon.png" });
        expect(res.status).toBe(200);
        expect(res.body.groupIcon).toBe("https://res.cloudinary.com/demo/image/upload/icon.png");
    });

    test("adding people: admins only, no duplicates, no private users", async () => {
        const byMember = await member.agent.put(url("/participants/add")).send({ userIdToAdd: outsider.user._id });
        expect(byMember.status).toBe(403);

        const added = await owner.agent.put(url("/participants/add")).send({ userIdToAdd: outsider.user._id });
        expect(added.status).toBe(200);
        expect(added.body.participants).toContain(outsider.user._id);

        const again = await owner.agent.put(url("/participants/add")).send({ userIdToAdd: outsider.user._id });
        expect(again.status).toBe(400);

        const hidden = await owner.agent.put(url("/participants/add")).send({ userIdToAdd: privateUser.user._id });
        expect(hidden.status).toBe(403);
    });

    test("a member can leave, but can't remove others", async () => {
        const denied = await member.agent.put(url("/participants/remove")).send({ userIdToRemove: owner.user._id });
        expect(denied.status).toBe(403);

        const left = await member.agent.put(url("/participants/remove")).send({ userIdToRemove: member.user._id });
        expect(left.status).toBe(200);
        expect(left.body.participants).not.toContain(member.user._id);
    });

    test("the only admin can't be removed", async () => {
        const res = await owner.agent.put(url("/participants/remove")).send({ userIdToRemove: owner.user._id });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Cannot remove the only admin.");
    });

    test("removing someone who isn't in the group is 400", async () => {
        const res = await owner.agent.put(url("/participants/remove")).send({ userIdToRemove: outsider.user._id });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("User is not in the group.");
    });

    test("promoting and dismissing admins", async () => {
        const outsiderPromoted = await owner.agent.put(url("/admins/add")).send({ userIdToMakeAdmin: outsider.user._id });
        expect(outsiderPromoted.status).toBe(400);
        expect(outsiderPromoted.body.error).toBe("Only group members can be made admins.");

        const promoted = await owner.agent.put(url("/admins/add")).send({ userIdToMakeAdmin: member.user._id });
        expect(promoted.status).toBe(200);
        expect(promoted.body.admins.sort()).toEqual([owner.user._id, member.user._id].sort());

        const twice = await owner.agent.put(url("/admins/add")).send({ userIdToMakeAdmin: member.user._id });
        expect(twice.status).toBe(400);

        const dismissed = await member.agent.put(url("/admins/remove")).send({ userIdToDismiss: owner.user._id });
        expect(dismissed.status).toBe(200);
        expect(dismissed.body.admins).toEqual([member.user._id]);

        const lastAdmin = await member.agent.put(url("/admins/remove")).send({ userIdToDismiss: member.user._id });
        expect(lastAdmin.status).toBe(400);
        expect(lastAdmin.body.error).toBe("Cannot dismiss the only admin.");
    });

    test("every change adds a system message", async () => {
        await owner.agent.put(url("/name")).send({ name: "Step 1" });
        await owner.agent.put(url("/participants/add")).send({ userIdToAdd: outsider.user._id });
        await owner.agent.put(url("/admins/add")).send({ userIdToMakeAdmin: outsider.user._id });

        const group = await Conversation.findById(groupId).populate("messages");
        const system = group.messages.filter((m) => m.isSystem);
        expect(system).toHaveLength(4);
        // Stored encrypted like any other message
        expect(system.every((m) => /^[a-f\d]{32}:/.test(m.message))).toBe(true);
    });

    test("members can send messages to the group", async () => {
        const res = await member.agent.post(`/api/messages/send/${groupId}`).send({ message: "hello team" });
        expect(res.status).toBe(201);
        expect(res.body.newMessage.receiverId).toBe(groupId);

        const blocked = await outsider.agent.post(`/api/messages/send/${groupId}`).send({ message: "hi?" });
        expect(blocked.status).toBe(403);
    });

    test("only admins can delete the group", async () => {
        const denied = await member.agent.delete(url("/delete"));
        expect(denied.status).toBe(403);

        const res = await owner.agent.delete(url("/delete"));
        expect(res.status).toBe(200);
        expect(await Conversation.exists({ _id: groupId })).toBeNull();
    });

    test("a missing group is 404", async () => {
        const res = await owner.agent.get(`/api/groups/${missingId}`);
        expect(res.status).toBe(404);
    });
});

test("system messages can't be forged through the send route", async () => {
    const res = await createGroup(owner, { name: "Forgery", participants: [member.user._id] });
    await member.agent.post(`/api/messages/send/${res.body._id}`).send({ message: "x", isSystem: true });
    const forged = await Message.countDocuments({ receiverId: res.body._id, senderId: member.user._id, isSystem: true });
    expect(forged).toBe(0);
});
