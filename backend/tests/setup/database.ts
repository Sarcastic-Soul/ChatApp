import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { afterAll, beforeAll, inject } from "vitest";

beforeAll(async () => {
    await mongoose.connect(inject("mongoUri"), { dbName: `test-${randomUUID()}` });
    // Indexes build in the background; tests that rely on a unique index
    // must not start before it exists
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
});

afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
});
