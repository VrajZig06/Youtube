const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

// Express app
const app = express();

// CORS Options
const corsOption = {
  origin: process.env.CORS_ORIGIN,
};

// Middlewares
app.use(cors(corsOption)); // allow user to accesss backend api
app.use(express.json()); // For Json Data recieving
app.use(express.urlencoded({ extended: true })); // use for encoding URL Data.
app.use(express.static("public")); // use to store static files to server
app.use(cookieParser()); // used to making CRUD operation to user's Browser for cookie

// Routes imports
const userRouter = require("./routes/user.routes.js");
const videoRouter = require("./routes/video.routes.js");

// Routes Declarations
app.use("/api/v1/users", userRouter);
app.use("/api/v1/video", videoRouter);

module.exports = app;
