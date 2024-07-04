import { asyncHandler } from '../utitlity/asyncHandler.js'
import { ApiError } from '../utitlity/apiError.js'
import { User } from '../models/user.models.js'
import { uploadOnCloudinary } from '../utitlity/cloudinary.js'
import { ApiResponse } from '../utitlity/apiResponse.js'
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        // the save() method is used to persist changes made to a document (in this case, user) back to the database.
        //  This validation checks if the data meets the requirements specified in the Mongoose schema (e.g., required fields, data types, etc.). If any validation errors occur, Mongoose will throw an error and prevent the save operation.
        //  The {validateBeforeSave: false} option passed to save() tells Mongoose to skip the validation step before saving the document. 
        await user.save({validateBeforeSave: false}) // we are saving refreshToken in database 

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token.")
    }
}

// Register User :
const registerUser = asyncHandler( async(req, res) => {
    // steps for register user :
    // 1. get user details from frontend
    // 2. validation - not empty
    // 3. check if user already exists: by username or email
    // 4. check for images, check for avatar
    // 5. upload them to cloudiary, check for avatar again
    // 6. create user object - create entry in db
    // 7. check for user creation
    // 8. remove password and refresh token field from response
    // 9. return response

    // express give access req.body
    // 1.) get user details from frontend
    const { username, email, fullName, password } = req.body
    // console.log("email: ",email);

    // 2.) validation - not empty
    if([username, email, fullName, password].some((field) => field === undefined || field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    } 

    // 3.) check if user already exists: by username or email
    // The findOne operation in MongoDB is used to get a single document from the collection if the given query matches the collection record. 
    // check if user already exists: by username or email
    const existedUser = await User.findOne({
        // In MongoDB, The $or operator performs a logical OR operation on an array of one or more <expressions> and selects the documents that satisfy at least one of the <expressions>.
        // { $or: [ { <expression1> }, { <expression2> }, ... , { <expressionN> } ] }
        $or: [{ username }, { email }]
    })
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists!")
    }

    // 4.) check for avatar and coverImage images, check for avatar
    // multer give access req.files
    // console.log(req.files);
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required!")
    }

    // 5.) upload them to cloudiary, check for avatar again
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar) {
        throw new ApiError(400, "Avatar file is required!")}

    // 6.) create user object - create entry in db
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),
    })

    // 7.) check for user creation
    // 8.) remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }
    
    // 9.) return response
    return res
    .status(201)
    .json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )
});

// Login User :
const loginUser = asyncHandler( async(req, res) => {
    // get user data from req body
    // check user detail by username or email 
    // find the user
    // check password is correct or not, if not match throw error
    // access and refresh token
    // send cookie

    const { username, email, password } = req.body
    // console.log(req.body);
    // console.log("login email: ",email);

    // this is condition when user do not give detail
    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })
    // console.log("login user: ", user);

    // this is condition when username or email don't match with User's details
    if(!user) {
        throw new ApiError(404, "User does not exist")
    }

    const isPasswordValid = await user.password
    // console.log("password" , isPasswordValid);

    if(!isPasswordValid) {
        throw new ApiError(401, "Password is incorrect")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    // we are making options bcz we don't want that any user or client change cookies
    const options = {
        httpOnly: true,
        secure: true,
    }

    // Cookies are small data that is stored on the client’s computer. Using this cookie various tasks like authentication, session management, etc can be done.
    //  In Express JS we can use the cookie-parser middleware to manage the cookies in the application.

    return res
    .status(200)
    .cookie("accessToken", accessToken, options) // res.cookie() method is used to set a new value for the cookie
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, {user: loggedInUser, accessToken, refreshToken}, // this is condition when user wants to save refresh and access token, this is not a good step for user but we are taking this condition also
            "User logged In successfully")
         )
})

// Logout User :
const logoutUser = asyncHandler( async(req, res) => {
    // clear cookie
    
    // findByIdAndUpdate() function is used to find a matching document, updates it according to the update arg, passing any options, and returns the found document.
    await User.findByIdAndUpdate(
        req.user._id, // req.user access is coming from verifyJWT(auth.middle.js) file which we're using in route for middleware
        {
            $set: { // $set is mongodb operator is used to update field
                refreshToken: undefined // update value by $set
            }
        },
        {
            new: true // new updated value
        }
    )

    const options = {
        httpOnly: true,
        secure: true,
    }

    return res
    .status(200)
    .clearCookie("accessToken", options) // The res.clearCookie() function is used to clear the cookie specified by name.
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})

// refresh access token for user that comes on web again do not have to login again and again  
const refreshAccessToken = asyncHandler( async(req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user) {
            throw new ApiError(401, "Invalid User Token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id)
    
        const options = {
            httpOnly: true,
            secure: true,
        }
        
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(200, {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Refresh Token")
    }
})
export {
     registerUser, 
     loginUser,
     logoutUser,
     refreshAccessToken,
}
