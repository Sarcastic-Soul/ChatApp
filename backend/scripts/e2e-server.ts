import { MongoMemoryServer } from "mongodb-memory-server-core";

// Starts the real server against a throwaway in-memory MongoDB, for the
// Playwright tests in frontend/e2e. Secrets come from the Playwright config,
// and no .env file is loaded, so this can never reach a real database.
const mongo = await MongoMemoryServer.create();
process.env.MONGO_DB_URI = mongo.getUri("chatapp-e2e");

const stop = async () => {
    await mongo.stop();
    process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

await import("../server.ts");
