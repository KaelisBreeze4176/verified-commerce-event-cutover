import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { platformEventSchema, applyPlatformEvent, type OrderRecord } from "./checkout_events.js";
import { infrai } from "./infrai_client.js";

const orders = new Map<string, OrderRecord>();
const webhookSecret = process.env.PLATFORM_WEBHOOK_SECRET;

function signatureFor(rawBody: string): string {
  if (!webhookSecret) throw new Error("Set PLATFORM_WEBHOOK_SECRET before receiving events");
  return createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
}

export function hasValidSignature(rawBody: string, received: string | undefined): boolean {
  if (!received) return false;
  const expected = Buffer.from(signatureFor(rawBody), "utf8");
  const actual = Buffer.from(received, "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function configureEventBridge(publicUrl: string, queue: string): Promise<void> {
  const secret = process.env.PLATFORM_WEBHOOK_SECRET;
  if (!secret) throw new Error("Set PLATFORM_WEBHOOK_SECRET before configuring the event bridge");
  await infrai.account.webhooks.register({
    url: `${publicUrl}/platform-events`,
    events: ["checkout.completed", "fulfillment.shipped", "receipt.issued", "customer.order_updated"],
    description: "Commerce order event receiver",
    secret,
    idempotency_key: randomUUID()
  });
  await infrai.queue.push_subscribe(queue, {
    queue,
    url: `${publicUrl}/receipt-jobs`,
    secret,
    visibility_timeout: 60,
    idempotency_key: randomUUID()
  });
}

async function readBody(request: import("node:http").IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of request) body += chunk;
  return body;
}

const port = Number(process.env.PORT ?? 3000);
const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/platform-events") {
    response.writeHead(404).end();
    return;
  }
  const rawBody = await readBody(request);
  if (!hasValidSignature(rawBody, request.headers["x-platform-signature"] as string | undefined)) {
    response.writeHead(401).end("signature rejected");
    return;
  }
  const parsed = platformEventSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    response.writeHead(400).end("event body rejected");
    return;
  }
  const decision = applyPlatformEvent(orders, parsed.data);
  response.writeHead(202, { "Content-Type": "application/json" }).end(JSON.stringify({ decision }));
});

if (process.env.RUN_SERVER === "true") server.listen(port);
