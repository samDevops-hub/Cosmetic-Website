const express = require("express");
const db = require("../db");
const { authRequired, authOptional } = require("../middleware/auth");
const payment = require("../services/payment");

const router = express.Router();

function generateOrderId() {
  return `LB-${Date.now().toString(36).toUpperCase()}`;
}

router.get("/", authRequired, (req, res) => {
  const orders = db
    .prepare(
      `SELECT id, total, payment_method, payment_status, customer_name, customer_email,
              customer_phone, customer_address, created_at
       FROM orders WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(req.user.id);

  const itemsStmt = db.prepare(
    `SELECT oi.product_id, oi.qty, oi.unit_price, p.name, p.image
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?`
  );

  const result = orders.map((order) => ({
    ...order,
    items: itemsStmt.all(order.id),
  }));

  res.json(result);
});

router.post("/", authOptional, async (req, res) => {
  const {
    items,
    paymentMethod,
    customer,
    mpesaPhone,
    cardNumber,
    expiry,
    cvv,
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Cart is empty." });
  }
  if (!customer?.name || !customer?.email || !customer?.phone || !customer?.address) {
    return res.status(400).json({ error: "Delivery details are required." });
  }
  if (!["mpesa", "card"].includes(paymentMethod)) {
    return res.status(400).json({ error: "Invalid payment method." });
  }

  const getProduct = db.prepare("SELECT id, name, price, stock FROM products WHERE id = ?");
  const lineItems = [];
  let total = 0;

  for (const { productId, qty } of items) {
    if (!productId || !qty || qty < 1) {
      return res.status(400).json({ error: "Invalid cart item." });
    }
    const product = getProduct.get(productId);
    if (!product) {
      return res.status(400).json({ error: `Product ${productId} not found.` });
    }
    if (product.stock < qty) {
      return res.status(400).json({
        error: `Not enough stock for ${product.name}. Only ${product.stock} available.`,
      });
    }
    lineItems.push({ product, qty });
    total += product.price * qty;
  }

  const orderId = generateOrderId();
  let paymentResult;

  try {
    if (paymentMethod === "mpesa") {
      const phone = mpesaPhone || customer.phone;
      if (!phone) return res.status(400).json({ error: "M-Pesa phone number is required." });
      paymentResult = await payment.processMpesa({ phone, amount: total, orderId });
    } else {
      if (!cardNumber) return res.status(400).json({ error: "Card number is required." });
      paymentResult = await payment.processCard({
        cardNumber,
        expiry,
        cvv,
        amount: total,
        orderId,
      });
    }
  } catch (err) {
    return res.status(402).json({ error: err.message || "Payment failed." });
  }

  const userId = req.user?.id ?? null;

  const placeOrder = db.transaction(() => {
    db.prepare(
      `INSERT INTO orders (id, user_id, total, payment_method, payment_status, payment_ref,
        payment_message, customer_name, customer_email, customer_phone, customer_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      orderId,
      userId,
      total,
      paymentMethod,
      paymentResult.status,
      paymentResult.ref,
      paymentResult.message,
      customer.name.trim(),
      customer.email.trim().toLowerCase(),
      customer.phone.trim(),
      customer.address.trim()
    );

    const insertItem = db.prepare(
      "INSERT INTO order_items (order_id, product_id, qty, unit_price) VALUES (?, ?, ?, ?)"
    );
    const decrementStock = db.prepare(
      "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?"
    );

    for (const { product, qty } of lineItems) {
      const updated = decrementStock.run(qty, product.id, qty);
      if (updated.changes === 0) {
        throw new Error(`Stock update failed for ${product.name}.`);
      }
      insertItem.run(orderId, product.id, qty, product.price);
    }
  });

  try {
    placeOrder();
  } catch (err) {
    return res.status(409).json({ error: err.message || "Could not complete order." });
  }

  res.status(201).json({
    order: {
      id: orderId,
      total,
      paymentMethod,
      paymentStatus: paymentResult.status,
      paymentRef: paymentResult.ref,
      createdAt: new Date().toISOString(),
    },
    payment: {
      message: paymentResult.message,
      simulated: paymentResult.simulated,
    },
  });
});

router.get("/:id", authOptional, (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found." });

  if (order.user_id && req.user?.id !== order.user_id) {
    return res.status(403).json({ error: "Access denied." });
  }

  const items = db
    .prepare(
      `SELECT oi.product_id, oi.qty, oi.unit_price, p.name, p.image
       FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`
    )
    .all(order.id);

  res.json({
    id: order.id,
    total: order.total,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    paymentRef: order.payment_ref,
    paymentMessage: order.payment_message,
    customer: {
      name: order.customer_name,
      email: order.customer_email,
      phone: order.customer_phone,
      address: order.customer_address,
    },
    items,
    createdAt: order.created_at,
  });
});

module.exports = router;
