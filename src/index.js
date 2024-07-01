import dotenv from 'dotenv'
import connectDB from "./db/index.js";
import { app } from './app.js'

dotenv.config({
    path: './env'
})


connectDB()
.then(() => {
    const port = process.env.PORT
    app.listen(port || 8000, () => {
        console.log(`Server is running at port ${port}`);
    });

    app.on("error", (error) => {
        console.log("ERROR::", error);
    })
})
.catch((error) => {
    console.log("MongoDb connection FAILED::", error);
})











/*
we can do this but we will import this code from other file so it looks clean 

import mongoose from "mongoose";
import { DB_NAME } from "./db/index.js"
import express from 'express'
const app = express()

;(async() => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error", (error) => {
            console.log("ERROR::", error);
            throw error
        })
        app.listen(process.env.MONGODB_URI, () => {
            console.log(`App is listening on port ${process.env.MONGODB_URI}`);
        })
    } catch (error) {
        console.log("MongoDB is Failed::", error);
        throw error;
    }
})()
*/