const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { adminRequired } = require("../middleware/adminAuth");

const router = express.Router();
const JWT_SECRET = () => process.env.JWT_SECRET || "dev-secret-change-me";

function signAdminToken(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email, name: admin.name, role: "admin" },
    JWT_SECRET(),
    { expiresIn: "12h" }
  );
}

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

// --- Auth ---
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email?.trim() || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const admin = db
    .prepare("SELECT id, name, email, password_hash FROM admins WHERE email = ?")
    .get(email.trim().toLowerCase());

  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: "Invalid admin credentials." });
  }

  const token = signAdminToken(admin);
  res.json({
    admin: { id: admin.id, name: admin.name, email: admin.email },
    token,
  });
});

router.get("/me", adminRequired, (req, res) => {
  const admin = db
    .prepare("SELECT id, name, email FROM admins WHERE id = ?")
    .get(req.admin.id);
  if (!admin) return res.status(401).json({ error: "Admin not found." });
  res.json({ admin });
});

// --- Dashboard ---
router.get("/stats", adminRequired, (_req, res) => {
  const totals = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM products) as products,
        (SELECT COUNT(*) FROM orders) as orders,
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE payment_status = 'paid') as revenue,
        (SELECT COUNT(*) FROM products WHERE stock <= 5) as low_stock`
    )
    .get();

  const recentOrders = db
    .prepare(
      `SELECT id, total, payment_status, customer_name, created_at
       FROM orders ORDER BY created_at DESC LIMIT 5`
    )
    .all();

  const today = db
    .prepare(
      `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
       FROM orders WHERE date(created_at) = date('now')`
    )
    .get();

  res.json({
    products: totals.products,
    orders: totals.orders,
    users: totals.users,
    revenue: totals.revenue,
    lowStock: totals.low_stock,
    ordersToday: today.count,
    revenueToday: today.revenue,
    recentOrders,
  });
});

// --- Orders ---
router.get("/orders", adminRequired, (req, res) => {
  const { status, limit = "50" } = req.query;
  let sql = `SELECT id, user_id, total, payment_method, payment_status, payment_ref,
                    customer_name, customer_email, customer_phone, customer_address, created_at
             FROM orders`;
  const params = [];

  if (status) {
    sql += " WHERE payment_status = ?";
    params.push(status);
  }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(Math.min(Number(limit) || 50, 200));

  const orders = db.prepare(sql).all(...params);
  const itemsStmt = db.prepare(
    `SELECT oi.product_id, oi.qty, oi.unit_price, p.name
     FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`
  );

  res.json(
    orders.map((o) => ({
      ...o,
      items: itemsStmt.all(o.id),
    }))
  );
});

router.get("/orders/:id", adminRequired, (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found." });

  const items = db
    .prepare(
      `SELECT oi.product_id, oi.qty, oi.unit_price, p.name
       FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`
    )
    .all(order.id);

  res.json({
    id: order.id,
    user_id: order.user_id,
    total: order.total,
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    payment_ref: order.payment_ref,
    customer_name: order.customer_name,
    customer_email: order.customer_email,
    customer_phone: order.customer_phone,
    customer_address: order.customer_address,
    created_at: order.created_at,
    items,
  });
});

router.patch("/orders/:id", adminRequired, (req, res) => {
  const { paymentStatus } = req.body;
  const allowed = ["pending", "paid", "failed", "refunded"];
  if (!allowed.includes(paymentStatus)) {
    return res.status(400).json({ error: "Invalid payment status." });
  }

  const result = db
    .prepare("UPDATE orders SET payment_status = ? WHERE id = ?")
    .run(paymentStatus, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Order not found." });
  }

  res.json({ ok: true, paymentStatus });
});

// --- Products ---
router.get("/products", adminRequired, (_req, res) => {
  const rows = db.prepare("SELECT * FROM products ORDER BY name").all();
  res.json(rows.map(mapProduct));
});

router.post("/products", adminRequired, (req, res) => {
  const { name, brand, category, price, stock, image, featured } = req.body;

  if (!name?.trim() || !brand?.trim() || !category || price == null || !image?.trim()) {
    return res.status(400).json({ error: "Name, brand, category, price, and image are required." });
  }

  const cat = db.prepare("SELECT id FROM categories WHERE id = ?").get(category);
  if (!cat) return res.status(400).json({ error: "Invalid category." });

  const id = `p-${Date.now().toString(36)}`;
  db.prepare(
    `INSERT INTO products (id, name, brand, category_id, price, stock, image, featured)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name.trim(),
    brand.trim(),
    category,
    Math.max(0, Math.round(Number(price))),
    Math.max(0, Math.round(Number(stock) || 0)),
    image.trim(),
    featured ? 1 : 0
  );

  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  res.status(201).json(mapProduct(row));
});

router.put("/products/:id", adminRequired, (req, res) => {
  const existing = db.prepare("SELECT id FROM products WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Product not found." });

  const { name, brand, category, price, stock, image, featured } = req.body;
  if (!name?.trim() || !brand?.trim() || !category || price == null || !image?.trim()) {
    return res.status(400).json({ error: "Name, brand, category, price, and image are required." });
  }

  const cat = db.prepare("SELECT id FROM categories WHERE id = ?").get(category);
  if (!cat) return res.status(400).json({ error: "Invalid category." });

  db.prepare(
    `UPDATE products SET name = ?, brand = ?, category_id = ?, price = ?, stock = ?,
     image = ?, featured = ? WHERE id = ?`
  ).run(
    name.trim(),
    brand.trim(),
    category,
    Math.max(0, Math.round(Number(price))),
    Math.max(0, Math.round(Number(stock) || 0)),
    image.trim(),
    featured ? 1 : 0,
    req.params.id
  );

  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  res.json(mapProduct(row));
});

router.patch("/products/:id/stock", adminRequired, (req, res) => {
  const { stock } = req.body;
  if (stock == null || stock < 0) {
    return res.status(400).json({ error: "Valid stock quantity required." });
  }

  const result = db
    .prepare("UPDATE products SET stock = ? WHERE id = ?")
    .run(Math.round(Number(stock)), req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Product not found." });
  }

  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  res.json(mapProduct(row));
});

router.delete("/products/:id", adminRequired, (req, res) => {
  const inOrders = db
    .prepare("SELECT COUNT(*) as n FROM order_items WHERE product_id = ?")
    .get(req.params.id).n;

  if (inOrders > 0) {
    return res.status(409).json({
      error: "Cannot delete product with existing orders. Set stock to 0 instead.",
    });
  }

  const result = db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Product not found." });
  }
  res.json({ ok: true });
});

router.get("/categories", adminRequired, (_req, res) => {
  res.json(db.prepare("SELECT id, name, image FROM categories ORDER BY name").all());
});

// --- Customers ---
router.get("/users", adminRequired, (_req, res) => {
  const users = db
    .prepare("SELECT id, name, email, phone, created_at FROM users ORDER BY created_at DESC")
    .all();
  res.json(users);
});

module.exports = router;
