// AES-256-GCM. La llave maestra vive SOLO en variables de entorno del servidor (CRED_ENC_KEY, 32 bytes en base64).
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function masterKey(): Buffer {
  const k = Buffer.from(process.env.CRED_ENC_KEY ?? "", "base64");
  if (k.length !== 32) throw new Error("CRED_ENC_KEY debe ser de 32 bytes en base64 (openssl rand -base64 32)");
  return k;
}
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", masterKey(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}
export function decrypt(payload: string): string {
  const [v, iv, tag, data] = payload.split(":");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Formato cifrado inválido");
  const d = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}
