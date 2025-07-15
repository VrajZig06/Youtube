const Video = require("../models/video.model");
const { ApiError } = require("../utils/ApiError");
const { ApiResposne } = require("../utils/ApiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const { uploadOnCloudinary } = require("../utils/cloudinary");

const videoUpload = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  const { videoFile, thumbnail } = req.files || {};

  // Input Validation
  if (!title) throw new ApiError(400, "Video title is required");
  if (!description) throw new ApiError(400, "Video description is required");
  if (!videoFile || !videoFile[0])
    throw new ApiError(400, "Video file is required");
  if (!thumbnail || !thumbnail[0])
    throw new ApiError(400, "Thumbnail is required");

  const videoPath = videoFile[0].path;
  const thumbnailPath = thumbnail[0].path;

  // Upload Thumbnail
  const uploadedThumbnail = await uploadOnCloudinary(thumbnailPath);
  if (!uploadedThumbnail || !uploadedThumbnail.url) {
    throw new ApiError(500, "Failed to upload thumbnail to Cloudinary");
  }

  //   Upload Video File
  const uploadedVideo = await uploadOnCloudinary(videoPath);
  if (!uploadedVideo || !uploadedVideo.url) {
    throw new ApiError(500, "Failed to upload video file to Cloudinary");
  }

  //   Prepare Video Data
  const videoData = {
    title,
    description,
    thumbnail: uploadedThumbnail.url,
    videoFile: uploadedVideo.url,
    duration: uploadedVideo.duration || null,
    owner: req.user?._id,
  };

  //   Save to Database
  const videoDetails = await Video.create(videoData);

  //   Return Response
  return res
    .status(200)
    .json(
      new ApiResposne(201, { videoDetails }, "Video uploaded Successfully!")
    );
});

const getUsersUploadedVideo = asyncHandler(async (req, res) => {
  let allVideos = await Video.find({ owner: req.user._id });
  return res
    .status(200)
    .json(
      new ApiResposne(
        200,
        { allVideos },
        "User's Uploaded Vidoe Get Successfully"
      )
    );
});

const allVideos = asyncHandler(async (req, res) => {
  let allVideos = await Video.find().sort({ createdAt: 1 });
  return res
    .status(200)
    .json(new ApiResposne(200, allVideos, "All Videos Find Successfully"));
});

const getSingleVideo = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let video = await Video.findByIdAndUpdate(
    id,
    { $inc: { views: 1 } },
    { new: true }
  ).populate(
    "owner",
    "-watchHistory -password -createdAt -updatedAt -__v -refreshToken -coverImage"
  );
  return res
    .status(200)
    .json(new ApiResposne(200, video, "Video Find Successfully"));
});
module.exports = {
  videoUpload,
  getUsersUploadedVideo,
  allVideos,
  getSingleVideo,
};
