const bcrypt = require("bcryptjs");
const db = require("./db");

function ensureAdmin() {
  const count = db.prepare("SELECT COUNT(*) as n FROM admins").get().n;
  if (count > 0) return;

  const email = (process.env.ADMIN_EMAIL || "admin@lumiere.beauty").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const name = process.env.ADMIN_NAME || "Store Admin";

  const password_hash = bcrypt.hashSync(password, 10);
  db.prepare("INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)").run(
    name,
    email,
    password_hash
  );

  console.log(`Default admin created: ${email} (change ADMIN_PASSWORD in .env)`);
}

module.exports = { ensureAdmin };
