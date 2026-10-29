import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { admin, userFromRequest } from "@/lib/supabase";
import { decrypt } from "@/lib/crypto";
import { buildCCF, buildFE, calcular, fechaSV, numeroControl, type Emisor, type Linea, type Receptor } from "@/lib/dte/builder";
import { firmar, HaciendaError, recepcion, type Ambiente } from "@/lib/hacienda";
import { esCorreo, esDUI, normNIT, normNRC } from "@/lib/validators";

export const runtime = "nodejs";
export const maxDuration = 30;
const bad = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return bad("No autenticado", 401);
  const b = await req.json().catch(() => null);
  if (!b) return bad("JSON inválido");
  const db = admin();

  const { data: p } = await db.from("perfil_comercio").select("*").eq("id", user.id).single();
  if (!p?.onboarding_completo) return bad("Completa primero los datos del comercio y las credenciales de Hacienda", 403);
  const vigente = [p.trial_hasta, p.licencia_hasta].some((d: string | null) => d && new Date(d) > new Date());
  if (!vigente) return bad("Tu prueba o licencia venció", 402);

  const tipo = b.tipo as "01" | "03";
  if (tipo !== "01" && tipo !== "03") return bad("Tipo de DTE inválido");
  const lineas: Linea[] = (Array.isArray(b.lineas) ? b.lineas : []).slice(0, 50).map((l: any) => ({
    codigo: l.codigo ? String(l.codigo) : undefined, descripcion: String(l.descripcion ?? "").trim().slice(0, 1000), cantidad: Number(l.cantidad), precio: Number(l.precio) }));
  if (!lineas.length || lineas.some((l) => !l.descripcion || !(l.cantidad > 0) || !(l.precio > 0))) return bad("Líneas inválidas");

  const r: Receptor = { ...(b.receptor ?? {}) };
  const k = calcular(tipo, lineas, !!b.retener);

  if (tipo === "01") {
    // Regla de los $200 aplicada también en el servidor (nunca confiar solo en la interfaz)
    if (k.total >= 200 && (!String(r.nombre ?? "").trim() || r.tipoDocumento !== "13" || !esDUI(r.numDocumento)))
      return bad("Por legislación de Hacienda, ventas iguales o mayores a $200 requieren registrar el Nombre completo y DUI del cliente");
    if (r.numDocumento && r.tipoDocumento === "13" && !esDUI(r.numDocumento)) return bad("DUI inválido");
  } else {
    const nit = normNIT(r.numDocumento), nrc = normNRC(r.nrc);
    const d = r.direccion;
    if (!nit || !nrc || !r.nombre || !r.codActividad || !r.descActividad || !d?.departamento || !d?.municipio || !d?.complemento || !esCorreo(r.correo))
      return bad("El Crédito Fiscal exige NIT, NRC, nombre, giro, dirección y correo del receptor (no aplica Consumidor Final)");
    r.numDocumento = nit; r.nrc = nrc;
  }

  const { data: cr } = await db.from("credenciales_hacienda").select("*").eq("comercio_id", user.id).single();
  if (!cr) return bad("Faltan credenciales de Hacienda", 403);
  let apiKey: string, certificado: string, privPwd: string;
  try { apiKey = decrypt(cr.hacienda_api_key_encrypted); certificado = decrypt(cr.hacienda_private_key_encrypted); privPwd = decrypt(cr.hacienda_password_encrypted); }
  catch { return bad("No se pudieron descifrar las credenciales; vuelve a registrarlas", 500); }

  const { data: n, error: en } = await db.rpc("siguiente_correlativo", { p_comercio: user.id, p_tipo: tipo });
  if (en || n == null) return bad("No se pudo generar el número de control", 500);

  const ambiente = (p.ambiente === "01" ? "01" : "00") as Ambiente;
  const emisor: Emisor = {
    nit: p.nit_emisor, nrc: p.nrc_emisor, nombre: p.nombre_razon_social, codActividad: p.cod_actividad, descActividad: p.giro_actividad, nombreComercial: p.nombre_comercial,
    direccion: { departamento: p.departamento, municipio: p.municipio, complemento: p.direccion_complemento }, telefono: p.telefono ?? "", correo: p.email_emisor,
    codEstable: p.cod_estable, codPuntoVenta: p.cod_punto_venta,
  };
  const ctx = { emisor, ambiente, numeroControl: numeroControl(tipo, p.cod_estable, p.cod_punto_venta, Number(n)), codigoGeneracion: randomUUID().toUpperCase() };
  const dte = tipo === "01" ? buildFE(ctx, r, lineas) : buildCCF(ctx, r, lineas, !!b.retener);

  let estado: "Transmitido" | "Rechazado" | "En Cola" = "En Cola", sello: string | null = null, resp: unknown = null, jws: string | null = null;
  try { jws = await firmar(emisor.nit, privPwd, certificado, dte); } catch (e: any) { return bad("No se pudo firmar el documento: " + e.message, 502); }
  try {
    const rc = await recepcion(emisor.nit, apiKey, ambiente, { version: dte.identificacion.version, tipoDte: tipo, documento: jws, codigoGeneracion: ctx.codigoGeneracion });
    resp = rc.raw;
    if (rc.estado === "PROCESADO" && rc.selloRecibido) { estado = "Transmitido"; sello = rc.selloRecibido; } else estado = "Rechazado";
  } catch (e: any) {
    estado = e instanceof HaciendaError && e.esContingencia ? "En Cola" : "Rechazado";
    resp = { error: String(e?.message ?? e) };
  }

  const { fec } = fechaSV();
  const { data: row, error: ei } = await db.from("dtes").insert({
    comercio_id: user.id, tipo_dte: tipo, numero_control: ctx.numeroControl, codigo_generacion: ctx.codigoGeneracion, estado_dte: estado, sello_recepcion: sello,
    receptor_nombre: r.nombre || "Consumidor Final", total_pagar: k.total, total_iva: k.totalIva, fecha_emision: fec, json_dte: dte, json_firmado: jws, respuesta_mh: resp,
  }).select("id").single();
  if (ei) return bad("El documento se procesó pero no se pudo guardar: " + ei.message, 500);

  return NextResponse.json({ id: row.id, estado, sello, respuesta: resp, ticket: {
    tipo, numeroControl: ctx.numeroControl, codigoGeneracion: ctx.codigoGeneracion, fecha: dte.identificacion.fecEmi + " " + dte.identificacion.horEmi, estado, sello,
    emisor: { nombre: emisor.nombre, comercial: emisor.nombreComercial, nit: emisor.nit, nrc: emisor.nrc, correo: emisor.correo },
    receptor: r.nombre || "Consumidor Final", documento: r.numDocumento ?? null,
    lineas, subtotal: k.totalGravada, gravadas: k.totalGravada, iva: tipo === "03" ? k.totalIva : null, retencion: k.ivaRete1, total: k.total } });
}
