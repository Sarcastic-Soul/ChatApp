import connectToMongoDB from "./db/connectToMongoDB.js";
import { server } from "./app.js";

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    connectToMongoDB();
    console.log(`Server running on port ${PORT}`);
});
