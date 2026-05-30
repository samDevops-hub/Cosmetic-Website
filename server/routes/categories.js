const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", (_req, res) => {
  const rows = db.prepare("SELECT id, name, image FROM categories ORDER BY name").all();
  res.json(rows);
});

module.exports = router;
