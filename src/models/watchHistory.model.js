const mongoose = require("mongoose");

const watchHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    video: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "video",
    },
  },
  { timestamps: true }
);

const WatchHistory = mongoose.model("watchhistory", watchHistorySchema);

module.exports = WatchHistory;

