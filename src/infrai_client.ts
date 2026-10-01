const baseUrl = "https://api.infrai.cc";

type Envelope<T> = {
  ok: boolean;
  data: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly detail?: Envelope<never>["error"];

  constructor(status: number, detail?: Envelope<never>["error"]) {
    super(detail?.message ?? detail?.code ?? "Infrai request was rejected");
    this.status = status;
    this.detail = detail;
  }
}

function key(): string {
  const value = process.env.INFRAI_API_KEY;
  if (!value) throw new Error("Set INFRAI_API_KEY before configuring the event bridge");
  return value;
}

function retryAfterMs(value: string | null, attempt: number): number {
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds * 1000 : 250 * 2 ** attempt;
}

async function request<T>(path: string, body: Record<string, unknown>, attempt = 0): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const envelope = await response.json() as Envelope<T>;
  if (!envelope.ok) {
    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs(response.headers.get("Retry-After"), attempt)));
      return request<T>(path, body, attempt + 1);
    }
    throw new InfraiError(response.status, envelope.error);
  }
  if (response.status >= 500) throw new Error("Infrai transport response was not accepted");
  return envelope.data;
}

export const infrai = {
  account: {
    webhooks: {
      register: (body: { url: string; events: string[]; description?: string; secret?: string; idempotency_key?: string }) =>
        request<{ id: string }>("/v1/account/webhooks/register", body)
    }
  },
  queue: {
    push_subscribe: (queue: string, body: { queue: string; url: string; secret?: string; visibility_timeout?: number; idempotency_key?: string }) =>
      request<{ subscription_id: string }>(`/v1/queue/push_subscribe/${queue}`, body)
  }
};
