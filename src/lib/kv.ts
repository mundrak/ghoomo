import { randomBytes } from "node:crypto";

// Key-value storage: Redis (Upstash, free tier, via its REST API) when configured, otherwise
// process memory. Memory is fine for local development but not for production on Vercel:
// each server instance has its own memory and instances come and go, so data leaks away.
// That's why features that keep data for other people (saved trips, groups) only switch on
// when `storageAvailable` is true.

export interface Store {
  get(key: string): Promise<string | null>;
  incrBy(key: string, by: number, ttlSeconds: number): Promise<number>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** Sets one field of a hash and refreshes the hash's expiry. */
  hset(key: string, field: string, value: string, ttlSeconds: number): Promise<void>;
  hgetall(key: string): Promise<Record<string, string>>;
}

function redisStore(url: string, token: string): Store {
  const pipeline = async (commands: (string | number)[][]) => {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Redis error ${res.status}`);
    return ((await res.json()) as { result: unknown }[]).map((r) => r.result);
  };
  return {
    get: async (key) => ((await pipeline([["GET", key]]))[0] as string | null) ?? null,
    incrBy: async (key, by, ttl) => Number((await pipeline([["INCRBY", key, by], ["EXPIRE", key, ttl]]))[0]),
    set: async (key, value, ttl) => void (await pipeline([["SET", key, value, "EX", ttl]])),
    hset: async (key, field, value, ttl) => void (await pipeline([["HSET", key, field, value], ["EXPIRE", key, ttl]])),
    hgetall: async (key) => {
      // Upstash returns HGETALL as a flat [field, value, field, value, …] list.
      const flat = ((await pipeline([["HGETALL", key]]))[0] as string[] | null) ?? [];
      const out: Record<string, string> = {};
      for (let i = 0; i + 1 < flat.length; i += 2) out[flat[i]] = flat[i + 1];
      return out;
    },
  };
}

function memoryStore(): Store {
  const data = new Map<string, { value: string; expires: number }>();
  const read = (key: string) => {
    const hit = data.get(key);
    if (hit && hit.expires < Date.now()) data.delete(key);
    return data.get(key)?.value ?? null;
  };
  const write = (key: string, value: string, ttl: number) => data.set(key, { value, expires: Date.now() + ttl * 1000 });
  return {
    get: async (key) => read(key),
    incrBy: async (key, by, ttl) => {
      const value = Number(read(key) ?? 0) + by;
      write(key, String(value), ttl);
      return value;
    },
    set: async (key, value, ttl) => void write(key, value, ttl),
    hset: async (key, field, value, ttl) => {
      const hash = JSON.parse(read(key) ?? "{}") as Record<string, string>;
      hash[field] = value;
      write(key, JSON.stringify(hash), ttl);
    },
    hgetall: async (key) => JSON.parse(read(key) ?? "{}") as Record<string, string>,
  };
}

const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const hasRedis = Boolean(redisUrl && redisToken);

// Next.js bundles each route separately, so a plain module-level map would give every route its
// own memory. Keep one on globalThis so all routes in this process share it.
const shared = globalThis as typeof globalThis & { __ghoomoMemory?: Store };
export const store: Store = hasRedis ? redisStore(redisUrl!, redisToken!) : (shared.__ghoomoMemory ??= memoryStore());

/** True when data will still be there for the next request: Redis is set up, or this is local development. */
export const storageAvailable = hasRedis || process.env.NODE_ENV !== "production";

const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** A short, hard-to-guess ID for links, without look-alike characters. */
export function newId(length = 10) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
export const ID_PATTERN = /^[a-km-zA-HJ-NP-Z2-9]{10}$/;
