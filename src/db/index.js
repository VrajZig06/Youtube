const mongoose = require("mongoose");
require("dotenv").config();
const { DB_NAME } = require("../constants");

const DBConnect = async () => {
  try {
    await mongoose
      .connect(`${process.env.MONGO_DB_URL}/${DB_NAME}}`)
      .then(() => {
        console.log("MongoDb Connected Successfully!");
      })
      .catch((error) => {
        console.error("MongoDB Error : ", error);
        process.exit(1);
      });
  } catch (error) {
    console.error("MongoDB Error", error);
    process.exit(1);
  }
};

module.exports = { DBConnect };
