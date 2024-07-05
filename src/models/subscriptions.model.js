import mongoose, { Schema } from "mongoose";

const subscripitonSchema = new Schema(
    {
        subcriber: {
            type: Schema.Types.ObjectId, // one who is subscribing
            ref: "User"
        },
        channel: {
            type: Schema.Types.ObjectId, // one to whom 'subscriber' is subscribing
            ref: "User"
        }
    }, 
    {timestamps: true}
);

export const Subscripiton = mongoose.model("Subscription", subscripitonSchema)