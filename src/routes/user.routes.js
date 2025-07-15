const { Router } = require("express");
const {
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
} = require("../controllers/user.controller");
const { upload } = require("../middlewares/multer.middleware");
const { jwtVerify } = require("../middlewares/auth.middleware");

const router = Router();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);
router.route("/login").post(loginUser);
router.route("/refreshToken").post(refreshToken);

// Secured Routes
router.route("/logout").post(jwtVerify, loggoutUser);
router.route("/changePassword").post(jwtVerify, changeCurrentPassword);
router.route("/profile").get(jwtVerify, getCurrentUser);
router.route("/update").patch(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  jwtVerify,
  updateUser
);
router.route("/channelDetails").get(jwtVerify, getChannelDetails);
router.route("/search").post(jwtVerify, searchVideo);
router.route("/watchHistory").get(jwtVerify, getWatchHistory);
router.route("/recommanded").get(jwtVerify, recommandationSearch);
router
  .route("/subscribe/:channelId")
  .post(jwtVerify, userSubscribetoOtherChannel);

module.exports = router;
