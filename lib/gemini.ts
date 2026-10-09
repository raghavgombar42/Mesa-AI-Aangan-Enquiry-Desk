import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { GEMINI_MODEL } from "./config";

// GEMINI_API_KEY may hold several comma-separated keys. A key that is rejected
// (expired / revoked) is dropped for the life of the process; a rate-limited key
// just hands over to the next one. Safe under concurrent calls.
const clients = new Map<string, GoogleGenAI>();
const deadKeys = new Set<string>();
let current = 0;

function liveKeys() {
  const list = (process.env.GEMINI_API_KEY ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  if (!list.length) throw new Error("GEMINI_API_KEY is not set");
  const live = list.filter((k) => !deadKeys.has(k));
  if (!live.length) throw new Error("Every GEMINI_API_KEY was rejected as invalid or expired - add a working key");
  return live;
}

function pickKey() {
  const live = liveKeys();
  const key = live[current % live.length];
  if (!clients.has(key)) clients.set(key, new GoogleGenAI({ apiKey: key }));
  return { key, ai: clients.get(key)! };
}

const msgOf = (err: unknown) => String((err as Error)?.message ?? err);
const isDeadKey = (err: unknown) => /(401|403)|UNAUTHENTICATED|PERMISSION_DENIED|API_KEY_INVALID/i.test(msgOf(err));
const isRateLimit = (err: unknown) => /429|RESOURCE_EXHAUSTED/i.test(msgOf(err));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryable(err: unknown) {
  const msg = String((err as Error)?.message ?? err);
  return /\b(429|500|502|503|504)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|timeout|fetch failed|ECONNRESET|terminated|socket|network|EPIPE|ETIMEDOUT/i.test(msg);
}

function retryDelayMs(err: unknown, attempt: number) {
  const m = String((err as Error)?.message ?? "").match(/retry(?:Delay)?["\s:]*"?(\d+(?:\.\d+)?)s/i);
  if (m) return Math.min(Number(m[1]) * 1000 + 500, 45_000);
  return Math.min(2000 * 2 ** attempt, 30_000);
}

export type Usage = { input: number; output: number };

/**
 * One structured-output call to Gemini. Callers never pass the caller phone number.
 * Returns the parsed JSON plus billed token counts (thinking tokens bill as output).
 */
export async function generateJSON<T>(opts: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  temperature?: number;
  /** How much the model reasons before answering. Lower = faster. Defaults to GEMINI_THINKING or the model default. */
  thinking?: "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";
}): Promise<{ data: T; usage: Usage }> {
  const level = opts.thinking ?? (process.env.GEMINI_THINKING as typeof opts.thinking);
  let lastErr: unknown;
  let keySwitches = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { key, ai } = pickKey();
    try {
      const res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: opts.prompt,
        config: {
          systemInstruction: opts.system,
          temperature: opts.temperature ?? 0,
          responseMimeType: "application/json",
          responseJsonSchema: opts.schema,
          ...(level ? { thinkingConfig: { thinkingLevel: ThinkingLevel[level] } } : {}),
        },
      });
      const text = res.text;
      if (!text) throw new Error("Gemini returned an empty response");
      const u = res.usageMetadata;
      const usage = {
        input: u?.promptTokenCount ?? 0,
        output: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0),
      };
      return { data: JSON.parse(text) as T, usage };
    } catch (err) {
      lastErr = err;
      if (isDeadKey(err)) {
        deadKeys.add(key); // never use this key again in this process
        if (keySwitches++ < 10) {
          attempt--; // switching keys doesn't use up a retry
          continue;
        }
      }
      if (isRateLimit(err) && liveKeys().length > 1 && keySwitches++ < 10) {
        current++;
        attempt--;
        continue;
      }
      const parseError = err instanceof SyntaxError;
      if (!parseError && !isRetryable(err)) break;
      await sleep(retryDelayMs(err, attempt));
    }
  }
  throw new Error(`Gemini call failed: ${String((lastErr as Error)?.message ?? lastErr).slice(0, 400)}`);
}
