const mysql = require("mysql");

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,

  connectionLimit: 10,
  connectTimeout: 8000,   // ✅ prevents hanging forever
});

db.getConnection((err, conn) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    return;
  }
  console.log("MySQL connected (pool)!");
  conn.release();
});

module.exports = db;

