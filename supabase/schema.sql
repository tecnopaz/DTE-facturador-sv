-- DTE Facturador Express · esquema multi-tenant (ejecutar completo en el SQL Editor de Supabase)
create extension if not exists pgcrypto;

create table public.perfil_comercio (
  id uuid primary key references auth.users(id) on delete cascade,
  email_emisor text,
  nombre_razon_social text,
  nombre_comercial text default 'Mi Comercio',
  nit_emisor varchar(14),
  nrc_emisor varchar(8),
  dui_propietario varchar(10),
  cod_actividad varchar(6),
  giro_actividad text,
  departamento varchar(2),
  municipio varchar(2),
  direccion_complemento text,
  telefono varchar(15),
  cod_estable varchar(4) not null default 'M001',
  cod_punto_venta varchar(4) not null default 'P001',
  ambiente varchar(2) not null default '00',
  onboarding_completo boolean not null default false,
  trial_hasta timestamptz not null default (now() + interval '24 hours'),
  licencia_hasta timestamptz,
  created_at timestamptz not null default now()
);

-- Credenciales aparte y SIN políticas: solo el service role (API Routes) las lee o escribe.
create table public.credenciales_hacienda (
  comercio_id uuid primary key references public.perfil_comercio(id) on delete cascade,
  hacienda_api_key_encrypted text not null,
  hacienda_private_key_encrypted text not null,
  hacienda_password_encrypted text not null,
  updated_at timestamptz not null default now()
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null default auth.uid() references public.perfil_comercio(id) on delete cascade,
  nombre text not null, tipo_documento varchar(2), num_documento text, nrc varchar(8),
  cod_actividad varchar(6), giro text, correo text, telefono text,
  departamento varchar(2), municipio varchar(2), direccion text,
  created_at timestamptz not null default now()
);
create table public.productos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null default auth.uid() references public.perfil_comercio(id) on delete cascade,
  codigo text, nombre text not null, precio numeric(12,4) not null check (precio > 0),
  created_at timestamptz not null default now()
);
create table public.dtes (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.perfil_comercio(id) on delete cascade,
  tipo_dte varchar(2) not null check (tipo_dte in ('01','03','05')),
  numero_control text not null unique,
  codigo_generacion uuid not null unique,
  estado_dte text not null check (estado_dte in ('Transmitido','Rechazado','En Cola')),
  sello_recepcion text,
  receptor_nombre text,
  total_pagar numeric(12,2) not null,
  total_iva numeric(12,2) not null default 0,
  fecha_emision date not null,
  json_dte jsonb not null,
  json_firmado text,
  respuesta_mh jsonb,
  created_at timestamptz not null default now()
);
create index on public.dtes (comercio_id, fecha_emision desc);

-- Correlativo atómico por comercio y tipo (número de control)
create table public.correlativos (
  comercio_id uuid not null references public.perfil_comercio(id) on delete cascade,
  tipo_dte varchar(2) not null, ultimo bigint not null default 0,
  primary key (comercio_id, tipo_dte)
);
create or replace function public.siguiente_correlativo(p_comercio uuid, p_tipo text)
returns bigint language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  insert into public.correlativos (comercio_id, tipo_dte, ultimo) values (p_comercio, p_tipo, 1)
  on conflict (comercio_id, tipo_dte) do update set ultimo = public.correlativos.ultimo + 1
  returning ultimo into n;
  return n;
end $$;
revoke all on function public.siguiente_correlativo(uuid, text) from public, anon, authenticated;
grant execute on function public.siguiente_correlativo(uuid, text) to service_role;

-- Alta automática del perfil (solo columnas con valor; el resto se completa en el onboarding)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfil_comercio (id, email_emisor) values (new.id, new.email);
  return new;
end $$;
create or replace trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.perfil_comercio enable row level security;
alter table public.credenciales_hacienda enable row level security;
alter table public.correlativos enable row level security;
alter table public.clientes enable row level security;
alter table public.productos enable row level security;
alter table public.dtes enable row level security;

create policy "perfil: ver propio" on public.perfil_comercio for select using (auth.uid() = id);
create policy "clientes: propios" on public.clientes for all using (auth.uid() = comercio_id) with check (auth.uid() = comercio_id);
create policy "productos: propios" on public.productos for all using (auth.uid() = comercio_id) with check (auth.uid() = comercio_id);
create policy "dtes: ver propios" on public.dtes for select using (auth.uid() = comercio_id);
