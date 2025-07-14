require("dotenv").config();
const { asyncHandler } = require("../utils/asyncHandler");
const { ApiError } = require("../utils/ApiError");
const { ApiResposne } = require("../utils/ApiResponse");
const { uploadOnCloudinary } = require("../utils/cloudinary");
const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const generateAccessTokenAndRefreshToken = async (userId) => {
  try {
    let user = await User.findById(userId);
    let accessToken = user.generateAccessToken();
    let refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something Went Wrong while generating accessToen and RefreshToken"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // Get User Data from Front-end
  const { username, email, fullname, password } = req.body;

  // Validation
  if (
    [username, email, fullname, password].some((fields) => fields?.trim() == "")
  ) {
    throw new ApiError(404, "All Fields are required");
  }

  //Check user is already exists
  const existingUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existingUser) {
    throw new ApiError(409, "User Already Exists.");
  }

  // Check for images

  let avatarLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.avatar) &&
    req.files.avatar.length > 0
  ) {
    avatarLocalPath = req.files.avatar[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is Required.");
  }

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  // Upload to cloudinary
  let avatar;
  if (avatarLocalPath) {
    avatar = await uploadOnCloudinary(avatarLocalPath);
    console.log("Avatar", avatar);
  }

  let coverImage;
  if (coverImageLocalPath) {
    coverImage = await uploadOnCloudinary(coverImageLocalPath);
  }

  if (!avatar.url) {
    throw new ApiError(400, "Avatar are required");
  }

  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const userCreated = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!userCreated) {
    throw new ApiError(500, "User not Created during Registartion");
  }

  return res
    .status(201)
    .json(new ApiResposne(201, userCreated, "User Registered Successfully!"));
});

const loginUser = asyncHandler(async (req, res) => {
  if (!req.body) {
    throw new ApiError(400, "Data Required");
  }

  const { username, email, password } = req.body;

  if (email == "" && password == "") {
    throw new ApiError(400, "Please Enter all field.");
  }

  let user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User Not Found.");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  console.log(isPasswordValid);

  if (!isPasswordValid) {
    throw new ApiError(404, "Invalid Password.");
  }

  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefreshToken(user._id);

  let loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const option = {
    secure: true,
    httpOnly: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, option)
    .cookie("refreshToken", refreshToken, option)
    .json(
      new ApiResposne(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User Login Successfully."
      )
    );
});

const loggoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user?._id, {
    $set: {
      refreshToken: undefined,
    },
  });

  const option = {
    secure: true,
    httpOnly: true,
  };

  // Clear Cookies
  res
    .status(200)
    .clearCookie("accessToken", option)
    .clearCookie("refreshToken", option)
    .json(new ApiResposne(200, {}, "User Logout Successfully"));
});

const refreshToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookie?.refreshToken || req.body?.refreshToken;

  try {
    if (!incomingRefreshToken) {
      return new ApiError(401, "Unauthorized Access.");
    }

    let payload = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    if (!payload) {
      return new ApiError(401, "Invalid RefershToken Given");
    }

    let user = await User.findById(payload._id);

    if (!user) {
      return new ApiError(401, "Invalid RefreshToken");
    }

    // Check for same refreshToken
    if (incomingRefreshToken !== user.refreshToken) {
      return new ApiError(401, "Invalid Refresh Token");
    }

    // Generate Accesstoken and RefreshToken if invalid
    let { accessToken, refreshToken } =
      await generateAccessTokenAndRefreshToken(user._id);

    const option = {
      secure: true,
      httpOnly: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, option)
      .cookie("refreshToken", refreshToken, option)
      .json(
        new ApiResposne(
          200,
          { refreshToken, accessToken },
          "RefreshToken Change AccessToken Successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, "Invalid AccessToken");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword) {
    throw new ApiError(400, "OldPassword is Required.");
  }

  if (!newPassword) {
    throw new ApiError(400, "NewPassword is Required.");
  }

  let user = await User.findById(req.user?._id);

  let isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Old Password is Incorrect");
  }

  // Adding New Password
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  // Checking Password Updated or not -- test case
  let updatedPasswordUser = await User.findById(user._id);
  let fleg = await updatedPasswordUser.isPasswordCorrect(newPassword);
  if (!fleg) {
    throw new ApiError(400, "Password Not changed.");
  }

  return res
    .status(200)
    .json(new ApiResposne(200, {}, "Password Changed Successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "User Not Found");
  }

  return res
    .status(200)
    .json(
      new ApiResposne(200, { user: req.user }, "User Data get Successfully")
    );
});

const updateUser = asyncHandler(async (req, res) => {
  let body = req.body;

  let avatarLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.avatar) &&
    req.files.avatar.length > 0
  ) {
    avatarLocalPath = req.files.avatar[0].path;
    if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar file is Required.");
    }

    // Upload to cloudinary
    let avatar;
    if (avatarLocalPath) {
      avatar = await uploadOnCloudinary(avatarLocalPath);
    }

    // Changed URL
    body.avatar = avatar.url;
  }

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
    let coverImage;
    if (coverImageLocalPath) {
      coverImage = await uploadOnCloudinary(coverImageLocalPath);
    }

    // Changed URL
    body.coverImage = coverImage.url;
  }

  await User.findByIdAndUpdate(req.user?._id, {
    ...body,
  });

  return res
    .status(200)
    .json(new ApiResposne(200, {}, "User Data updated Successfully"));
});
module.exports = {
  registerUser,
  loginUser,
  loggoutUser,
  refreshToken,
  changeCurrentPassword,
  getCurrentUser,
  updateUser,
};
