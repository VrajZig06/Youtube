require("dotenv").config();
const { DBConnect } = require("./db/index");
const app = require("./app");

DBConnect()
  .then(() => {
    app.listen(process.env.PORT, () => {
      console.log(`Server Start at http://localhost:${process.env.PORT}`);
    });

    app.on("error", (error) => {
      console.log("Error : ", error);
    });
  })
  .catch((error) => {
    console.log("Error : MongoDb Connection Error", error);
  });

/*

































---> Another way to Connect Database

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_DB_URL).then(() => {
      console.log("Database Connected Successfully!");
      const app = express();
      app.listen(process.env.PORT, () => {
        console.log(`Server Start at http://localhost:${process.env.PORT}`);
      });
    });
  } catch (error) {
    console.error("MongoDB Connection Error ", error);
    process.exit(1);
  }
})();

*/
