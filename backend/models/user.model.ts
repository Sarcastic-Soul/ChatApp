import mongoose, { type HydratedDocument, type InferSchemaType, type Types } from "mongoose";

const userSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
        },
        username: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
            minlength: 6,
        },
        profilePic: {
            type: String,
            default: "",
        },
        isPublic: {
            type: Boolean,
            default: true,
        },
        // End-to-end encryption. The public half of the user's P-256 key
        // pair, made in their browser. keyVersion goes up when they reset it.
        publicKey: {
            type: String,
            default: undefined,
        },
        keyVersion: {
            type: Number,
            default: undefined,
        },
        // The private key, encrypted in the browser with a key derived from a
        // passphrase the server never sees. Lets a new browser restore it.
        keyBackup: {
            type: {
                salt: String,
                iv: String,
                data: String,
                iterations: Number,
                _id: false,
            },
            default: undefined,
            select: false,
        },
        // createdAt, updatedAt
    },
    { timestamps: true },
);

export type UserFields = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserFields>;

// What populate() returns when it selects the public profile fields
export type PublicUser = Pick<UserFields, "fullName" | "username" | "profilePic" | "isPublic"> & {
    _id: Types.ObjectId;
};

const User = mongoose.model("User", userSchema);

export default User;
