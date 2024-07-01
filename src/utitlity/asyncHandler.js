
// const asyncHandler = () => {}
// const asyncHandler = (func) => {() => {}} // OR const asyncHandler = (func) => () => {}
// const asyncHandler = (func) => async() => {}

// above steps we can write in single step, this is higher order function 
// Higher order function : Higher order function is a function that accept function as an arrgument, return function, or both.

// There are two ways to make asyncHandler
// tryCatch syntax -
// const asyncHandler = (fn) => async(req, res, next) => {
//     try {
//         await fn(req, res, next)
//     } catch (error) {
//         res.status(error.code || 500).json({
//             success: false,
//             message: error.message,
//         })
//         console.log("asyncHandler Error::", error);
//     }
// }

//  promises syntax -
const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise
        .resolve(requestHandler(req, res, next))
        .catch((err) => next(err))
    }
}

export { asyncHandler }