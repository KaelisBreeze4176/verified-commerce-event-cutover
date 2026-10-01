import { configureEventBridge } from "./commerce_receiver.js";

const publicUrl = process.env.PUBLIC_URL;
const queue = process.env.RECEIPT_QUEUE;

if (!publicUrl || !queue) {
  throw new Error("Set PUBLIC_URL and RECEIPT_QUEUE before registering the commerce bridge");
}

await configureEventBridge(publicUrl, queue);
console.log("Commerce webhook and receipt queue subscription configured");
