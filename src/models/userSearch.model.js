const mongoose = require("mongoose");

const userSearchSchema = new mongoose.Schema({
  searchItem: {
    type: String,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  searchCount: {
    type: Number,
    default: 1,
  },
});

const UserSearch = mongoose.model("search", userSearchSchema);
module.exports = UserSearch;
