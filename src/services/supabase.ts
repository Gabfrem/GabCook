/* ========== COMPTE & SYNCHRONISATION (Supabase) ==========
   Ces deux valeurs sont PUBLIQUES par nature (présentes dans tout site Supabase) :
   la sécurité vient des règles RLS de la base, pas du secret de la clé.
   Si le client ne se charge pas, l'application fonctionne entièrement en local. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://kldxfxkqmfiyfrdeyprp.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsZHhmeGtxbWZpeWZyZGV5cHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyODU5NDEsImV4cCI6MjEwMTg2MTk0MX0.4OKtPQKUHWUp0dFlatMnC0a6FLWCuIK2iWEs85znaSk";

/** Comptes administrateurs : modération des publications et commentaires (une policy RLS
 *  autorise la même chose côté serveur). */
export const ADMINS = ["gabin.fremin@gmail.com"];

let client: SupabaseClient | null = null;
try {
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
} catch {
  client = null;
}
export const sb = client;
export const CLOUD_ON = !!sb;
