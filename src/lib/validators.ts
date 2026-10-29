export const DUI_RE = /^\d{8}-\d{1}$/;
export const soloDigitos = (s?: string) => (s ?? "").replace(/\D/g, "");
export const esDUI = (s?: string) => DUI_RE.test((s ?? "").trim());
/** NIT: 14 dígitos (o 9 en el formato antiguo), sin guiones, como lo exige el esquema JSON. */
export const normNIT = (s?: string) => { const d = soloDigitos(s); return d.length === 14 || d.length === 9 ? d : null; };
/** NRC: 1 a 8 dígitos, sin guion. */
export const normNRC = (s?: string) => { const d = soloDigitos(s); return d.length >= 1 && d.length <= 8 ? d : null; };
export const esCorreo = (s?: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s ?? "");
/** URL del firmador del cliente: solo https, dominio público (sin localhost, IP literales ni credenciales en la URL). */
export function urlFirmadorSegura(u?: string): string | null {
  try {
    const x = new URL((u ?? "").trim());
    if (x.protocol !== "https:" || x.username || x.password || (x.port && x.port !== "443")) return null;
    const h = x.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".")) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(":")) return null;
    return x.toString();
  } catch { return null; }
}
export const DEPARTAMENTOS: Record<string, string> = {
  "01": "Ahuachapán", "02": "Santa Ana", "03": "Sonsonate", "04": "Chalatenango", "05": "La Libertad", "06": "San Salvador", "07": "Cuscatlán",
  "08": "La Paz", "09": "Cabañas", "10": "San Vicente", "11": "Usulután", "12": "San Miguel", "13": "Morazán", "14": "La Unión",
};
