import mongoose from "mongoose";
import { requireEnv } from "../config/env.ts";
import { errorMessage } from "../utils/errorMessage.ts";

const connectToMongoDB = async () => {
    if (mongoose.connection.readyState >= 1) {
        console.log("Already connected to MongoDB.");
        return;
    }

    try {
        await mongoose.connect(requireEnv("MONGO_DB_URI"));
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Error connecting to MongoDB:", errorMessage(error));
    }
};

export default connectToMongoDB;
