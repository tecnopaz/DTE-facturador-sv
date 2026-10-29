import { NextResponse } from "next/server";
import { admin, userFromRequest } from "@/lib/supabase";
import { encrypt } from "@/lib/crypto";
import { DEPARTAMENTOS, esCorreo, esDUI, normNIT, normNRC } from "@/lib/validators";

export const runtime = "nodejs";
const bad = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return bad("No autenticado", 401);
  const b = await req.json().catch(() => null);
  if (!b) return bad("JSON inválido");
  const t = (k: string) => String(b[k] ?? "").trim();

  const nit = normNIT(t("nit_emisor")), nrc = normNRC(t("nrc_emisor"));
  if (!t("nombre_razon_social") || !t("nombre_comercial")) return bad("Nombre o razón social y nombre comercial son obligatorios");
  if (!nit) return bad("NIT del emisor inválido (14 dígitos)");
  if (!nrc) return bad("NRC del emisor inválido");
  if (!esDUI(t("dui_propietario"))) return bad("DUI del propietario inválido (00000000-0)");
  if (!esCorreo(t("email_emisor"))) return bad("Correo del emisor inválido");
  if (!/^\d{4,6}$/.test(t("cod_actividad")) || !t("giro_actividad")) return bad("Código y descripción del giro son obligatorios");
  if (!DEPARTAMENTOS[t("departamento")] || !/^\d{2}$/.test(t("municipio")) || !t("direccion_complemento")) return bad("Dirección incompleta (departamento, municipio y complemento)");
  const ambiente = t("ambiente") === "01" ? "01" : "00";
  if (!t("hacienda_api_key") || !t("hacienda_private_key") || !t("hacienda_password")) return bad("Faltan las credenciales de Hacienda");

  if (String(b.hacienda_private_key).length > 200_000) return bad("El certificado es demasiado grande");

  const db = admin();
  const { error: e1 } = await db.from("credenciales_hacienda").upsert({
    comercio_id: user.id,
    hacienda_api_key_encrypted: encrypt(t("hacienda_api_key")),
    hacienda_private_key_encrypted: encrypt(String(b.hacienda_private_key)),
    hacienda_password_encrypted: encrypt(t("hacienda_password")),
    updated_at: new Date().toISOString(),
  });
  if (e1) return bad("No se pudieron guardar las credenciales", 500);
  const { error: e2 } = await db.from("perfil_comercio").update({
    email_emisor: t("email_emisor"), nombre_razon_social: t("nombre_razon_social"), nombre_comercial: t("nombre_comercial"),
    nit_emisor: nit, nrc_emisor: nrc, dui_propietario: t("dui_propietario"), cod_actividad: t("cod_actividad"), giro_actividad: t("giro_actividad"),
    departamento: t("departamento"), municipio: t("municipio"), direccion_complemento: t("direccion_complemento"), telefono: t("telefono") || null,
    ambiente, onboarding_completo: true,
  }).eq("id", user.id);
  if (e2) return bad("No se pudo guardar el perfil", 500);
  return NextResponse.json({ ok: true });
}
