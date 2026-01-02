const express = require("express");
const db = require("./db.config.js");
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");

const router = express.Router();

// ---------- Profile photo upload ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const userId = req.params.id || "unknown";
    cb(null, `user-${userId}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

// ---------- Register ----------
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
        emIL,
      });
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).send("Server error");
  }
});

// ---------- Login ----------
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
      user_name: user.user_name,
    });
  });
});

// ---------- Update username & password ----------
router.put("/update", (req, res) => {
  const { current_user_name, current_pass, new_user_name, new_pass } = req.body || {};

  if (!current_user_name || !current_pass || !new_user_name || !new_pass) {
    return res.status(400).send("All fields are required for update");
  }

  const sqlSelect = "SELECT * FROM users WHERE user_name = ?";

  db.query(sqlSelect, [current_user_name], async (err, rows) => {
    if (err) return res.status(500).send("Database error");

    if (rows.length === 0) return res.status(401).send("Current username or password is incorrect");

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

// ---------- Get profile by id ----------
// GET /users/profile/123
router.get("/profile/:id", (req, res) => {
  const id = req.params.id;
  const sql = "SELECT id, user_name, name, emIL, profile_photo FROM users WHERE id = ? LIMIT 1";
  db.query(sql, [id], (err, rows) => {
    if (err) {
      console.error("GET /users/profile/:id error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (!rows.length) return res.status(404).json({ message: "User not found" });
    res.json(rows[0]);
  });
});

// ---------- Search by username (exact match) ----------
// GET /users/search?user_name=elia
router.get("/search", (req, res) => {
  const user_name = (req.query.user_name || "").trim();
  if (!user_name) return res.status(400).json({ message: "user_name is required" });

  const sql = "SELECT id, user_name, name, profile_photo FROM users WHERE user_name = ? LIMIT 1";
  db.query(sql, [user_name], (err, rows) => {
    if (err) {
      console.error("GET /users/search error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (!rows.length) return res.status(404).json({ message: "User not found" });
    res.json(rows[0]);
  });
});

// ---------- Upload profile photo ----------
// PUT /users/123/photo  (form-data: photo=<file>)
router.put("/:id/photo", upload.single("photo"), (req, res) => {
  const id = req.params.id;
  if (!req.file) return res.status(400).json({ message: "No file uploaded (field name should be 'photo')" });

  const photoPath = `/uploads/${req.file.filename}`;
  const sql = "UPDATE users SET profile_photo=? WHERE id=?";

  db.query(sql, [photoPath, id], (err, result) => {
    if (err) {
      console.error("PUT /users/:id/photo update error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (result.affectedRows === 0) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Profile photo updated", profile_photo: photoPath });
  });
});

module.exports = router;








