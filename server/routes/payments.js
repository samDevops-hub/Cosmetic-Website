const express = require("express");
const db = require("../db");

const router = express.Router();

/** Safaricom Daraja STK callback */
router.post("/mpesa/callback", (req, res) => {
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });

  try {
    const body = req.body?.Body?.stkCallback;
    if (!body) return;

    const checkoutId = body.CheckoutRequestID;
    const resultCode = body.ResultCode;
    const order = db
      .prepare("SELECT id FROM orders WHERE payment_ref = ? AND payment_status = 'pending'")
      .get(checkoutId);

    if (!order) return;

    const status = resultCode === 0 ? "paid" : "failed";
    db.prepare("UPDATE orders SET payment_status = ? WHERE id = ?").run(status, order.id);
  } catch (err) {
    console.error("M-Pesa callback error:", err.message);
  }
});

module.exports = router;
