import assert from "node:assert/strict";
import { applyPlatformEvent, type OrderRecord } from "../src/checkout_events.js";

const orders = new Map<string, OrderRecord>();
const receipt = {
  id: "evt_receipt_1",
  type: "receipt.issued" as const,
  data: { order_id: "order_7", customer_id: "cus_4" }
};

assert.equal(applyPlatformEvent(orders, receipt), "ignored: checkout missing");
assert.equal(applyPlatformEvent(orders, {
  id: "evt_checkout_1",
  type: "checkout.completed",
  data: { order_id: "order_7", customer_id: "cus_4", total_cents: 2599 }
}), "checkout recorded");
assert.equal(applyPlatformEvent(orders, {
  id: "evt_ship_1",
  type: "fulfillment.shipped",
  data: { order_id: "order_7", customer_id: "cus_4" }
}), "fulfillment recorded");
assert.equal(applyPlatformEvent(orders, receipt), "receipt accepted");
assert.equal(orders.get("order_7")?.stage, "receipted");
