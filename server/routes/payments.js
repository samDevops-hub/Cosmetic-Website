const express = require("express");
const db = require("../db");
const { messageForMpesaResult } = require("../utils/mpesaMessages");

const router = express.Router();

/** Safaricom Daraja STK callback */
router.post("/mpesa/callback", (req, res) => {
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });

  try {
    const body = req.body?.Body?.stkCallback;
    if (!body) {
      console.warn("M-Pesa callback: missing Body.stkCallback");
      return;
    }

    const checkoutId = body.CheckoutRequestID;
    const resultCode = Number(body.ResultCode);
    const resultDesc = body.ResultDesc || "";
    const paymentMessage = messageForMpesaResult(resultCode, resultDesc);

    const order = db
      .prepare("SELECT id, payment_status FROM orders WHERE payment_ref = ?")
      .get(checkoutId);

    if (!order) {
      console.warn("M-Pesa callback: no order for CheckoutRequestID", checkoutId);
      return;
    }

    if (order.payment_status !== "pending" && order.payment_status !== "failed") {
      return;
    }

    const status = resultCode === 0 ? "paid" : "failed";

    const update = db.transaction(() => {
      db.prepare(
        "UPDATE orders SET payment_status = ?, payment_message = ? WHERE id = ?"
      ).run(status, paymentMessage, order.id);

      if (status === "failed") {
        const items = db
          .prepare("SELECT product_id, qty FROM order_items WHERE order_id = ?")
          .all(order.id);
        const restock = db.prepare(
          "UPDATE products SET stock = stock + ? WHERE id = ?"
        );
        items.forEach((item) => restock.run(item.qty, item.product_id));
      }
    });
    update();

    console.log(`M-Pesa ${order.id}: [${resultCode}] ${paymentMessage}`);
  } catch (err) {
    console.error("M-Pesa callback error:", err.message);
  }
});

module.exports = router;
