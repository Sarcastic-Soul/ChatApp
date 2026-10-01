import type { Types } from "mongoose";

// Whether a list of ObjectIds holds an id given as an ObjectId or a string
export const includesId = (ids: Types.ObjectId[], id: Types.ObjectId | string) =>
    ids.some((item) => item.equals(id));
