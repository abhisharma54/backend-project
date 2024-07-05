import { asyncHandler } from '../utitlity/asyncHandler.js'
import { ApiError } from '../utitlity/apiError.js'
import { User } from '../models/user.models.js'
import { uploadOnCloudinary } from '../utitlity/cloudinary.js'
import { ApiResponse } from '../utitlity/apiResponse.js'
import jwt from "jsonwebtoken"
import mongoose from 'mongoose'

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
    console.log("Found user:", user);

    const isPasswordValid = await user.isPasswordCorrect(password)
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
            // The $set operator replaces the value of a field with the specified value.
            // The $unset operator deletes a particular field.
            $unset: { 
                refreshToken: 1 // this removes the field from document
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

// change current password
const changeCurrentPassword = asyncHandler( async(req, res) => {
    const { oldPassword, newPassword } = req.body

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect) {
        throw new ApiError(400, "Invalid Password")
    }

    user.password = newPassword;
    await user.save({validateBeforeSave: false});

    return res
    .status(200)
    .json(new ApiResponse(200, {newPassword}, "Password changed Successfully"))
})

// get current user
const getCurrentUser = asyncHandler( async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current User Fetched Successfully"))
})

// updatae accout details like fullName, email
const updateAccountDetails = asyncHandler( async(req, res) => {
    const {fullName, email} = req.body

    if(!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email,
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account Details Updated Successfully" ))
})

// update avatar image
const updateUserAvatar = asyncHandler( async(req, res) => {
    const avatarLocalPath = req.file?.path;

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is Missing!")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url) {
        throw new ApiError(400, "Error while uploading avatar!")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")


    return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar Updated Successfully"))

})

// update coverImage 
const updateUserCoverImage = asyncHandler( async(req, res) => {
    const coverImageLocalPath = req.file?.path;

    if(!coverImageLocalPath) {
        throw new ApiError(400, "CoverImage File is Missing!")
    }

    const coverImage = uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage) {
        throw new ApiError(400, "Error while uploading coverImage")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "CoverImage updated Successfully"))

})

// get user channel profile 
const getUserChannelProfile = asyncHandler( async(req, res) => {
    const {username} = req.params

    if(!username) {
        throw new ApiError(400, "Username is missing!")
    }

    const channel = await User.aggregate([
        {
            // Filters the documents to pass only the documents that match the specified condition(s) to the next pipeline stage.
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            // $lookup is used to perform a left outer join between documents from two collections. It allows you to combine data from multiple collections into a single result set based on a matching condition.
            $lookup: { // this lookup is for how many subscibers, subscribe a channel
                from: "subscriptions", // Specifies the collection in the same database to perform the join with.
                localField: "_id", //  The field from the input documents (current collection) to match documents from the 'from' collection.
                foreignField: "channel", // The field from the 'from' collection to match documents with the 'localField'.
                as: "subscribers" // Specifies the name of the new array field to add to the input documents. 
            }
        },
        {
            $lookup: { // this lookup is for how many channel we subscribed
                from: "subscriptions",
                localField: "_id",
                foreignField: "subcriber",
                as: "subscribedTo"
            }
        },
        {
            //  $addFields stage is used to add new fields to documents(user.models.js) in the pipeline. Unlike $set, which modifies existing fields.
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    // $cond: Evaluates a boolean expression to return one of the two specified return expressions.
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            // $project is an essential stage that allows you to reshape documents.
            // It can include, exclude, rename fields, compute new fields, and more. 
            $project: {
                fullName: 1, // 1 to include, 0 to exclude
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1,
            }
        }
    ])

    if(!channel?.length) {
        throw new ApiError(404, "Channel doesn't exists")
    }

    return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "User channel fetch successfully"))
})

// get user watch history
const getWatchHistory = asyncHandler( async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

 return res
 .status(200)
 .json(new ApiResponse(200, user[0].watchHistory, "Watch history fetched successfully"))
})

export {
     registerUser, 
     loginUser,
     logoutUser,
     refreshAccessToken,
     changeCurrentPassword,
     getCurrentUser,
     updateAccountDetails,
     updateUserAvatar,
     updateUserCoverImage,
     getUserChannelProfile,
     getWatchHistory,
}
