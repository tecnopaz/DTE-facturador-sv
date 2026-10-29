# DTE Facturador Express (SaaS multi-tenant · Next.js + Supabase + Vercel)

## Puesta en marcha
1. Supabase: crea un proyecto y ejecuta `supabase/schema.sql` completo en el SQL Editor.
2. `cp .env.example .env.local` y completa las variables (CRED_ENC_KEY: `openssl rand -base64 32`).
3. `npm install && npm test && npm run dev`.
4. Firmador CENTRAL: despliega `firmador-gateway/` junto al firmador oficial de Hacienda (ver su README) y pon FIRMADOR_URL y FIRMADOR_TOKEN en Vercel.
5. Vercel: SUPABASE_SERVICE_ROLE_KEY, CRED_ENC_KEY, FIRMADOR_URL y FIRMADOR_TOKEN (secretas, sin prefijo NEXT_PUBLIC_). El certificado y las credenciales de cada cliente viven cifrados en Supabase.

## Antes de producción (obligatorio)
- Probar TODO en ambiente de PRUEBAS (`ambiente = 00`, apitest.dtes.mh.gob.sv) y completar el proceso de autorización/homologación de Hacienda.
- Validar los JSON generados contra los esquemas oficiales vigentes (factura.gob.sv) con un validador JSON Schema (ajv).
- Importar el catálogo oficial de municipios (CAT-013) y actividades económicas (CAT-019) vigentes.
- Contingencia: el estado "En Cola" guarda el DTE firmado; falta el reenvío automático y el evento de contingencia exigido por Hacienda.
