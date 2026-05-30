const express = require("express");
const db = require("../db");

const router = express.Router();

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    category: row.category_id,
    price: row.price,
    stock: row.stock,
    image: row.image,
    featured: !!row.featured,
  };
}

router.get("/", (req, res) => {
  const { category, search, sort } = req.query;
  let sql = "SELECT * FROM products WHERE 1=1";
  const params = [];

  if (category && category !== "all") {
    sql += " AND category_id = ?";
    params.push(category);
  }

  if (search?.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    sql += " AND (LOWER(name) LIKE ? OR LOWER(brand) LIKE ? OR LOWER(category_id) LIKE ?)";
    params.push(q, q, q);
  }

  switch (sort) {
    case "price-asc":
      sql += " ORDER BY price ASC";
      break;
    case "price-desc":
      sql += " ORDER BY price DESC";
      break;
    case "name":
      sql += " ORDER BY name ASC";
      break;
    default:
      sql += " ORDER BY featured DESC, name ASC";
  }

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(mapProduct));
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Product not found." });
  res.json(mapProduct(row));
});

module.exports = router;
