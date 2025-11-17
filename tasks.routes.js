
const express = require("express");
const db = require("./db.config.js"); 

const router = express.Router();



async function getAllTasks() {
    return new Promise((resolve, reject) => {
        const sql = "SELECT * FROM task";   
        db.query(sql, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}


router.get("/", async (req, res) => {
    try {
        const tasks = await getAllTasks();
        res.json(tasks);
    } catch (err) {
        console.error("Error in GET /tasks:", err);
        res.status(500).send("Database error");
    }
});

// later we can add here:
// router.get("/:id", ...)
// router.post("/", ...)
// router.put("/:id", ...)
// router.delete("/:id", ...)

module.exports = router;
