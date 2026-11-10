import 'expo-sqlite/localStorage/install'; // gives supabase-js a persistent localStorage on iOS/Android
import { createClient } from '@supabase/supabase-js';

// All Juicy tables and functions live in the "juicy" schema.
export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
  {
    db: { schema: 'juicy' },
    auth: { storage: localStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  },
);

export type Audience = 'plate' | 'table' | 'chef';

export type FeedPost = {
  id: string;
  author_id: string;
  username: string | null;
  display_name: string | null;
  avatar_character: string | null;
  author_status: 'eating' | 'drinking' | null;
  kind: 'eat' | 'drink';
  photo_path: string;
  note: string | null;
  place_name: string | null;
  cuisine: string | null;
  juicy_score: number | null;
  save_count: number;
  comment_count: number;
  share_count: number;
  saved_by_me: boolean;
  created_at: string;
  rank: number;
};

export type Meal = {
  id: string;
  status: 'analyzing' | 'ready' | 'not_food' | 'failed';
  kind: 'eat' | 'drink';
  dish_name: string | null;
  cuisine: string | null;
  juicy_score: number | null;
  verdict: string | null;
  tips: { ingredient: string; why: string; delta: number }[];
};
