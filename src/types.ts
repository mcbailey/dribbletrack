export type Player = {
  id: string;
  name: string;
  created_at: string;
};

export type Session = {
  id: string;
  player_id: string;
  practiced_on: string;
  created_at: string;
};

export type StorageMode = "local" | "supabase";
