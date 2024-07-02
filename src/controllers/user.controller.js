import { asyncHandler } from '../utitlity/asyncHandler.js'
import { ApiError } from '../utitlity/apiError.js'
import { User } from '../models/user.models.js'
import { uploadOnCloudinary } from '../utitlity/cloudinary.js'
import { ApiResponse } from '../utitlity/apiResponse.js'

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
    if([username, email, fullName, password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required")
    } 

    // 3.) check if user already exists: by username or email
    // The findOne operation in MongoDB is used to get a single document from the collection if the given query matches the collection record. 
    // check if user already exists: by username or email
    const existedUser = User.findOne({
        $or: [{ username }, { email }]
    })
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists!")
    }

    // 4.) check for images, check for avatar
    // multer give access req.files
    const avatarLoacalPath = req.files?.avatar[0]?.path;
    const coverImageLoacalPath = req.files?.coverImage[0]?.path;

    if(!avatarLoacalPath) {
        throw new ApiError(400, "Avatar file is required!")
    }

    // 5.) upload them to cloudiary, check for avatar again
    const avatar = await uploadOnCloudinary(avatarLoacalPath);
    const coverImage = await uploadOnCloudinary(coverImageLoacalPath)

    if(!avatar) throw new ApiError(400, "Avatar file is required!");

    // 6.) create user object - create entry in db
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    // 7.) check for user creation
    // 8.) remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(createdUser) throw new ApiError(500, "Something went wrong while registering the user")
    
    // 9.) return response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )
});


export { registerUser }