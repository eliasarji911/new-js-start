const express = require("express");
const db = require("./db.config.js");

const router = express.Router();

function orderedPair(a, b) {
  const u1 = Number(a);
  const u2 = Number(b);
  return u1 < u2 ? { user1_id: u1, user2_id: u2 } : { user1_id: u2, user2_id: u1 };
}

function ensureFriends(userA, userB, cb) {
  const { user1_id, user2_id } = orderedPair(userA, userB);
  const sql = "SELECT 1 AS ok FROM friends WHERE user1_id=? AND user2_id=? LIMIT 1";
  db.query(sql, [user1_id, user2_id], (err, rows) => {
    if (err) return cb(err);
    cb(null, rows.length > 0);
  });
}

// Get conversation between two friends
// GET /messages/conversation?user_id=1&friend_id=2&limit=50
router.get("/conversation", (req, res) => {
  const user_id = Number(req.query.user_id);
  const friend_id = Number(req.query.friend_id);
  const limit = Math.min(Number(req.query.limit || 50), 200);

  if (!user_id || !friend_id) {
    return res.status(400).json({ message: "user_id and friend_id are required" });
  }

  ensureFriends(user_id, friend_id, (err, ok) => {
    if (err) {
      console.error("GET /messages/conversation ensureFriends error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (!ok) return res.status(403).json({ message: "You can only chat with friends" });

    // Get latest N, then client can reverse if needed
    const sql = `
      SELECT id, sender_id, receiver_id, body, created_at, read_at
      FROM messages
      WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)
      ORDER BY created_at DESC
      LIMIT ?
    `;
    db.query(sql, [user_id, friend_id, friend_id, user_id, limit], (err2, rows) => {
      if (err2) {
        console.error("GET /messages/conversation error:", err2);
        return res.status(500).json({ message: "Database error" });
      }
      res.json(rows);
    });
  });
});

// Send message to a friend
// POST /messages  { sender_id, receiver_id, body }
router.post("/", (req, res) => {
  const { sender_id, receiver_id, body } = req.body || {};
  if (!sender_id || !receiver_id || !body) {
    return res.status(400).json({ message: "sender_id, receiver_id and body are required" });
  }
  const msg = String(body).trim();
  if (!msg) return res.status(400).json({ message: "Message body is empty" });
  if (msg.length > 2000) return res.status(400).json({ message: "Message too long" });

  ensureFriends(sender_id, receiver_id, (err, ok) => {
    if (err) {
      console.error("POST /messages ensureFriends error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (!ok) return res.status(403).json({ message: "You can only message friends" });

    const sql = "INSERT INTO messages (sender_id, receiver_id, body) VALUES (?, ?, ?)";
    db.query(sql, [sender_id, receiver_id, msg], (err2, result) => {
      if (err2) {
        console.error("POST /messages insert error:", err2);
        return res.status(500).json({ message: "Database error" });
      }
      res.status(201).json({ id: result.insertId, sender_id, receiver_id, body: msg });
    });
  });
});

// Mark messages as read (from friend -> user)
// POST /messages/read  { user_id, friend_id }
router.post("/read", (req, res) => {
  const { user_id, friend_id } = req.body || {};
  if (!user_id || !friend_id) return res.status(400).json({ message: "user_id and friend_id are required" });

  ensureFriends(user_id, friend_id, (err, ok) => {
    if (err) {
      console.error("POST /messages/read ensureFriends error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (!ok) return res.status(403).json({ message: "Not friends" });

    const sql = "UPDATE messages SET read_at = NOW() WHERE receiver_id=? AND sender_id=? AND read_at IS NULL";
    db.query(sql, [user_id, friend_id], (err2, result) => {
      if (err2) {
        console.error("POST /messages/read error:", err2);
        return res.status(500).json({ message: "Database error" });
      }
      res.json({ message: "Marked as read", updated: result.affectedRows });
    });
  });
});

module.exports = router;
