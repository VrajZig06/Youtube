const { Router } = require("express");
const { upload } = require("../middlewares/multer.middleware");
const { jwtVerify } = require("../middlewares/auth.middleware");
const {
  videoUpload,
  getUsersUploadedVideo,
  allVideos,
  getSingleVideo,
} = require("../controllers/video.controller");

const router = Router();

router.route("/upload").post(
  jwtVerify,
  upload.fields([
    {
      name: "videoFile",
      maxCount: 1,
    },
    {
      name: "thumbnail",
      maxCount: 1,
    },
  ]),
  videoUpload
);

router.route("/getUploadedVideos").get(jwtVerify, getUsersUploadedVideo);
router.route("/allVideos").get(jwtVerify, allVideos);
router.route("/content/:id").get(jwtVerify, getSingleVideo);

module.exports = router;
