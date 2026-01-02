const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const db = require("./db.config.js");

const usersRouter = require("./users.routes.js");
const tasksRouter = require("./tasks.routes.js");
const friendsRouter = require("./friends.routes.js");
const messagesRouter = require("./messages.routes.js");

const app = express();

// Ensure uploads folder exists (for profile photos)
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use("/uploads", express.static(uploadsDir));
app.use(express.json());
app.use(express.static("public"));

app.use("/users", usersRouter);
app.use("/tasks", tasksRouter);
app.use("/friends", friendsRouter);
app.use("/messages", messagesRouter);

app.get("/", (req, res) => {
  res.send("Server is working!");
});

app.get("/test-db", (req, res) => {
  db.query("SELECT 1 + 1 AS result", (err, rows) => {
    if (err) {
      console.error("Error in test-db route:", err);
      return res.status(500).send(err.message);
    }
    res.send("DB is working, 1+1 = " + rows[0].result);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});







