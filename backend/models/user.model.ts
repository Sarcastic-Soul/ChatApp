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
