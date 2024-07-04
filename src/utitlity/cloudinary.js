import { v2 as cloudinary } from "cloudinary";
import fs from 'fs' // file System in node.js
// The fs module in Node.js provides an interface for working with the file system.
// fs allows you to perform various operations such as reading from and writing to files, manipulating directories, and handling file permissions.

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY ,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null;
        // upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        })
        // file has been uploaded successfully
        // console.log("response data cloudinary", response);
        // console.log("file is uploaded on cloudinary", response.url);
        fs.unlinkSync(localFilePath); // remove the locally saved temporary file 
        return response;
    } catch (error) {
        fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got failed
        return null;
    }
}

export { uploadOnCloudinary }