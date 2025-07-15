const Video = require("../models/video.model");
const WatchHistory = require("../models/watchHistory.model");
const LikeDislike = require("../models/likeDislikeComment");
const { ApiError } = require("../utils/ApiError");
const { ApiResposne } = require("../utils/ApiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const { uploadOnCloudinary } = require("../utils/cloudinary");
const VideoStats = require("../utils/videoState");

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

  if (req.body) {
    const body = req.body;
    const Activity = ["Like", "DisLike", "Comment"];

    if (body.activity && Activity.includes(body.activity)) {
      if (body.activity == "Comment" && body?.content) {
        await LikeDislike.create({
          user: req.user._id,
          video: id,
          activity: body.activity,
          content: body.content,
        });
      } else {
        let likeDislike = await LikeDislike.findOne({
          user: req.user._id,
          video: id,
        });

        if (likeDislike) {
          likeDislike.activity =
            likeDislike.activity == "Like" ? "DisLike" : "Like";
          await likeDislike.save();
        }

        if (!likeDislike && body.activity != "Comment") {
          await LikeDislike.create({
            user: req.user._id,
            video: id,
            activity: body.activity,
          });
        }
      }
    }
  }

  let video = await Video.findByIdAndUpdate(
    id,
    { $inc: { views: 1 } },
    { new: true }
  ).populate(
    "owner",
    " -password -createdAt -updatedAt -__v -refreshToken -coverImage"
  );

  await WatchHistory.create({
    user: req.user._id,
    video: video._id,
  });

  let VideoStatus = await VideoStats(id);

  // All Comments
  const allComments = await LikeDislike.find({
    video: id,
    activity: "Comment",
  })
    .populate("user", "username -_id")
    .select("-_id -video -acticity -__v -activity");

  return res
    .status(200)
    .json(
      new ApiResposne(
        200,
        { VideoDetails: video, VideoStatus, VideoComment: allComments },
        "Video Find Successfully"
      )
    );
});

module.exports = {
  videoUpload,
  getUsersUploadedVideo,
  allVideos,
  getSingleVideo,
};
