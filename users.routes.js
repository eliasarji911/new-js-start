const express = require("express");
const db = require("./db.config.js");
const bcrypt = require("bcrypt");
const multer = require("multer");
const router = express.Router();



const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); 
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const userId = req.params.id; 
    cb(null, `user-${userId}-${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });



router.post("/register", async (req, res) => {
    const { user_name, pass, emIL, name } = req.body || {};

    if (!user_name || !pass || !emIL || !name) {
        return res.status(400).send("user_name, pass, emIL and name are required");
    }

    try {
        
        const hashedPassword = await bcrypt.hash(pass, 10);

        const sql = `
            INSERT INTO users (user_name, pass, emIL, name)
            VALUES (?, ?, ?, ?)
        `;

        db.query(sql, [user_name, hashedPassword, emIL, name], (err, result) => {
            if (err) {
                console.error("DB INSERT error:", err);
                return res.status(500).send(err.sqlMessage || "Database error");
            }

            res.status(201).json({
                id: result.insertId,
                user_name,
                name,
                emIL
            });
        });
    } catch (err) {
        console.error("Register error:", err);
        res.status(500).send("Server error");
    }
});


router.post("/login", (req, res) => {
    const { user_name, pass } = req.body || {};

    if (!user_name || !pass) {
        return res.status(400).send({ message: "Missing username or password" });
    }

    const sql = "SELECT * FROM users WHERE user_name = ?";

    db.query(sql, [user_name], async (err, rows) => {
        if (err) return res.status(500).send({ message: "Database error" });

        if (rows.length === 0) {
            return res.status(401).send({ message: "Invalid username or password" });
        }

        const user = rows[0];

       
        const match = await bcrypt.compare(pass, user.pass);

        if (!match) {
            return res.status(401).send({ message: "Invalid username or password" });
        }

        res.send({
            message: "Login successful",
            id: user.id,
            user_name: user.user_name
        });
    });
});


router.put("/update", (req, res) => {
    const {
        current_user_name,
        current_pass,
        new_user_name,
        new_pass
    } = req.body || {};

    if (!current_user_name || !current_pass || !new_user_name || !new_pass) {
        return res.status(400).send("All fields are required for update");
    }

    const sqlSelect = "SELECT * FROM users WHERE user_name = ?";

    db.query(sqlSelect, [current_user_name], async (err, rows) => {
        if (err) return res.status(500).send("Database error");

        if (rows.length === 0)
            return res.status(401).send("Current username or password is incorrect");

        const user = rows[0];

        
        const match = await bcrypt.compare(current_pass, user.pass);
        if (!match) {
            return res.status(401).send("Current username or password is incorrect");
        }

        
        const hashedNewPassword = await bcrypt.hash(new_pass, 10);

        const sqlUpdate = "UPDATE users SET user_name = ?, pass = ? WHERE id = ?";

        db.query(sqlUpdate, [new_user_name, hashedNewPassword, user.id], (err2) => {
            if (err2) return res.status(500).send("Database error");
            res.send("User updated successfully");
        });
    });
});

module.exports = router;







