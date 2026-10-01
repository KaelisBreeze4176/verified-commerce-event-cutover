import { z } from "zod";

export const platformEventSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["checkout.completed", "fulfillment.shipped", "receipt.issued", "customer.order_updated"]),
  data: z.object({
    order_id: z.string().min(1),
    customer_id: z.string().min(1),
    total_cents: z.number().int().nonnegative().optional()
  })
});

export type PlatformEvent = z.infer<typeof platformEventSchema>;
export type OrderStage = "checked_out" | "fulfilled" | "receipted";
export type OrderRecord = { customerId: string; stage: OrderStage; totalCents?: number };

export function applyPlatformEvent(orders: Map<string, OrderRecord>, event: PlatformEvent): string {
  const prior = orders.get(event.data.order_id);
  if (event.type === "checkout.completed") {
    orders.set(event.data.order_id, { customerId: event.data.customer_id, stage: "checked_out", totalCents: event.data.total_cents });
    return "checkout recorded";
  }
  if (!prior) return "ignored: checkout missing";
  if (event.type === "fulfillment.shipped") {
    orders.set(event.data.order_id, { ...prior, stage: "fulfilled" });
    return "fulfillment recorded";
  }
  if (event.type === "receipt.issued" && prior.stage === "fulfilled") {
    orders.set(event.data.order_id, { ...prior, stage: "receipted" });
    return "receipt accepted";
  }
  return event.type === "receipt.issued" ? "ignored: fulfillment missing" : "customer update accepted";
}
