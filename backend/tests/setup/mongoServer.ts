import { MongoMemoryServer } from "mongodb-memory-server-core";
import type { TestProject } from "vitest/node";

declare module "vitest" {
    export interface ProvidedContext {
        mongoUri: string;
    }
}

// One in-memory MongoDB for the whole run. Each test file gets its own
// database on it (see database.ts), so files can run in parallel.
export default async function setup(project: TestProject) {
    const mongo = await MongoMemoryServer.create();
    project.provide("mongoUri", mongo.getUri());

    return async () => {
        await mongo.stop();
    };
}
