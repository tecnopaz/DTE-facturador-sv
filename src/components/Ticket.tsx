"use client";
export type TicketData = {
  tipo: "01" | "03"; numeroControl: string; codigoGeneracion: string; fecha: string; estado: "Transmitido" | "Rechazado" | "En Cola"; sello: string | null;
  emisor: { nombre: string; comercial: string; nit: string; nrc: string; correo: string };
  receptor: string; documento: string | null; lineas: { descripcion: string; cantidad: number; precio: number }[];
  subtotal: number; gravadas: number; iva: number | null; retencion: number; total: number;
};
const m = (n: number) => "$" + n.toFixed(2);
const ZZ = "polygon(0 0,100% 0,100% calc(100% - 8px),95% 100%,90% calc(100% - 8px),85% 100%,80% calc(100% - 8px),75% 100%,70% calc(100% - 8px),65% 100%,60% calc(100% - 8px),55% 100%,50% calc(100% - 8px),45% 100%,40% calc(100% - 8px),35% 100%,30% calc(100% - 8px),25% 100%,20% calc(100% - 8px),15% 100%,10% calc(100% - 8px),5% 100%,0 calc(100% - 8px))";

export default function Ticket({ d, onClose }: { d: TicketData; onClose: () => void }) {
  const wa = () => {
    const t = `*${d.emisor.comercial}*\n${d.tipo === "01" ? "Factura" : "Comprobante de Crédito Fiscal"}\nN° control: ${d.numeroControl}\nCódigo: ${d.codigoGeneracion}\n*Total: ${m(d.total)}*\n` +
      (d.estado === "Transmitido" ? `Sello: ${d.sello}` : d.estado === "En Cola" ? "DOCUMENTO EN CONTINGENCIA: pendiente de transmisión a Hacienda" : "Documento rechazado");
    window.open("https://wa.me/?text=" + encodeURIComponent(t), "_blank");
  };
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/85 overflow-y-auto p-5 flex flex-col items-center">
      <div className="ticket bg-white text-black w-full max-w-[300px] p-4 text-[12px] leading-5 shadow-2xl" style={{ clipPath: ZZ }}>
        <p className="text-center font-bold text-sm">{d.emisor.comercial}</p>
        <p className="text-center">{d.emisor.nombre}</p><p className="text-center">NIT {d.emisor.nit} · NRC {d.emisor.nrc}</p><p className="text-center">{d.emisor.correo}</p>
        <p className="text-center font-bold mt-1">{d.tipo === "01" ? "FACTURA" : "COMPROBANTE DE CRÉDITO FISCAL"}</p><p className="text-center">{d.fecha}</p>
        <p className="border-t border-dashed border-slate-400 mt-2 pt-2">Cliente: {d.receptor}</p>{d.documento && <p>Doc: {d.documento}</p>}
        <div className="border-t border-dashed border-slate-400 mt-2 pt-2">
          {d.lineas.map((l, i) => (<p key={i} className="flex justify-between gap-2"><span>{l.cantidad} x {l.descripcion}</span><span>{m(l.cantidad * l.precio)}</span></p>))}
        </div>
        <div className="border-t border-dashed border-slate-400 mt-2 pt-2">
          {d.tipo === "01" ? (<>
            <p className="flex justify-between"><span>Subtotal</span><span>{m(d.subtotal)}</span></p>
            <p className="flex justify-between"><span>Ventas Gravadas</span><span>{m(d.gravadas)}</span></p>
          </>) : (<>
            <p className="flex justify-between"><span>Ventas Gravadas</span><span>{m(d.gravadas)}</span></p>
            <p className="flex justify-between"><span>IVA 13%</span><span>{m(d.iva ?? 0)}</span></p>
            {d.retencion > 0 && <p className="flex justify-between"><span>(-) IVA Retenido 1%</span><span>-{m(d.retencion)}</span></p>}
          </>)}
          <p className="flex justify-between font-bold text-sm"><span>TOTAL A PAGAR</span><span>{m(d.total)}</span></p>
        </div>
        <p className="border-t border-dashed border-slate-400 mt-2 pt-2 break-all">N° de Control: {d.numeroControl}</p>
        <p className="break-all">Cód. Generación: {d.codigoGeneracion}</p>
        <p className="break-all">Sello de Recepción: {d.sello ?? "— pendiente —"}</p>
        <p className={`text-center font-bold mt-2 ${d.estado === "Transmitido" ? "text-emerald-700" : d.estado === "En Cola" ? "text-amber-600" : "text-rose-600"}`}>
          {d.estado === "Transmitido" ? "✔ TRANSMITIDO A HACIENDA" : d.estado === "En Cola" ? "⏳ EN CONTINGENCIA" : "✖ RECHAZADO POR HACIENDA"}</p>
        <p className="text-center text-[10px] mt-1">Este documento es una representación gráfica de un Documento Tributario Electrónico</p>
      </div>
      <div className="w-full max-w-[300px] mt-4 space-y-2">
        <button onClick={wa} className="w-full py-3 rounded-2xl bg-emerald-600 text-white font-bold">Enviar Ticket por WhatsApp</button>
        <button onClick={onClose} className="w-full py-3 rounded-2xl bg-white text-slate-900 font-semibold">Cerrar</button>
      </div>
    </div>
  );
}
