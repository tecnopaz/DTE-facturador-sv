"use client";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-browser";
import Ticket, { type TicketData } from "@/components/Ticket";
import { DEPARTAMENTOS, DUI_RE } from "@/lib/validators";

const card = "bg-white rounded-2xl p-4 shadow-sm space-y-3";
const btn = "w-full py-3 rounded-2xl font-bold text-white bg-emerald-600 disabled:bg-slate-300 disabled:text-slate-500";
const money = (n: number) => "$" + (Math.round(n * 100) / 100).toFixed(2);
async function api(path: string, body: unknown, s: Session) {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.access_token}` }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error ?? "Error"); return j;
}

export default function Home() {
  const [s, setS] = useState<Session | null>(null), [ready, setReady] = useState(false), [perfil, setPerfil] = useState<any>(null);
  const loadPerfil = useCallback(async (uid: string) => { const { data } = await supabase.from("perfil_comercio").select("*").eq("id", uid).single(); setPerfil(data); }, []);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setS(data.session); setReady(true); if (data.session) loadPerfil(data.session.user.id); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, ses) => { setS(ses); if (ses) loadPerfil(ses.user.id); else setPerfil(null); });
    return () => sub.subscription.unsubscribe();
  }, [loadPerfil]);
  if (!ready) return <div className="min-h-screen grid place-items-center text-white">Cargando…</div>;
  if (!s) return <Auth />;
  if (!perfil) return <div className="min-h-screen grid place-items-center text-white">Cargando…</div>;
  if (!perfil.onboarding_completo) return <Onboarding s={s} perfil={perfil} done={() => loadPerfil(s.user.id)} email={s.user.email ?? ""} />;
  return <Panel s={s} perfil={perfil} reload={() => loadPerfil(s.user.id)} />;
}

function Auth() {
  const [reg, setReg] = useState(true), [email, setEmail] = useState(""), [pw, setPw] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setMsg("");
    const { data, error } = reg ? await supabase.auth.signUp({ email, password: pw }) : await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) setMsg(error.message); else if (reg && !data.session) setMsg("Revisa tu correo para confirmar la cuenta y luego inicia sesión.");
  };
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-blue-950 text-white p-6 flex flex-col justify-center max-w-md mx-auto">
      <div className="text-center mb-5"><div className="w-16 h-16 rounded-2xl bg-emerald-600 mx-auto grid place-items-center text-3xl mb-3">🧾</div>
        <h1 className="text-2xl font-extrabold">DTE Facturador Express</h1><p className="text-slate-300 text-sm">{reg ? "Crea tu cuenta" : "Inicia sesión"}</p></div>
      <div className="bg-white rounded-2xl p-4 space-y-3 text-slate-900">
        <input type="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Contraseña (mínimo 8 caracteres)" value={pw} onChange={(e) => setPw(e.target.value)} />
        {msg && <p className="text-rose-600 text-sm">{msg}</p>}
        <button className={btn} disabled={busy || !email || pw.length < 8} onClick={go}>{reg ? "Crear cuenta (24 h gratis)" : "Entrar"}</button>
        <button className="w-full text-sm text-slate-500 underline" onClick={() => setReg(!reg)}>{reg ? "Ya tengo cuenta" : "No tengo cuenta"}</button>
      </div>
    </main>
  );
}

function Onboarding({ s, done, email, perfil }: { s: Session; done: () => void; email: string; perfil?: any }) {
  const g = (k: string, d = "") => String(perfil?.[k] ?? d);
  const [f, setF] = useState<Record<string, string>>({ email_emisor: g("email_emisor", email), ambiente: g("ambiente", "00"), departamento: g("departamento", "06"), nombre_razon_social: g("nombre_razon_social"), nombre_comercial: g("nombre_comercial"), nit_emisor: g("nit_emisor"), nrc_emisor: g("nrc_emisor"), dui_propietario: g("dui_propietario"), telefono: g("telefono"), cod_actividad: g("cod_actividad"), giro_actividad: g("giro_actividad"), municipio: g("municipio"), direccion_complemento: g("direccion_complemento") }), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const file = async (e: any) => { const t = await e.target.files?.[0]?.text(); if (t) setF({ ...f, hacienda_private_key: t }); };
  const F = ({ k, p, type = "text" }: { k: string; p: string; type?: string }) => <input type={type} placeholder={p} value={f[k] ?? ""} onChange={set(k)} />;
  const send = async () => { setBusy(true); setErr(""); try { await api("/api/onboarding", f, s); done(); } catch (e: any) { setErr(e.message); } setBusy(false); };
  return (
    <main className="min-h-screen bg-slate-100 max-w-md mx-auto p-4 space-y-4">
      <div className="bg-slate-900 text-white rounded-2xl p-4"><h1 className="font-bold text-lg">Configura tu comercio</h1><p className="text-sm text-slate-300">Obligatorio antes de emitir. Estos datos los exige Hacienda.</p></div>
      <div className={card}><p className="font-bold">Datos del comercio</p>
        {F({ k: "nombre_razon_social", p: "Nombre o Razón Social" })}{F({ k: "nombre_comercial", p: "Nombre Comercial" })}{F({ k: "nit_emisor", p: "NIT del emisor (0000-000000-000-0)" })}{F({ k: "nrc_emisor", p: "NRC del emisor" })}
        {F({ k: "dui_propietario", p: "DUI del propietario (00000000-0)" })}{F({ k: "email_emisor", p: "Correo del emisor", type: "email" })}{F({ k: "telefono", p: "Teléfono" })}
        {F({ k: "cod_actividad", p: "Código de actividad económica (catálogo CAT-019)" })}{F({ k: "giro_actividad", p: "Giro / Actividad económica" })}</div>
      <div className={card}><p className="font-bold">Dirección</p>
        <select value={f.departamento} onChange={set("departamento")}>{Object.entries(DEPARTAMENTOS).map(([c, n]) => <option key={c} value={c}>{c} · {n}</option>)}</select>
        {F({ k: "municipio", p: "Código de municipio (2 dígitos, catálogo oficial CAT-013)" })}{F({ k: "direccion_complemento", p: "Dirección complementaria" })}</div>
      <div className={card}><p className="font-bold">Credenciales de Hacienda</p>
        <select value={f.ambiente} onChange={set("ambiente")}><option value="00">Ambiente de PRUEBAS</option><option value="01">PRODUCCIÓN</option></select>
        {F({ k: "hacienda_api_key", p: "API Key / contraseña del API de Hacienda", type: "password" })}
        <label className="text-xs text-slate-500">Certificado de firma electrónica (.crt) que te entregó Hacienda</label><input type="file" onChange={file} />
        {F({ k: "hacienda_password", p: "Contraseña de la llave privada", type: "password" })}
        <p className="text-xs text-slate-500">Tu certificado y credenciales se cifran con AES-256-GCM en el servidor y solo se usan para firmar y transmitir tus documentos. Por seguridad no se muestran de nuevo: al editar hay que volver a cargarlos.</p></div>
      {err && <p className="text-rose-600 text-sm">{err}</p>}
      <button className={btn} disabled={busy} onClick={send}>Guardar y continuar</button>
    </main>
  );
}

function Panel({ s, perfil, reload }: { s: Session; perfil: any; reload: () => void }) {
  const [tab, setTab] = useState<"emitir" | "hist" | "ajustes">("emitir"), [ticket, setTicket] = useState<TicketData | null>(null);
  const left = Math.max(0, Math.ceil((new Date(perfil.licencia_hasta ?? perfil.trial_hasta).getTime() - Date.now()) / 36e5));
  return (
    <main className="min-h-screen max-w-md mx-auto bg-slate-100 pb-24">
      <header className="bg-slate-900 text-white px-5 pt-4 pb-5 rounded-b-3xl flex justify-between items-center">
        <div><p className="text-xs text-slate-400">DTE Facturador Express</p><h1 className="font-bold">{perfil.nombre_comercial}</h1></div>
        <div className="text-right"><span className="text-xs px-3 py-1 rounded-full bg-emerald-600">{perfil.ambiente === "00" ? "Pruebas" : "Producción"}</span>
          <p className="text-[11px] text-slate-400 mt-1">{left} h de licencia</p></div>
      </header>
      <div className="p-4">{tab === "emitir" ? <Emitir s={s} done={(t) => setTicket(t)} /> : tab === "hist" ? <Historial uid={s.user.id} /> : <Onboarding s={s} perfil={perfil} email={s.user.email ?? ""} done={() => { reload(); setTab("emitir"); }} />}</div>
      <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-white border-t grid grid-cols-4 pb-2 pt-1 rounded-t-3xl">
        {([["emitir", "Emitir"], ["hist", "Historial"], ["ajustes", "Ajustes"]] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`py-3 mx-1 rounded-2xl text-sm ${tab === k ? "bg-emerald-50 text-emerald-600 font-semibold" : "text-slate-400"}`}>{l}</button>)}
        <button onClick={() => supabase.auth.signOut()} className="py-3 text-sm text-slate-400">Salir</button>
      </nav>
      {ticket && <Ticket d={ticket} onClose={() => setTicket(null)} />}
    </main>
  );
}

function Emitir({ s, done }: { s: Session; done: (t: TicketData) => void }) {
  const [tipo, setTipo] = useState<"01" | "03">("01"), [desc, setDesc] = useState("Venta Libre"), [cant, setCant] = useState("1"), [precio, setPrecio] = useState("");
  const [r, setR] = useState<Record<string, string>>({ departamento: "06" }), [retener, setRetener] = useState(false), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setR({ ...r, [k]: e.target.value });
  const c = Number(cant) || 0, p = Number(precio) || 0, neto = Math.round(c * p * 100) / 100;
  const total = tipo === "01" ? neto : Math.round((neto + neto * 0.13 - (retener && neto >= 100 ? neto * 0.01 : 0)) * 100) / 100;
  const req200 = tipo === "01" && total >= 200, duiOk = DUI_RE.test((r.numDocumento ?? "").trim()) && !!(r.nombre ?? "").trim();
  const ccfOk = tipo === "03" ? ["numDocumento", "nrc", "nombre", "codActividad", "descActividad", "municipio", "complemento", "correo"].every((k) => (r[k] ?? "").trim()) : true;
  const bloqueado = !(c > 0 && p > 0 && desc.trim()) || (req200 && !duiOk) || !ccfOk || busy;
  const emitir = async () => {
    setBusy(true); setErr("");
    const receptor = tipo === "01" ? { tipoDocumento: r.numDocumento ? "13" : undefined, numDocumento: r.numDocumento?.trim() || undefined, nombre: r.nombre?.trim() || undefined }
      : { tipoDocumento: "36", numDocumento: r.numDocumento, nrc: r.nrc, nombre: r.nombre, codActividad: r.codActividad, descActividad: r.descActividad, correo: r.correo,
          direccion: { departamento: r.departamento, municipio: r.municipio, complemento: r.complemento } };
    try { const j = await api("/api/dte/emitir", { tipo, lineas: [{ descripcion: desc, cantidad: c, precio: p }], receptor, retener }, s); done(j.ticket); setPrecio(""); }
    catch (e: any) { setErr(e.message); } setBusy(false);
  };
  return (
    <div className="space-y-3">
      <div className="bg-slate-900 p-1 rounded-full flex">{([["01", "Factura"], ["03", "Crédito Fiscal"]] as const).map(([k, l]) =>
        <button key={k} onClick={() => setTipo(k)} className={`flex-1 py-2 rounded-full text-sm font-semibold ${tipo === k ? "bg-white text-slate-900" : "text-slate-300"}`}>{l}</button>)}</div>
      <div className={card}>
        <label className="text-xs font-semibold text-slate-500">Descripción (editable)</label><input value={desc} onChange={(e) => setDesc(e.target.value)} />
        <div className="flex gap-3"><div className="w-24"><label className="text-xs font-semibold text-slate-500">Cant.</label><input inputMode="numeric" value={cant} onChange={(e) => setCant(e.target.value)} /></div>
          <div className="flex-1"><label className="text-xs font-semibold text-slate-500">{tipo === "01" ? "Precio unitario (IVA incluido)" : "Precio unitario neto"}</label>
            <input inputMode="decimal" placeholder="0.00" value={precio} onChange={(e) => setPrecio(e.target.value.replace(",", "."))} /></div></div>
        {tipo === "01" ? (<>
          <input placeholder="Nombre completo del cliente" value={r.nombre ?? ""} onChange={set("nombre")} /><input placeholder="DUI (00000000-0)" value={r.numDocumento ?? ""} onChange={set("numDocumento")} />
          {req200 && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-3 text-sm font-medium">Por legislación de Hacienda, ventas iguales o mayores a $200 requieren registrar el Nombre completo y DUI del cliente{!duiOk && " (DUI con formato 00000000-0)"}.</div>}
        </>) : (<>
          <input placeholder="Razón social" value={r.nombre ?? ""} onChange={set("nombre")} /><input placeholder="NIT del cliente" value={r.numDocumento ?? ""} onChange={set("numDocumento")} />
          <input placeholder="NRC" value={r.nrc ?? ""} onChange={set("nrc")} /><input placeholder="Código de giro (CAT-019)" value={r.codActividad ?? ""} onChange={set("codActividad")} />
          <input placeholder="Giro / actividad económica" value={r.descActividad ?? ""} onChange={set("descActividad")} />
          <select value={r.departamento} onChange={set("departamento")}>{Object.entries(DEPARTAMENTOS).map(([k, n]) => <option key={k} value={k}>{k} · {n}</option>)}</select>
          <input placeholder="Código de municipio (2 dígitos)" value={r.municipio ?? ""} onChange={set("municipio")} /><input placeholder="Dirección complementaria" value={r.complemento ?? ""} onChange={set("complemento")} />
          <input type="email" placeholder="Correo del cliente" value={r.correo ?? ""} onChange={set("correo")} />
          <label className="flex gap-2 text-sm"><input type="checkbox" className="!w-5 !h-5" checked={retener} onChange={(e) => setRetener(e.target.checked)} />Retención 1% (gran contribuyente, neto ≥ $100)</label>
        </>)}
        <div className="flex justify-between text-lg border-t border-dashed pt-3"><span>Total a pagar</span><b>{money(total)}</b></div>
        {err && <p className="text-rose-600 text-sm">{err}</p>}
        <button className={btn + " sticky bottom-20"} disabled={bloqueado} onClick={emitir}>{busy ? "Firmando y transmitiendo…" : "Emitir Documento · " + money(total)}</button>
      </div>
    </div>
  );
}

function Historial({ uid }: { uid: string }) {
  const [rows, setRows] = useState<any[]>([]), [q, setQ] = useState(""), [met, setMet] = useState({ iva: 0, total: 0 });
  useEffect(() => {
    const ini = new Date(); ini.setDate(1); const desde = ini.toISOString().slice(0, 10);
    supabase.from("dtes").select("id,tipo_dte,numero_control,estado_dte,receptor_nombre,total_pagar,fecha_emision").eq("comercio_id", uid).gte("fecha_emision", desde).order("created_at", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
    // Métricas: filtro estricto estado_dte = 'Transmitido'
    supabase.from("dtes").select("total_iva,total_pagar").eq("comercio_id", uid).eq("estado_dte", "Transmitido").gte("fecha_emision", desde)
      .then(({ data }) => setMet({ iva: (data ?? []).reduce((a, d: any) => a + Number(d.total_iva), 0), total: (data ?? []).reduce((a, d: any) => a + Number(d.total_pagar), 0) }));
  }, [uid]);
  const list = rows.filter((d) => (d.receptor_nombre ?? "").toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <div className="bg-slate-900 text-white rounded-2xl p-4 grid grid-cols-2 gap-2"><div><p className="text-xs text-slate-400">IVA acumulado del mes</p><p className="text-xl font-bold">{money(met.iva)}</p></div>
        <div><p className="text-xs text-slate-400">Total acumulado</p><p className="text-xl font-bold">{money(met.total)}</p></div></div>
      <input placeholder="Buscar por cliente…" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.map((d) => (
        <div key={d.id} className={`bg-white rounded-2xl p-3 shadow-sm flex justify-between ${d.estado_dte === "Rechazado" ? "opacity-50" : ""}`}>
          <div><p className="font-semibold">{d.receptor_nombre}</p><p className="text-xs text-slate-500">{d.tipo_dte === "01" ? "Factura" : "Crédito Fiscal"} · {d.fecha_emision}</p><p className="text-[10px] text-slate-400 break-all">{d.numero_control}</p></div>
          <div className="text-right"><p className="font-bold">{money(Number(d.total_pagar))}</p>
            <span className={`text-[11px] px-2 py-0.5 rounded-full text-white ${d.estado_dte === "Transmitido" ? "bg-emerald-600" : d.estado_dte === "En Cola" ? "bg-amber-500" : "bg-rose-500"}`}>{d.estado_dte}</span></div>
        </div>))}
      {!list.length && <p className="text-center text-slate-400 py-8">Sin documentos este mes</p>}
    </div>
  );
}
