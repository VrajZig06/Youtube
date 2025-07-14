require("dotenv").config();
const JWT = require("jsonwebtoken");
const User = require("../models/user.model");
const { asyncHandler } = require("../utils/asyncHandler");
const { ApiError } = require("../utils/ApiError");

const jwtVerify = asyncHandler(async (req, res, next) => {
  try {
    let accessToken =
      req.header("Authorization")?.replace("Bearer ", "") ||
      req.cookies?.accessToken;

    let user = JWT.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);

    if (!user) {
      throw new ApiError(401, "Invalid AccessToken");
    }

    let AuthenticateUser = await User.findById(user?._id).select(
      "-password -refreshToken"
    );

    if (!AuthenticateUser) {
      throw new ApiError(401, "Invalid AccessToken");
    }

    req.user = AuthenticateUser;
    next();
  } catch (error) {
    console.log(error);
    throw new ApiError(500, "Something Went Wrong During Authentication");
  }
});

module.exports = { jwtVerify };
