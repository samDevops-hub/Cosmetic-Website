const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();
const JWT_SECRET = () => process.env.JWT_SECRET || "dev-secret-change-me";

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, phone: user.phone },
    JWT_SECRET(),
    { expiresIn: "7d" }
  );
}

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone };
}

router.post("/register", (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
    return res.status(400).json({ error: "Name, email, and password (6+ chars) are required." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare("INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)")
    .run(name.trim(), normalizedEmail, phone?.trim() || null, password_hash);

  const user = db.prepare("SELECT id, name, email, phone FROM users WHERE id = ?").get(result.lastInsertRowid);
  const token = signToken(user);
  res.status(201).json({ user: publicUser(user), token });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email?.trim() || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const user = db
    .prepare("SELECT id, name, email, phone, password_hash FROM users WHERE email = ?")
    .get(email.trim().toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = signToken(user);
  res.json({ user: publicUser(user), token });
});

module.exports = router;
