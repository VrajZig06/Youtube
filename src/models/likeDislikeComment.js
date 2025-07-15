const mongoose = require("mongoose");

const likeUnlikeVideoSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  video: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "video",
  },
  activity: {
    type: String,
    enum: ["Like", "DisLike", "Comment"],
  },
  content: {
    type: String,
    default: null,
  },
});

const LikeDislike = mongoose.model("likedislike", likeUnlikeVideoSchema);
module.exports = LikeDislike;
