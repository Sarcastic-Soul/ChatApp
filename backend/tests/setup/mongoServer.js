import { MongoMemoryServer } from "mongodb-memory-server-core";

// One in-memory MongoDB for the whole run. Each test file gets its own
// database on it (see database.js), so files can run in parallel.
export default async function setup(project) {
    const mongo = await MongoMemoryServer.create();
    project.provide("mongoUri", mongo.getUri());

    return async () => {
        await mongo.stop();
    };
}
