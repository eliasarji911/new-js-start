const express = require("express");
const db = require("./db.config.js");

const router = express.Router();

// Helper: insert friendship pair ordered (small id first)
function orderedPair(a, b) {
  const u1 = Number(a);
  const u2 = Number(b);
  return u1 < u2 ? { user1_id: u1, user2_id: u2 } : { user1_id: u2, user2_id: u1 };
}

function checkFriends(userA, userB, cb) {
  const { user1_id, user2_id } = orderedPair(userA, userB);
  const sql = "SELECT 1 AS ok FROM friends WHERE user1_id=? AND user2_id=? LIMIT 1";
  db.query(sql, [user1_id, user2_id], (err, rows) => {
    if (err) return cb(err);
    cb(null, rows.length > 0);
  });
}

// Search user by username (exact match)
// GET /friends/search?user_name=...
router.get("/search", (req, res) => {
  const user_name = (req.query.user_name || "").trim();
  if (!user_name) return res.status(400).json({ message: "user_name is required" });

  const sql = "SELECT id, user_name, name, profile_photo FROM users WHERE user_name = ? LIMIT 1";
  db.query(sql, [user_name], (err, rows) => {
    if (err) {
      console.error("GET /friends/search error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (!rows.length) return res.status(404).json({ message: "User not found" });
    res.json(rows[0]);
  });
});

// Send friend request
// POST /friends/request  { from_user_id, to_user_id }
router.post("/request", (req, res) => {
  const { from_user_id, to_user_id } = req.body || {};
  if (!from_user_id || !to_user_id) {
    return res.status(400).json({ message: "from_user_id and to_user_id are required" });
  }
  if (Number(from_user_id) === Number(to_user_id)) {
    return res.status(400).json({ message: "You cannot add yourself" });
  }

  // 1) Already friends?
  checkFriends(from_user_id, to_user_id, (err, areFriends) => {
    if (err) {
      console.error("POST /friends/request checkFriends error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (areFriends) return res.status(409).json({ message: "Already friends" });

    // 2) Any existing request in either direction?
    const sqlExisting = `
      SELECT id, status, from_user_id, to_user_id
      FROM friend_requests
      WHERE (from_user_id=? AND to_user_id=?) OR (from_user_id=? AND to_user_id=?)
      ORDER BY id DESC
      LIMIT 1
    `;
    db.query(
      sqlExisting,
      [from_user_id, to_user_id, to_user_id, from_user_id],
      (err2, rows) => {
        if (err2) {
          console.error("POST /friends/request existing error:", err2);
          return res.status(500).json({ message: "Database error" });
        }

        if (rows.length) {
          const r = rows[0];
          if (r.status === "pending") {
            return res.status(409).json({ message: "A pending request already exists" });
          }
          if (r.status === "accepted") {
            return res.status(409).json({ message: "Already friends" });
          }
        }

        // Insert or update (because UNIQUE (from,to))
        const sqlUpsert = `
          INSERT INTO friend_requests (from_user_id, to_user_id, status)
          VALUES (?, ?, 'pending')
          ON DUPLICATE KEY UPDATE
            status='pending',
            created_at=CURRENT_TIMESTAMP,
            responded_at=NULL
        `;
        db.query(sqlUpsert, [from_user_id, to_user_id], (err3) => {
          if (err3) {
            console.error("POST /friends/request insert error:", err3);
            return res.status(500).json({ message: "Database error" });
          }
          res.status(201).json({ message: "Request sent" });
        });
      }
    );
  });
});

// Incoming requests
// GET /friends/requests/incoming/:user_id
router.get("/requests/incoming/:user_id", (req, res) => {
  const user_id = req.params.user_id;
  const sql = `
    SELECT
      fr.id,
      fr.from_user_id,
      fr.to_user_id,
      fr.status,
      fr.created_at,
      u.user_name,
      u.name,
      u.profile_photo
    FROM friend_requests fr
    JOIN users u ON u.id = fr.from_user_id
    WHERE fr.to_user_id = ? AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
  `;
  db.query(sql, [user_id], (err, rows) => {
    if (err) {
      console.error("GET /friends/requests/incoming error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json(rows);
  });
});

// Outgoing requests
// GET /friends/requests/outgoing/:user_id
router.get("/requests/outgoing/:user_id", (req, res) => {
  const user_id = req.params.user_id;
  const sql = `
    SELECT
      fr.id,
      fr.from_user_id,
      fr.to_user_id,
      fr.status,
      fr.created_at,
      u.user_name,
      u.name,
      u.profile_photo
    FROM friend_requests fr
    JOIN users u ON u.id = fr.to_user_id
    WHERE fr.from_user_id = ? AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
  `;
  db.query(sql, [user_id], (err, rows) => {
    if (err) {
      console.error("GET /friends/requests/outgoing error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json(rows);
  });
});

// Accept request
// POST /friends/requests/:request_id/accept  { user_id }
router.post("/requests/:request_id/accept", (req, res) => {
  const request_id = req.params.request_id;
  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ message: "user_id is required" });

  const sqlGet = "SELECT * FROM friend_requests WHERE id = ? LIMIT 1";
  db.query(sqlGet, [request_id], (err, rows) => {
    if (err) {
      console.error("accept get request error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (!rows.length) return res.status(404).json({ message: "Request not found" });

    const reqRow = rows[0];
    if (reqRow.status !== "pending") {
      return res.status(409).json({ message: "Request is not pending" });
    }
    if (Number(reqRow.to_user_id) !== Number(user_id)) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const sqlUpdate = "UPDATE friend_requests SET status='accepted', responded_at=NOW() WHERE id=?";
    db.query(sqlUpdate, [request_id], (err2) => {
      if (err2) {
        console.error("accept update request error:", err2);
        return res.status(500).json({ message: "Database error" });
      }

      const { user1_id, user2_id } = orderedPair(reqRow.from_user_id, reqRow.to_user_id);
      const sqlFriend = "INSERT IGNORE INTO friends (user1_id, user2_id) VALUES (?, ?)";
      db.query(sqlFriend, [user1_id, user2_id], (err3) => {
        if (err3) {
          console.error("accept insert friends error:", err3);
          return res.status(500).json({ message: "Database error" });
        }
        return res.json({ message: "Friend request accepted" });
      });
    });
  });
});

// Reject request
// POST /friends/requests/:request_id/reject  { user_id }
router.post("/requests/:request_id/reject", (req, res) => {
  const request_id = req.params.request_id;
  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ message: "user_id is required" });

  const sqlGet = "SELECT * FROM friend_requests WHERE id = ? LIMIT 1";
  db.query(sqlGet, [request_id], (err, rows) => {
    if (err) {
      console.error("reject get request error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (!rows.length) return res.status(404).json({ message: "Request not found" });
    const reqRow = rows[0];
    if (reqRow.status !== "pending") return res.status(409).json({ message: "Request is not pending" });
    if (Number(reqRow.to_user_id) !== Number(user_id)) return res.status(403).json({ message: "Not allowed" });

    const sqlUpdate = "UPDATE friend_requests SET status='rejected', responded_at=NOW() WHERE id=?";
    db.query(sqlUpdate, [request_id], (err2) => {
      if (err2) {
        console.error("reject update error:", err2);
        return res.status(500).json({ message: "Database error" });
      }
      res.json({ message: "Friend request rejected" });
    });
  });
});

// Cancel outgoing request
// POST /friends/requests/:request_id/cancel  { user_id }
router.post("/requests/:request_id/cancel", (req, res) => {
  const request_id = req.params.request_id;
  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ message: "user_id is required" });

  const sqlGet = "SELECT * FROM friend_requests WHERE id = ? LIMIT 1";
  db.query(sqlGet, [request_id], (err, rows) => {
    if (err) {
      console.error("cancel get request error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (!rows.length) return res.status(404).json({ message: "Request not found" });
    const reqRow = rows[0];
    if (reqRow.status !== "pending") return res.status(409).json({ message: "Request is not pending" });
    if (Number(reqRow.from_user_id) !== Number(user_id)) return res.status(403).json({ message: "Not allowed" });

    const sqlUpdate = "UPDATE friend_requests SET status='canceled', responded_at=NOW() WHERE id=?";
    db.query(sqlUpdate, [request_id], (err2) => {
      if (err2) {
        console.error("cancel update error:", err2);
        return res.status(500).json({ message: "Database error" });
      }
      res.json({ message: "Friend request canceled" });
    });
  });
});

// List friends
// GET /friends/list/:user_id
router.get("/list/:user_id", (req, res) => {
  const user_id = req.params.user_id;
  const sql = `
    SELECT
      u.id,
      u.user_name,
      u.name,
      u.profile_photo,
      f.created_at AS friends_since
    FROM friends f
    JOIN users u
      ON u.id = IF(f.user1_id = ?, f.user2_id, f.user1_id)
    WHERE f.user1_id = ? OR f.user2_id = ?
    ORDER BY u.user_name ASC
  `;
  db.query(sql, [user_id, user_id, user_id], (err, rows) => {
    if (err) {
      console.error("GET /friends/list error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json(rows);
  });
});

// Optional: remove friend
// DELETE /friends/:user_id/:friend_id
router.delete("/:user_id/:friend_id", (req, res) => {
  const { user_id, friend_id } = req.params;
  const { user1_id, user2_id } = orderedPair(user_id, friend_id);
  const sql = "DELETE FROM friends WHERE user1_id=? AND user2_id=?";
  db.query(sql, [user1_id, user2_id], (err, result) => {
    if (err) {
      console.error("DELETE /friends error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (result.affectedRows === 0) return res.status(404).json({ message: "Friendship not found" });
    res.json({ message: "Friend removed" });
  });
});

module.exports = router;
