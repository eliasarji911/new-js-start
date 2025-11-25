const express = require("express");
const db = require("./db.config.js");

const router = express.Router();


router.get("/", (req, res) => {
    const sql = "SELECT * FROM task";
    db.query(sql, (err, rows) => {
        if (err) {
            console.error("GET /tasks error:", err);
            return res.status(500).send("Database error");
        }
        res.json(rows);
    });
});


router.get("/user/:user_id", (req, res) => {
    const user_id = req.params.user_id;

    const sql = "SELECT * FROM task WHERE user_id = ?";
    db.query(sql, [user_id], (err, rows) => {
        if (err) {
            console.error("GET /tasks/user/:user_id error:", err);
            return res.status(500).send("Database error");
        }
        res.json(rows);
    });
});



router.post("/", (req, res) => {
    console.log("BODY from client (new task):", req.body);

    const { text, user_id, category_id } = req.body;

    if (!text || !user_id) {
        return res.status(400).send("text and user_id are required");
    }

    const sql = `
        INSERT INTO task (text, user_id, category_id, is_done)
        VALUES (?, ?, ?, 0)
    `;

    db.query(sql, [text, user_id, category_id || null], (err, result) => {
        if (err) {
            console.error("POST /tasks error:", err);
            return res.status(500).send("Database error");
        }

        res.status(201).json({
            id: result.insertId,
            text,
            user_id,
            category_id: category_id || null,
            is_done: 0
        });
    });
});



router.put("/:id", (req, res) => {
    const id = req.params.id;
    const { text, is_done } = req.body;

    const sql = `
        UPDATE task
        SET text = ?, is_done = ?
        WHERE id = ?
    `;

    db.query(sql, [text, is_done, id], (err, result) => {
        if (err) {
            console.error("PUT /tasks/:id error:", err);
            return res.status(500).send("Database error");
        }

        if (result.affectedRows === 0) {
            return res.status(404).send("Task not found");
        }

        res.send("Task updated successfully");
    });
});



router.delete("/:id", (req, res) => {
    const id = req.params.id;

    const sql = "DELETE FROM task WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error("DELETE /tasks/:id error:", err);
            return res.status(500).send("Database error");
        }

        if (result.affectedRows === 0) {
            return res.status(404).send("Task not found");
        }

        res.send("Task deleted successfully");
    });
});


module.exports = router;

