// Gateway del firmador central. Recibe {nit, passwordPri, certificado, dteJson}, coloca el certificado del cliente SOLO en un directorio
// en memoria (tmpfs) durante la firma, llama al firmador oficial de Hacienda (que debe escuchar solo en localhost) y borra el certificado.
import http from "node:http";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";

const PORT = process.env.PORT || 8080;
const TOKEN = process.env.GATEWAY_TOKEN || "";
const LOCAL = process.env.FIRMADOR_LOCAL_URL || "http://127.0.0.1:8113/firmardocumento/";
const DIR = process.env.FIRMADOR_CERT_DIR || "/dev/shm/uploads";
const NAME = process.env.FIRMADOR_CERT_NAME || "{nit}.crt"; // VERIFICA el nombre que espera tu versión del firmador oficial
if (TOKEN.length < 32) throw new Error("GATEWAY_TOKEN requerido (mínimo 32 caracteres)");

const locks = new Map(); // un solo firmado a la vez por NIT (el firmador lee el certificado por nombre de archivo)
const withLock = (k, fn) => {
  const next = (locks.get(k) ?? Promise.resolve()).catch(() => {}).then(fn);
  locks.set(k, next);
  next.finally(() => { if (locks.get(k) === next) locks.delete(k); }).catch(() => {});
  return next;
};
const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const send = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
const readBody = (req, max = 1_000_000) => new Promise((ok, no) => {
  let n = 0; const c = [];
  req.on("data", (d) => { n += d.length; if (n > max) { no(new Error("Cuerpo demasiado grande")); req.destroy(); } else c.push(d); });
  req.on("end", () => ok(Buffer.concat(c).toString("utf8"))); req.on("error", no);
});

http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/firmar") return send(res, 404, { status: "ERROR", message: "No encontrado" });
  if (!same(req.headers.authorization ?? "", `Bearer ${TOKEN}`)) return send(res, 401, { status: "ERROR", message: "No autorizado" });
  let b;
  try { b = JSON.parse(await readBody(req)); } catch { return send(res, 400, { status: "ERROR", message: "JSON inválido" }); }
  const { nit, passwordPri, certificado, dteJson } = b ?? {};
  if (!/^\d{9,14}$/.test(nit ?? "") || !passwordPri || !certificado || typeof dteJson !== "object") return send(res, 400, { status: "ERROR", message: "Datos incompletos" });
  const file = join(DIR, NAME.replace("{nit}", nit));
  try {
    const out = await withLock(nit, async () => {
      await mkdir(DIR, { recursive: true });
      await writeFile(file, certificado, { mode: 0o600 });
      try {
        const r = await fetch(LOCAL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nit, activo: true, passwordPri, dteJson }), signal: AbortSignal.timeout(12000) });
        return await r.json();
      } finally { await unlink(file).catch(() => {}); }
    });
    send(res, 200, out);
  } catch (e) { send(res, 502, { status: "ERROR", message: "Firmador no disponible" }); } // sin registrar datos del cliente
}).listen(PORT, () => console.log("firmador-gateway en :" + PORT));
