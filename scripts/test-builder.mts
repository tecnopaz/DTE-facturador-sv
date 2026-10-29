import assert from "node:assert/strict";
import { calcular, buildFE, buildCCF, totalEnLetras, numeroControl } from "../src/lib/dte/builder.ts";
import { encrypt, decrypt } from "../src/lib/crypto.ts";
const em: any = { nit: "06141234567890".slice(0,14), nrc: "123456", nombre: "X", codActividad: "47190", descActividad: "Venta", nombreComercial: "X", direccion: { departamento: "06", municipio: "14", complemento: "Calle 1" }, telefono: "70000000", correo: "a@b.com", codEstable: "M001", codPuntoVenta: "P001" };
// Factura: $23.00 × 1 = $23.00, sin IVA extra
let k = calcular("01", [{ descripcion: "a", cantidad: 1, precio: 23 }]); assert.equal(k.total, 23); assert.equal(k.totalIva, 2.65);
k = calcular("01", [{ descripcion: "a", cantidad: 3, precio: 23 }]); assert.equal(k.total, 69);
// CCF: neto 100 => IVA 13, total 113; con retención 1% => 112
k = calcular("03", [{ descripcion: "a", cantidad: 1, precio: 100 }]); assert.equal(k.total, 113);
k = calcular("03", [{ descripcion: "a", cantidad: 1, precio: 100 }], true); assert.equal(k.ivaRete1, 1); assert.equal(k.total, 112);
assert.equal(totalEnLetras(23), "VEINTITRES 00/100 DÓLARES");
assert.equal(totalEnLetras(1234.5), "MIL DOSCIENTOS TREINTA Y CUATRO 50/100 DÓLARES");
assert.equal(totalEnLetras(200), "DOSCIENTOS 00/100 DÓLARES");
assert.equal(totalEnLetras(21000), "VEINTIUN MIL 00/100 DÓLARES");
assert.equal(numeroControl("01", "M001", "P001", 1), "DTE-01-M001P001-000000000000001");
const fe: any = buildFE({ emisor: em, ambiente: "00", numeroControl: "DTE-01-M001P001-000000000000001", codigoGeneracion: "ABC" }, null, [{ descripcion: "Venta Libre", cantidad: 1, precio: 23 }]);
assert.equal(fe.resumen.totalPagar, 23); assert.equal(fe.resumen.totalGravada, 23); assert.equal(fe.receptor, null); assert.equal(fe.identificacion.version, 1);
const cc: any = buildCCF({ emisor: em, ambiente: "00", numeroControl: "x", codigoGeneracion: "y" }, { numDocumento: "06141234567890", nrc: "1", nombre: "C", codActividad: "1", descActividad: "d", direccion: em.direccion, correo: "c@d.com" }, [{ descripcion: "a", cantidad: 2, precio: 50 }]);
assert.equal(cc.resumen.tributos[0].valor, 13); assert.equal(cc.resumen.totalPagar, 113); assert.equal(cc.identificacion.version, 3);
process.env.CRED_ENC_KEY = Buffer.alloc(32, 7).toString("base64");
const e = encrypt("secreto ñ"); assert.notEqual(e, "secreto ñ"); assert.equal(decrypt(e), "secreto ñ");
assert.throws(() => decrypt(e.slice(0, -4) + "AAAA"));
console.log("TODAS LAS PRUEBAS OK");
