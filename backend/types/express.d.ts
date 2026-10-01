import type { UserDocument } from "../models/user.model.ts";

declare global {
    namespace Express {
        interface Request {
            // Set by protectRoute. Routes without it never read this.
            user: UserDocument;
        }
    }
}
