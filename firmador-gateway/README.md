# Firmador central (gateway)
Despliégalo en el MISMO host/contenedor que el firmador oficial de Hacienda (svfe-api-firmador, Java).
- El firmador oficial debe escuchar solo en 127.0.0.1:8113 (no público).
- Este gateway es lo único público, detrás de HTTPS, con `GATEWAY_TOKEN` (mínimo 32 caracteres; el mismo valor va en Vercel como FIRMADOR_TOKEN).
- `FIRMADOR_CERT_DIR` debe ser la carpeta de certificados que lee el firmador, montada en memoria (tmpfs, p. ej. /dev/shm/uploads), para que el certificado nunca toque el disco.
- Inicio: `GATEWAY_TOKEN=... node server.mjs` (Node 18+).
- Verifica con la documentación de Hacienda: nombre de archivo del certificado (`FIRMADOR_CERT_NAME`), ruta y cuerpo del firmador.
