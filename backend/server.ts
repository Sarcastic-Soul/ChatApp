import connectToMongoDB from "./db/connectToMongoDB.ts";
import { server } from "./app.ts";

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    connectToMongoDB();
    console.log(`Server running on port ${PORT}`);
});
