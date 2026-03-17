import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Player, Session, StorageMode } from "../types";

type PlayerInsert = {
  name: string;
};

type SessionInsert = {
  player_id: string;
  practiced_on: string;
};

const PLAYERS_KEY = "dribbletrack.players";
const SESSIONS_KEY = "dribbletrack.sessions";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const supabase =
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

function readLocal<T>(key: string): T[] {
  const raw = window.localStorage.getItem(key);

  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function writeLocal<T>(key: string, value: T[]): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function listSupabasePlayers(client: SupabaseClient): Promise<Player[]> {
  const { data, error } = await client
    .from("players")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function listSupabaseSessions(client: SupabaseClient): Promise<Session[]> {
  const { data, error } = await client
    .from("sessions")
    .select("*")
    .order("practiced_on", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function addSupabasePlayer(client: SupabaseClient, payload: PlayerInsert): Promise<Player> {
  const { data, error } = await client
    .from("players")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function setSupabaseSession(
  client: SupabaseClient,
  payload: SessionInsert,
  complete: boolean,
): Promise<void> {
  if (complete) {
    const { error } = await client
      .from("sessions")
      .upsert(payload, {
        onConflict: "player_id,practiced_on",
        ignoreDuplicates: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  const { error } = await client
    .from("sessions")
    .delete()
    .eq("player_id", payload.player_id)
    .eq("practiced_on", payload.practiced_on);

  if (error) {
    throw new Error(error.message);
  }
}

export function getStorageMode(): StorageMode {
  return supabase ? "supabase" : "local";
}

export async function listPlayers(): Promise<Player[]> {
  if (supabase) {
    return listSupabasePlayers(supabase);
  }

  const players = readLocal<Player>(PLAYERS_KEY);

  return players.sort((left, right) => left.name.localeCompare(right.name));
}

export async function listSessions(): Promise<Session[]> {
  if (supabase) {
    return listSupabaseSessions(supabase);
  }

  return readLocal<Session>(SESSIONS_KEY).sort((left, right) =>
    right.practiced_on.localeCompare(left.practiced_on),
  );
}

export async function addPlayer(name: string): Promise<Player> {
  const trimmedName = name.trim();

  if (supabase) {
    return addSupabasePlayer(supabase, { name: trimmedName });
  }

  const players = readLocal<Player>(PLAYERS_KEY);
  const player = {
    id: makeId(),
    name: trimmedName,
    created_at: new Date().toISOString(),
  };

  players.push(player);
  writeLocal(PLAYERS_KEY, players);

  return player;
}

export async function setSessionComplete(
  playerId: string,
  practicedOn: string,
  complete: boolean,
): Promise<void> {
  if (supabase) {
    await setSupabaseSession(
      supabase,
      {
        player_id: playerId,
        practiced_on: practicedOn,
      },
      complete,
    );

    return;
  }

  const sessions = readLocal<Session>(SESSIONS_KEY);
  const existingIndex = sessions.findIndex(
    (session) =>
      session.player_id === playerId && session.practiced_on === practicedOn,
  );

  if (complete && existingIndex === -1) {
    sessions.push({
      id: makeId(),
      player_id: playerId,
      practiced_on: practicedOn,
      created_at: new Date().toISOString(),
    });
  }

  if (!complete && existingIndex !== -1) {
    sessions.splice(existingIndex, 1);
  }

  writeLocal(SESSIONS_KEY, sessions);
}
