// Cliente del API de Hacienda (recepción DTE). VERIFICA rutas, cuerpos y límites contra la documentación técnica vigente en factura.gob.sv.
export const BASE = { "00": "https://apitest.dtes.mh.gob.sv", "01": "https://api.dtes.mh.gob.sv" } as const;
export type Ambiente = keyof typeof BASE;

export class HaciendaError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
  /** Timeout / caída del servidor => contingencia (En Cola) */
  get esContingencia() { return this.status === 0 || this.status >= 500; }
}
const TIMEOUT_MS = 5000;
async function call(url: string, init: RequestInit) {
  try { return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" }); }
  catch (e) { throw new HaciendaError(0, "Timeout o sin conexión con Hacienda"); }
}

// Token JWT: se reutiliza y se renueva antes de vencer (margen de 1 hora sobre las 24 h). Cache en memoria por instancia.
const cache = new Map<string, { token: string; exp: number }>();
export async function obtenerToken(nit: string, apiPwd: string, amb: Ambiente, force = false): Promise<string> {
  const key = `${amb}:${nit}`, hit = cache.get(key);
  if (!force && hit && hit.exp > Date.now()) return hit.token;
  const r = await call(`${BASE[amb]}/seguridad/auth`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "DTE-Facturador-Express/1.0" },
    body: new URLSearchParams({ user: nit, pwd: apiPwd }),
  });
  if (r.status >= 500) throw new HaciendaError(r.status, "Hacienda no disponible");
  const j: any = await r.json().catch(() => ({}));
  const token = j?.body?.token;
  if (!r.ok || j?.status !== "OK" || !token) throw new HaciendaError(r.status, "Credenciales de Hacienda rechazadas: " + (j?.message ?? r.status));
  cache.set(key, { token, exp: Date.now() + 23 * 3600e3 });
  return token; // ya incluye el prefijo "Bearer "
}

/** Firma vía el firmador CENTRAL de la plataforma (gateway propio, ver /firmador-gateway). El certificado y la contraseña del cliente
 *  se descifran en memoria solo durante esta llamada y viajan por HTTPS autenticado; el gateway no los persiste. */
export async function firmar(nit: string, passwordPri: string, certificado: string, dteJson: object): Promise<string> {
  const url = process.env.FIRMADOR_URL, token = process.env.FIRMADOR_TOKEN;
  if (!url || !token) throw new Error("Firmador central no configurado (FIRMADOR_URL / FIRMADOR_TOKEN)");
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ nit, passwordPri, certificado, dteJson }), signal: AbortSignal.timeout(15000), redirect: "error" });
  const j: any = await r.json().catch(() => ({}));
  if (j?.status !== "OK" || typeof j?.body !== "string") throw new Error("Firma fallida: " + JSON.stringify(j?.error ?? j?.message ?? j).slice(0, 300));
  return j.body; // JWS
}

export type Recepcion = { http: number; estado?: string; selloRecibido?: string | null; descripcionMsg?: string; observaciones?: string[]; raw: unknown };
export async function recepcion(nit: string, apiPwd: string, amb: Ambiente, p: { version: number; tipoDte: string; documento: string; codigoGeneracion: string }): Promise<Recepcion> {
  const body = JSON.stringify({ ambiente: amb, idEnvio: 1, version: p.version, tipoDte: p.tipoDte, documento: p.documento, codigoGeneracion: p.codigoGeneracion });
  for (let intento = 0; intento < 2; intento++) {
    const token = await obtenerToken(nit, apiPwd, amb, intento > 0);
    const r = await call(`${BASE[amb]}/fesv/recepciondte`, { method: "POST", headers: { Authorization: token, "Content-Type": "application/json", "User-Agent": "DTE-Facturador-Express/1.0" }, body });
    if (r.status === 401 && intento === 0) continue; // token vencido: renovar y reintentar una vez
    if (r.status >= 500) throw new HaciendaError(r.status, "Hacienda no disponible");
    const j: any = await r.json().catch(() => ({}));
    return { http: r.status, estado: j?.estado, selloRecibido: j?.selloRecibido ?? null, descripcionMsg: j?.descripcionMsg, observaciones: j?.observaciones, raw: j };
  }
  throw new HaciendaError(401, "No autorizado");
}
