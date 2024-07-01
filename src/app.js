import express from 'express'
import cors from 'cors'
import cookiesParser from 'cookie-parser'

const app = express()

// Middleware : Middleware is a request handler that allows you to intercept and manipulate requests and responses before they reach route handlers.
// The app.use() function is used to mount the specified middleware function(s) at the path that is being specified. It is mostly used to set up middleware for your application. 
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}))

app.use(express.json({limit: "16kb"})); // data by submitting form or data from form such as username,email,password,dob, etc.
app.use(express.urlencoded({extended: true, limit: "16kb"})) // data from url such as https://google.com/userId?search=abhishek%20sharma
app.use(express.static("public")) // The express.static() function is a built-in middleware function in Express. It serves static files and is based on serve-static or we can say it is public assests for image,pdf,file
// Cookie-parser middleware is used to parse the cookies that are attached to the request made by the client to the server. 
// A cookie is a piece of data that is sent to the client-side with a request and is stored on the client-side itself by the Web Browser the user is currently using. With the help of cookies –
// * It is easy for websites to remember the user’s information
// * It is easy to capture the user’s browsing history
// * It is also useful in storing the user’s sessions
app.use(cookiesParser())

export { app } 