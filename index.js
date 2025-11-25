require("dotenv").config();
const path = require("path");
console.log("index.js started");

if (!process.env.DB_HOST) {
    console.warn("⚠ DB_HOST is not defined in .env");
}

const express = require("express");
const db = require("./db.config.js");
const usersRouter = require("./users.routes.js");
const tasksRouter = require("./tasks.routes.js");

const app = express();

app.use("/uploads",express.static(path.join(__dirname,"uploads")));
app.use(express.json());
app.use(express.static("public"));  

app.use("/users", usersRouter);
app.use("/tasks", tasksRouter);

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






