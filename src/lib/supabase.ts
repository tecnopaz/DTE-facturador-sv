import { createClient } from "@supabase/supabase-js";

export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

/** Valida el JWT del usuario (Authorization: Bearer ...) y devuelve el usuario autenticado. */
export async function userFromRequest(req: Request) {
  const t = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!t) return null;
  const { data, error } = await admin().auth.getUser(t);
  return error ? null : data.user;
}
