import { createClient } from "@supabase/supabase-js";
// URL y clave publicable (seguras para el navegador). Si Vercel no tiene las variables, se usan estos valores.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jhasesggsksrmpamasiz.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_XzOk67ZMW9Vt-b7DGeDniw_p6sbuaFo";
export const supabase = createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } });
