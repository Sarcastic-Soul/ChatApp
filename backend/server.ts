import connectToMongoDB from "./db/connectToMongoDB.ts";
import { server } from "./app.ts";
import { setUpRedis } from "./config/redis.ts";

const PORT = process.env.PORT || 5000;

// Only when REDIS_URL is set (several servers behind a load balancer)
const redis = await setUpRedis();

server.listen(PORT, () => {
    connectToMongoDB();
    console.log(`Server running on port ${PORT}`);
});

// Take this server out of the shared online list before it stops
const shutDown = async () => {
    try {
        await redis?.close();
    } finally {
        process.exit(0);
    }
};
process.on("SIGTERM", shutDown);
process.on("SIGINT", shutDown);
