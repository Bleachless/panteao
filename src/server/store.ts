import "server-only";
import { Redis } from "@upstash/redis";
import type { Room } from "@/game/room";

// Onde as salas moram. Em produção, no Upstash Redis; no computador (e nos testes de ponta a ponta), na memória.
// Toda gravação confere a versão lida antes (compare-and-set), então duas jogadas ao mesmo tempo nunca se atropelam.

export interface Stored {
  room: Room;
  version: number;
}

export interface RoomStore {
  load(code: string): Promise<Stored | null>;
  /** Grava se a versão atual ainda for `expected` (0 = sala nova). Devolve a nova versão ou null se perdeu a corrida. */
  save(code: string, room: Room, expected: number): Promise<number | null>;
  remove(code: string): Promise<void>;
}

const TTL_SECONDS = 60 * 60 * 12;

class MemoryStore implements RoomStore {
  private rooms = new Map<string, { json: string; version: number; expires: number }>();

  async load(code: string) {
    const entry = this.rooms.get(code);
    if (!entry || entry.expires < Date.now()) return null;
    return { room: JSON.parse(entry.json) as Room, version: entry.version };
  }

  async save(code: string, room: Room, expected: number) {
    const current = this.rooms.get(code);
    const version = current && current.expires >= Date.now() ? current.version : 0;
    if (version !== expected) return null;
    this.rooms.set(code, { json: JSON.stringify(room), version: version + 1, expires: Date.now() + TTL_SECONDS * 1000 });
    return version + 1;
  }

  async remove(code: string) {
    this.rooms.delete(code);
  }
}

// Lua roda atômico no Redis: confere a versão e grava sala + versão de uma vez.
const CAS_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[2]) or '0')
if current ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
redis.call('SET', KEYS[2], current + 1, 'EX', ARGV[3])
return current + 1
`;

class RedisStore implements RoomStore {
  constructor(private redis: Redis) {}

  private keys(code: string) {
    return [`panteao:sala:${code}`, `panteao:sala:${code}:v`];
  }

  async load(code: string) {
    const [json, version] = await this.redis.mget<[string | null, string | null]>(...this.keys(code));
    if (!json || !version) return null;
    return { room: JSON.parse(json) as Room, version: Number(version) };
  }

  async save(code: string, room: Room, expected: number) {
    const result = await this.redis.eval<string[], number>(CAS_SCRIPT, this.keys(code), [String(expected), JSON.stringify(room), String(TTL_SECONDS)]);
    return result ? Number(result) : null;
  }

  async remove(code: string) {
    await this.redis.del(...this.keys(code));
  }
}

function redisFromEnv(): Redis | null {
  // Aceita os nomes do Upstash direto e os que a integração da Vercel cria (KV_REST_API_*).
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token, automaticDeserialization: false });
}

const globalStore = globalThis as unknown as { __panteaoStore?: RoomStore };

export function getStore(): RoomStore {
  if (!globalStore.__panteaoStore) {
    const redis = redisFromEnv();
    globalStore.__panteaoStore = redis ? new RedisStore(redis) : new MemoryStore();
    if (!redis && process.env.VERCEL) console.warn("Panteão: sem Upstash Redis, as salas ficam na memória de cada função e podem sumir.");
  }
  return globalStore.__panteaoStore;
}

export function storeKind(): "redis" | "memoria" {
  return redisFromEnv() ? "redis" : "memoria";
}
