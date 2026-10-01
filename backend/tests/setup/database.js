import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { afterAll, beforeAll, inject } from "vitest";

beforeAll(async () => {
    await mongoose.connect(inject("mongoUri"), { dbName: `test-${randomUUID()}` });
});

afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
});
