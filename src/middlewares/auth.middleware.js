import { ApiError } from "../utitlity/apiError.js";
import { asyncHandler } from "../utitlity/asyncHandler.js";
import jwt  from 'jsonwebtoken'
import { User } from "../models/user.models.js";

export const verifyJWT = asyncHandler( async(req, _, next) => { // in production grade app we use async(req, !res = _, next )
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
        // if user using mobile app therefore we are using || req.header("")?.replace("", "")
    
        if(!token)  {
            throw new ApiError(401, "Unauthorization request")
        }
        
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id).select(
            "-password -refreshToken" // select method specifies which document fields to include or exclude (for exclude use -sign and field name)
        )
    
        if(!user) {
            throw new ApiError(401, "Invalid Access Token")
        }
    
        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(401, error?.message || "Invaild access token")
    }
})