const LikeDislike = require("../models/likeDislikeComment");
const mongoose = require("mongoose");

const VideoStats = async (id) => {
  let videoStats = await LikeDislike.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(id),
      },
    },
    {
      $group: {
        _id: "$activity",
        count: { $sum: 1 },
      },
    },
  ]);

  let stats = {
    Like: 0,
    DisLike: 0,
    Comment: 0,
  };
  videoStats.forEach((item) => {
    stats[item._id] = item.count;
  });
  return stats;
};

module.exports = VideoStats;
