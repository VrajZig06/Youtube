require("dotenv").config();
const { asyncHandler } = require("../utils/asyncHandler");
const { ApiError } = require("../utils/ApiError");
const { ApiResposne } = require("../utils/ApiResponse");
const { uploadOnCloudinary } = require("../utils/cloudinary");
const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const UserSearch = require("../models/userSearch.model");
const Subscription = require("../models/subscription.model");
const Video = require("../models/video.model");
const WatchHistory = require("../models/watchHistory.model");

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
  // Extract user input from the request
  const { username, email, fullname, password } = req.body;

  // Ensure all required fields are provided
  if (
    [username, email, fullname, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(404, "All Fields are required");
  }

  // Prevent duplicate registration using username or email
  const existingUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existingUser) {
    throw new ApiError(409, "User Already Exists.");
  }

  // Capture avatar file if uploaded
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

  // Capture cover image file if uploaded
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  // Upload avatar to Cloudinary
  let avatar;
  if (avatarLocalPath) {
    avatar = await uploadOnCloudinary(avatarLocalPath);
  }

  // Upload cover image to Cloudinary if available
  let coverImage;
  if (coverImageLocalPath) {
    coverImage = await uploadOnCloudinary(coverImageLocalPath);
  }

  if (!avatar?.url) {
    throw new ApiError(400, "Avatar is required");
  }

  // Save the new user to the database
  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  // Fetch the user without sensitive fields for response
  const userCreated = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!userCreated) {
    throw new ApiError(500, "User not Created during Registration");
  }

  // Send success response
  return res
    .status(201)
    .json(new ApiResposne(201, userCreated, "User Registered Successfully!"));
});

const loginUser = asyncHandler(async (req, res) => {
  // Ensure request body is provided
  if (!req.body) {
    throw new ApiError(400, "Data Required");
  }

  const { username, email, password } = req.body;

  // Check if credentials are missing
  if (email === "" && password === "") {
    throw new ApiError(400, "Please Enter all field.");
  }

  // Look up user by username or email
  let user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User Not Found.");
  }

  // Verify password correctness
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(404, "Invalid Password.");
  }

  // Generate JWT access and refresh tokens
  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefreshToken(user._id);

  // Retrieve user details excluding sensitive fields
  let loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // Set cookie options for secure token storage
  const option = {
    secure: true,
    httpOnly: true,
  };

  // Send token and user details in response
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
  // Remove refresh token from user record in database
  await User.findByIdAndUpdate(req.user?._id, {
    $set: {
      refreshToken: undefined,
    },
  });

  // Cookie options for secure clearing
  const option = {
    secure: true,
    httpOnly: true,
  };

  // Clear access and refresh tokens from cookies and respond
  res
    .status(200)
    .clearCookie("accessToken", option)
    .clearCookie("refreshToken", option)
    .json(new ApiResposne(200, {}, "User Logout Successfully"));
});

const refreshToken = asyncHandler(async (req, res) => {
  // Extract refresh token from cookie or body
  const incomingRefreshToken =
    req.cookie?.refreshToken || req.body?.refreshToken;

  try {
    // Reject request if no token is provided
    if (!incomingRefreshToken) {
      return new ApiError(401, "Unauthorized Access.");
    }

    // Verify refresh token using JWT
    let payload = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    // Reject if token is invalid
    if (!payload) {
      return new ApiError(401, "Invalid RefreshToken Given");
    }

    // Find user associated with the token
    let user = await User.findById(payload._id);

    if (!user) {
      return new ApiError(401, "Invalid RefreshToken");
    }

    // Ensure refresh token matches what's stored in DB
    if (incomingRefreshToken !== user.refreshToken) {
      return new ApiError(401, "Invalid Refresh Token");
    }

    // Generate new tokens for user
    let { accessToken, refreshToken } =
      await generateAccessTokenAndRefreshToken(user._id);

    // Cookie options for secure delivery
    const option = {
      secure: true,
      httpOnly: true,
    };

    // Send new tokens as cookies and in response
    return res
      .status(200)
      .cookie("accessToken", accessToken, option)
      .cookie("refreshToken", refreshToken, option)
      .json(
        new ApiResposne(
          200,
          { refreshToken, accessToken },
          "RefreshToken updated and AccessToken regenerated successfully"
        )
      );
  } catch (error) {
    // Handle JWT or logic errors
    throw new ApiError(401, "Invalid AccessToken");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  // Ensure old password is provided
  if (!oldPassword) {
    throw new ApiError(400, "OldPassword is Required.");
  }

  // Ensure new password is provided
  if (!newPassword) {
    throw new ApiError(400, "NewPassword is Required.");
  }

  // Fetch current user by ID
  let user = await User.findById(req.user?._id);

  // Validate old password
  let isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Old Password is Incorrect");
  }

  // Update user password
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  // Verify password was updated successfully
  let updatedPasswordUser = await User.findById(user._id);
  let fleg = await updatedPasswordUser.isPasswordCorrect(newPassword);
  if (!fleg) {
    throw new ApiError(400, "Password Not changed.");
  }

  // Respond with success
  return res
    .status(200)
    .json(new ApiResposne(200, {}, "Password Changed Successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  // Ensure the authenticated user is present in the request
  if (!req.user) {
    throw new ApiError(401, "User Not Found");
  }

  // Return user data if found
  return res
    .status(200)
    .json(
      new ApiResposne(200, { user: req.user }, "User Data fetched successfully")
    );
});

const updateUser = asyncHandler(async (req, res) => {
  let body = req.body;

  // Check if avatar file is provided and extract its path
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

    // Upload avatar to Cloudinary
    let avatar;
    if (avatarLocalPath) {
      avatar = await uploadOnCloudinary(avatarLocalPath);
    }

    // Set avatar URL in update body
    body.avatar = avatar.url;
  }

  // Check if cover image file is provided and extract its path
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;

    // Upload cover image to Cloudinary
    let coverImage;
    if (coverImageLocalPath) {
      coverImage = await uploadOnCloudinary(coverImageLocalPath);
    }

    // Set cover image URL in update body
    body.coverImage = coverImage.url;
  }

  // Update user details in the database
  await User.findByIdAndUpdate(req.user?._id, {
    ...body,
  });

  // Return success response
  return res
    .status(200)
    .json(new ApiResposne(200, {}, "User Data updated Successfully"));
});

const getChannelDetails = asyncHandler(async (req, res) => {
  const { username } = req.query;

  if (!username?.trim()) {
    throw new ApiError(400, "Username is Required.");
  }
  let user = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "Subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions", // fixed spelling
        localField: "_id",
        foreignField: "subscriber",
        as: "SubscribedTo",
      },
    },
    {
      $addFields: {
        subscriberCount: { $size: "$Subscribers" },
        subscribedTo: { $size: "$SubscribedTo" },
        isSubscribed: {
          $cond: {
            if: {
              $in: [
                req.user?._id,
                {
                  $map: {
                    input: "$Subscribers",
                    as: "s",
                    in: "$$s.subscriber",
                  },
                },
              ],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        username: 1,
        fullname: 1,
        avatar: 1,
        coverImage: 1,
        subscriberCount: 1,
        subscribedTo: 1,
        isSubscribed: 1,
      },
    },
  ]);

  /*

  ---- Some bug in this ---

  let user = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "Subscribers",
      },
      $lookup: {
        from: "subsriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "SubscribedTo",
      },
      $addFields: {
        subscriberCount: {
          $size: "$Subscribers",
        },
        $sunscribedTo: {
          $size: "$SubscribedTo",
        },
        $isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$Subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
      $project: {
          username: 1,
          fullname: 1,
          avatar: 1,
          coverImage: 1,
          subscriberCount: 1,
          sunscribedTo: 1,
          isSubscribed: 1,
        },
      },
    ]);
  */

  return res
    .status(200)
    .json(new ApiResposne(200, { user }, "User Profiel get Successfully"));
});

const searchVideo = asyncHandler(async (req, res) => {
  const { search } = req.query;

  // 1. Check if search term is provided
  if (!search?.trim()) {
    throw new ApiError(400, "Search term is required");
  }

  const searchTerm = search.toLowerCase().trim();
  const condition = { $regex: searchTerm, $options: "i" };

  // 2. Find matching videos
  const searchedVideos = await Video.find({
    $or: [{ title: condition }, { description: condition }],
  });

  // 3. Track user search if result is found
  if (searchedVideos.length > 0) {
    const existingSearch = await UserSearch.findOne({
      searchItem: searchTerm,
      user: req.user._id,
    });

    if (existingSearch) {
      existingSearch.searchCount += 1;
      await existingSearch.save({ validateBeforeSave: false });
    } else {
      await UserSearch.create({
        searchItem: searchTerm,
        user: req.user._id,
      });
    }
  }

  // 4. Return the results
  return res
    .status(200)
    .json(
      new ApiResposne(
        200,
        { searchedVideos },
        searchedVideos.length > 0
          ? "Search Result Found Successfully"
          : "No matching videos found"
      )
    );
});

const recommandationSearch = asyncHandler(async (req, res) => {
  let userId = req.user._id;
  let AllRecommandationVideo;

  let allSearchesByUser = await UserSearch.find({
    user: String(userId),
  })
    .select("-user -_id -__v")
    .sort({ searchCount: -1 });

  if (allSearchesByUser.length >= 3) {
    const regexFilters = allSearchesByUser.flatMap((term) => [
      { title: { $regex: term.searchItem, $options: "i" } },
      { description: { $regex: term.searchItem, $options: "i" } },
    ]);

    AllRecommandationVideo = await Video.find({ $or: regexFilters });
  } else {
    AllRecommandationVideo = await Video.find();
  }

  return res
    .status(200)
    .json(
      new ApiResposne(
        200,
        { AllRecommandationVideo },
        "Search Result Found Successfully"
      )
    );
});

const userSubscribetoOtherChannel = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (channelId == req.user._id) {
    throw new ApiError(400, "You can not Subscribe to Your Channel");
  }

  let isAlreadySubscribe = await Subscription.findOne({
    subscriber: req.user._id,
    channel: channelId,
  });

  if (isAlreadySubscribe) {
    throw new ApiError(400, "You Already Subscribe this Channel");
  }

  await Subscription.create({
    subscriber: req.user._id,
    channel: channelId,
  });

  return res
    .status(200)
    .json(new ApiResposne(200, {}, "Subscibe to Channel Successfully"));
});

const getWatchHistory = asyncHandler(async (req, res) => {
  let watchHistory = await WatchHistory.find({ user: req.user._id })
    .populate("video", "-updatedAt -__v")
    .sort({
      createdAt: -1,
    })
    .select("-updatedAt -__v -user -_id -createdAt");

  return res
    .status(200)
    .json(
      new ApiResposne(
        200,
        watchHistory,
        "User's Watch History fetched Successfully"
      )
    );
});

module.exports = {
  registerUser,
  loginUser,
  loggoutUser,
  refreshToken,
  changeCurrentPassword,
  getCurrentUser,
  updateUser,
  getChannelDetails,
  searchVideo,
  recommandationSearch,
  userSubscribetoOtherChannel,
  getWatchHistory,
};
