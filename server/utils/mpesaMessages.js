/** Map Safaricom STK callback codes to customer-facing messages */

const CANCELLED_CODES = new Set([1032, 1031]);

const TIMEOUT_CODES = new Set([1037, 1]);

function messageForMpesaResult(resultCode, resultDesc = "") {
  const code = Number(resultCode);

  if (code === 0) {
    return "Payment successful! Your M-Pesa payment was completed.";
  }
  if (CANCELLED_CODES.has(code)) {
    return "Transaction has been cancelled.";
  }
  if (TIMEOUT_CODES.has(code)) {
    return "Transaction timed out. Please try again.";
  }
  if (/cancel/i.test(resultDesc)) {
    return "Transaction has been cancelled.";
  }
  return resultDesc || "Payment was not completed. Please try again.";
}

module.exports = { messageForMpesaResult };
