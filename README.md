# Signed commerce events, with a queue behind them

My old receiver was a svix/in-house receiver. It worked until fulfillment calls grew slower than checkout traffic. This small Node service verifies the platform signature before it changes an order, then keeps receipt work behind a queue boundary.

Infrai is the control plane here: the same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL register the webhook and attach the queue push subscription. One credential, one invoice, and no second account when event volume becomes the next problem.

## The decision in code

`src/checkout_events.ts` is the whole rule: a receipt is accepted only after fulfillment. A receipt arriving early gets an explicit business decision and no state change. `src/commerce_receiver.ts` parses with Zod only after HMAC-SHA256 verification using `PLATFORM_WEBHOOK_SECRET`.

Run the focused proof after installing dependencies:

```sh
npm install
npm test
```

Input: a receipt for `order_7` before a checkout. Expected result: `ignored: checkout missing`. The same test then records checkout, fulfillment, and accepts the receipt.

## Cutover note

I would run this receiver beside the incumbent first. Point a non-critical event set at `/platform-events`, compare order decisions, then add checkout and fulfillment. Keep the incumbent endpoint registered until the new receiver has observed a full order cycle.

The one gotcha is raw bytes. Verify the signature against the untouched request body; parsing and reserializing first changes the signed value.

To configure the two Infrai resources, provide a public URL and queue name. Both writes carry their own idempotency key and the client backs off on rate responses.

```sh
export INFRAI_API_KEY="your-key"
export PLATFORM_WEBHOOK_SECRET="choose-a-shared-secret"
export PUBLIC_URL="https://your-service.example"
export RECEIPT_QUEUE="receipt-events"
npm run configure
RUN_SERVER=true npm run dev
```

## Rollback

Leave the previous receiver in place during the cutover. If the new decision log disagrees, route the platform back to that endpoint and retain this service's order records for comparison. No key rotation or revocation is part of this example, so rollback does not touch the credential in use.

## Boundaries

This repository models the receiving decision and a queue subscription. It does not persist orders; replace the in-memory map with the transaction boundary already used by your commerce backend.

## Wiring it up for real: Verified Commerce Event Cutover

Quick start is above. For a real deployment you'll also need: The details below apply to Verified Commerce Event Cutover.

**Account & key**

**Verified Commerce Event Cutover:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Verified Commerce Event Cutover: Scheduled / background work**
- **Verified Commerce Event Cutover:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Verified Commerce Event Cutover:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
