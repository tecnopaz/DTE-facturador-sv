// Construcción de los JSON de DTE: 01 Factura (v1) y 03 Comprobante de Crédito Fiscal (v3).
// Verifica SIEMPRE el resultado contra los esquemas oficiales vigentes (repositorio de esquemas + factura.gob.sv).
export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const IVA = 0.13;

export type Linea = { codigo?: string; descripcion: string; cantidad: number; precio: number };
export type Direccion = { departamento: string; municipio: string; complemento: string };
export type Emisor = {
  nit: string; nrc: string; nombre: string; codActividad: string; descActividad: string; nombreComercial: string;
  direccion: Direccion; telefono: string; correo: string; codEstable: string; codPuntoVenta: string;
};
export type Receptor = {
  tipoDocumento?: string; numDocumento?: string; nrc?: string; nombre?: string; codActividad?: string; descActividad?: string;
  nombreComercial?: string; direccion?: Direccion; telefono?: string; correo?: string;
};

const U = ["","UNO","DOS","TRES","CUATRO","CINCO","SEIS","SIETE","OCHO","NUEVE","DIEZ","ONCE","DOCE","TRECE","CATORCE","QUINCE","DIECISEIS","DIECISIETE","DIECIOCHO","DIECINUEVE","VEINTE","VEINTIUNO","VEINTIDOS","VEINTITRES","VEINTICUATRO","VEINTICINCO","VEINTISEIS","VEINTISIETE","VEINTIOCHO","VEINTINUEVE"];
const D = ["","","","TREINTA","CUARENTA","CINCUENTA","SESENTA","SETENTA","OCHENTA","NOVENTA"];
const C = ["","CIENTO","DOSCIENTOS","TRESCIENTOS","CUATROCIENTOS","QUINIENTOS","SEISCIENTOS","SETECIENTOS","OCHOCIENTOS","NOVECIENTOS"];
function b1000(n: number): string {
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100), r = n % 100; let s = C[c];
  if (r) { if (s) s += " "; s += r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? " Y " + U[r % 10] : ""); }
  return s;
}
function entero(n: number): string {
  if (n === 0) return "CERO";
  const mill = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1000), r = n % 1000, p: string[] = [];
  if (mill) p.push(mill === 1 ? "UN MILLON" : b1000(mill).replace(/UNO$/, "UN") + " MILLONES");
  if (mil) p.push(mil === 1 ? "MIL" : b1000(mil).replace(/UNO$/, "UN") + " MIL");
  if (r) p.push(b1000(r));
  return p.join(" ");
}
export function totalEnLetras(total: number): string {
  const t = r2(total), e = Math.floor(t), c = Math.round((t - e) * 100);
  return `${entero(e)} ${String(c).padStart(2, "0")}/100 DÓLARES`;
}

export function fechaSV(d = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/El_Salvador", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return { fec: `${g("year")}-${g("month")}-${g("day")}`, hor: `${g("hour")}:${g("minute")}:${g("second")}` };
}
/** DTE-01-M001P001-000000000000001  (8 caracteres de establecimiento+punto de venta, 15 dígitos de correlativo) */
export const numeroControl = (tipo: string, estable: string, pv: string, n: number) =>
  `DTE-${tipo}-${estable}${pv}-${String(n).padStart(15, "0")}`;

/** Cálculo puro, reutilizado por la validación previa y por la construcción del JSON. */
export function calcular(tipo: "01" | "03", lineas: Linea[], retener = false) {
  if (tipo === "01") {
    // FACTURA: el precio YA incluye IVA. Total = cantidad × precio. No se suma 13% extra.
    const items = lineas.map((l) => { const g = r2(l.cantidad * l.precio); return { gravada: g, iva: r2((g / (1 + IVA)) * IVA) }; });
    const totalGravada = r2(items.reduce((a, i) => a + i.gravada, 0));
    const totalIva = r2(items.reduce((a, i) => a + i.iva, 0));
    return { items, totalGravada, totalIva, ivaRete1: 0, total: totalGravada };
  }
  // CCF: el precio es NETO; el IVA se suma.
  const items = lineas.map((l) => { const g = r2(l.cantidad * l.precio); return { gravada: g, iva: r2(g * IVA) }; });
  const totalGravada = r2(items.reduce((a, i) => a + i.gravada, 0));
  const totalIva = r2(totalGravada * IVA);
  const ivaRete1 = retener && totalGravada >= 100 ? r2(totalGravada * 0.01) : 0;
  return { items, totalGravada, totalIva, ivaRete1, total: r2(totalGravada + totalIva - ivaRete1) };
}

type Ctx = { emisor: Emisor; ambiente: "00" | "01"; numeroControl: string; codigoGeneracion: string; ahora?: Date };

function identificacion(tipo: string, version: number, c: Ctx) {
  const { fec, hor } = fechaSV(c.ahora);
  return { version, ambiente: c.ambiente, tipoDte: tipo, numeroControl: c.numeroControl, codigoGeneracion: c.codigoGeneracion,
    tipoModelo: 1, tipoOperacion: 1, tipoContingencia: null, motivoContin: null, fecEmi: fec, horEmi: hor, tipoMoneda: "USD" };
}
function emisorJson(e: Emisor, extra: object) {
  return { nit: e.nit, nrc: e.nrc, nombre: e.nombre, codActividad: e.codActividad, descActividad: e.descActividad, nombreComercial: e.nombreComercial,
    tipoEstablecimiento: "02", direccion: e.direccion, telefono: e.telefono, correo: e.correo, ...extra };
}

export function buildFE(c: Ctx, receptor: Receptor | null, lineas: Linea[]) {
  const k = calcular("01", lineas);
  const cuerpo = lineas.map((l, i) => ({ numItem: i + 1, tipoItem: 1, numeroDocumento: null, cantidad: l.cantidad, codigo: l.codigo ?? null, codTributo: null,
    uniMedida: 59, descripcion: l.descripcion, precioUni: l.precio, montoDescu: 0, ventaNoSuj: 0, ventaExenta: 0, ventaGravada: k.items[i].gravada,
    tributos: null, psv: 0, noGravado: 0, ivaItem: k.items[i].iva }));
  return {
    identificacion: identificacion("01", 1, c),
    documentoRelacionado: null,
    emisor: emisorJson(c.emisor, { codEstableMH: null, codEstable: c.emisor.codEstable, codPuntoVentaMH: null, codPuntoVenta: c.emisor.codPuntoVenta }),
    receptor: receptor && (receptor.nombre || receptor.numDocumento)
      ? { tipoDocumento: receptor.tipoDocumento ?? null, numDocumento: receptor.numDocumento ?? null, nrc: null, nombre: receptor.nombre ?? null,
          codActividad: null, descActividad: null, direccion: null, telefono: receptor.telefono ?? null, correo: receptor.correo ?? null }
      : null,
    otrosDocumentos: null, ventaTercero: null, cuerpoDocumento: cuerpo,
    resumen: { totalNoSuj: 0, totalExenta: 0, totalGravada: k.totalGravada, subTotalVentas: k.totalGravada, descuNoSuj: 0, descuExenta: 0, descuGravada: 0,
      porcentajeDescuento: 0, totalDescu: 0, tributos: null, subTotal: k.totalGravada, ivaRete1: 0, reteRenta: 0, montoTotalOperacion: k.total,
      totalNoGravado: 0, totalPagar: k.total, totalLetras: totalEnLetras(k.total), totalIva: k.totalIva, saldoFavor: 0, condicionOperacion: 1,
      pagos: [{ codigo: "01", montoPago: k.total, referencia: null, plazo: null, periodo: null }], numPagoElectronico: null },
    extension: null, apendice: null,
  };
}

export function buildCCF(c: Ctx, receptor: Receptor, lineas: Linea[], retener = false) {
  const k = calcular("03", lineas, retener);
  const cuerpo = lineas.map((l, i) => ({ numItem: i + 1, tipoItem: 1, numeroDocumento: null, codigo: l.codigo ?? null, codTributo: null, descripcion: l.descripcion,
    cantidad: l.cantidad, uniMedida: 59, precioUni: l.precio, montoDescu: 0, ventaNoSuj: 0, ventaExenta: 0, ventaGravada: k.items[i].gravada,
    tributos: ["20"], psv: 0, noGravado: 0 }));
  return {
    identificacion: identificacion("03", 3, c),
    documentoRelacionado: null,
    emisor: emisorJson(c.emisor, { codEstableMH: null, codEstable: c.emisor.codEstable, codPuntoVentaMH: null, codPuntoVenta: c.emisor.codPuntoVenta }),
    receptor: { nit: receptor.numDocumento, nrc: receptor.nrc, nombre: receptor.nombre, codActividad: receptor.codActividad, descActividad: receptor.descActividad,
      nombreComercial: receptor.nombreComercial ?? null, direccion: receptor.direccion, telefono: receptor.telefono ?? null, correo: receptor.correo },
    otrosDocumentos: null, ventaTercero: null, cuerpoDocumento: cuerpo,
    resumen: { totalNoSuj: 0, totalExenta: 0, totalGravada: k.totalGravada, subTotalVentas: k.totalGravada, descuNoSuj: 0, descuExenta: 0, descuGravada: 0,
      porcentajeDescuento: 0, totalDescu: 0,
      tributos: [{ codigo: "20", descripcion: "Impuesto al Valor Agregado 13%", valor: k.totalIva }],
      subTotal: k.totalGravada, ivaPerci1: 0, ivaRete1: k.ivaRete1, reteRenta: 0, montoTotalOperacion: r2(k.totalGravada + k.totalIva),
      totalNoGravado: 0, totalPagar: k.total, totalLetras: totalEnLetras(k.total), saldoFavor: 0, condicionOperacion: 1,
      pagos: [{ codigo: "01", montoPago: k.total, referencia: null, plazo: null, periodo: null }], numPagoElectronico: null },
    extension: null, apendice: null,
  };
}
