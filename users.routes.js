
const express = require("express");
const db = require("./db.config.js");

const router = express.Router();


router.get("/test", (req, res) => {
    res.send("Users router is working");
});


router.get("/debug-all", (req, res) => {
    db.query("SELECT * FROM users", (err, rows) => {
        if (err) {
            console.error("debug-all error:", err);
           // return res.status(500).send(err.message);
        }
        res.json(rows);
    });
});


router.post("/register", (req, res) => {
    console.log("BODY from client:", req.body);

    const { user_name, pass, emIL, name } = req.body || {};

 
    if (!user_name || !pass || !emIL || !name) {
        return res.status(400).send("user_name, pass, emIL and name are required");
    }

    const sql = `
        INSERT INTO users (user_name, pass, emIL, name)
        VALUES (?, ?, ?, ?)
    `;

    const params = [user_name, pass, emIL, name];

    console.log("Running SQL:", sql.trim(), "with params:", params);

    db.query(sql, params, (err, result) => {
        if (err) {
            console.error("DB INSERT error:", err);
          //  return res.status(500).send(err.sqlMessage || "Database error");
        }

        res.status(201).json({
            id: result.insertId,
            user_name,
            name,
            emIL
        });
    });
});


router.delete("/:id", (req, res) => {
    const id = req.params.id;

    const sql = "DELETE FROM users WHERE id = ?";
    
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error("DELETE error:", err);
         //   return res.status(500).send(err.message);
        }

        if (result.affectedRows === 0) {
         //   return res.status(404).send("User not found");
        }

        res.send("User deleted successfully");
    });
});

module.exports = router;





