const mpesa = require("./mpesa");

async function processMpesa({ phone, amount, orderId }) {
  const result = await mpesa.initiateStkPush({
    phone,
    amount,
    orderId,
    accountReference: orderId,
  });
  return {
    status: result.simulated ? "paid" : "pending",
    ref: result.CheckoutRequestID,
    message: result.ResponseDescription || "STK push initiated.",
    simulated: !!result.simulated,
  };
}

async function processCard({ cardNumber, expiry, cvv, amount, orderId }) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey) {
    const last4 = cardNumber.replace(/\s/g, "").slice(-4);
    return {
      status: "paid",
      ref: `SIM-CARD-${orderId}`,
      message: `Card payment simulated (ending ${last4}). Set STRIPE_SECRET_KEY for live charges.`,
      simulated: true,
    };
  }

  // Stripe Payment Intents would go here in production.
  // For now, validate format and return simulated success when key is set but full integration is pending.
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 15) throw new Error("Invalid card number.");

  return {
    status: "paid",
    ref: `STRIPE-PENDING-${orderId}`,
    message: "Stripe key detected. Complete Payment Intents integration for live card charges.",
    simulated: true,
  };
}

module.exports = { processMpesa, processCard };
