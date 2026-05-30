require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const db = require("./db");

const authRoutes = require("./routes/auth");
const categoryRoutes = require("./routes/categories");
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const paymentRoutes = require("./routes/payments");
const adminRoutes = require("./routes/admin");
const { ensureAdmin } = require("./ensureAdmin");

const app = express();
const PORT = process.env.PORT || 3000;
const root = path.join(__dirname, "..");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Seed on first run if database is empty
const productCount = db.prepare("SELECT COUNT(*) as n FROM products").get().n;
if (productCount === 0) {
  require("./seed");
}
ensureAdmin();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "lumiere-beauty-api" });
});

app.get("/api/auth/me", (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET || "dev-secret-change-me");
    const user = db
      .prepare("SELECT id, name, email, phone FROM users WHERE id = ?")
      .get(payload.id);
    if (!user) return res.status(401).json({ error: "User not found." });
    res.json({ user });
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

app.use(express.static(root));

app.get(["/admin", "/admin/"], (_req, res) => {
  res.sendFile(path.join(root, "admin.html"));
});

app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Not found." });
  }
  res.sendFile(path.join(root, "index.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`Lumière Beauty running at http://localhost:${PORT}`);
});
