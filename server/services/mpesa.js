/**
 * Safaricom Daraja M-Pesa STK Push.
 * Set MPESA_* env vars for live payments; otherwise returns a simulated response.
 */

const SANDBOX_BASE = "https://sandbox.safaricom.co.ke";
const LIVE_BASE = "https://api.safaricom.co.ke";

function isConfigured() {
  return !!(
    process.env.MPESA_CONSUMER_KEY &&
    process.env.MPESA_CONSUMER_SECRET &&
    process.env.MPESA_PASSKEY
  );
}

function baseUrl() {
  return process.env.MPESA_ENV === "production" ? LIVE_BASE : SANDBOX_BASE;
}

async function getAccessToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");

  const res = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.errorMessage || "M-Pesa OAuth failed");
  return data.access_token;
}

function formatPhone(phone) {
  let p = String(phone).replace(/\D/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (p.startsWith("7")) p = "254" + p;
  if (!p.startsWith("254")) p = "254" + p;
  return p;
}

function stkPassword() {
  const shortcode = process.env.MPESA_SHORTCODE || "174379";
  const passkey = process.env.MPESA_PASSKEY;
  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
  const str = shortcode + passkey + timestamp;
  return {
    password: Buffer.from(str).toString("base64"),
    timestamp,
    shortcode,
  };
}

async function initiateStkPush({ phone, amount, orderId, accountReference }) {
  if (!isConfigured()) {
    return {
      simulated: true,
      CheckoutRequestID: `SIM-${orderId}`,
      MerchantRequestID: `SIM-MR-${Date.now()}`,
      ResponseDescription: "STK push simulated (configure MPESA_* env for live payments).",
    };
  }

  const token = await getAccessToken();
  const { password, timestamp, shortcode } = stkPassword();
  const callbackUrl =
    process.env.MPESA_CALLBACK_URL || `http://localhost:${process.env.PORT || 3000}/api/payments/mpesa/callback`;

  const body = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.ceil(amount),
    PartyA: formatPhone(phone),
    PartyB: shortcode,
    PhoneNumber: formatPhone(phone),
    CallBackURL: callbackUrl,
    AccountReference: accountReference || orderId,
    TransactionDesc: `Lumière order ${orderId}`,
  };

  const res = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || data.errorCode) {
    throw new Error(data.errorMessage || data.ResponseDescription || "STK push failed");
  }
  return data;
}

module.exports = { isConfigured, initiateStkPush, formatPhone };
