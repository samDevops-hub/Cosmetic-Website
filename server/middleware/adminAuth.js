const jwt = require("jsonwebtoken");

const JWT_SECRET = () => process.env.JWT_SECRET || "dev-secret-change-me";

function adminRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Admin authentication required." });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET());
    if (payload.role !== "admin") {
      return res.status(403).json({ error: "Admin access only." });
    }
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired admin token." });
  }
}

module.exports = { adminRequired };
