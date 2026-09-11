-- =====================================================================
-- Kingdom of Saint-Dié — esquema Supabase
-- Pegar en: Supabase → SQL Editor → New query → Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PERFILES
--    Una fila por persona, ligada a auth.users.
--    'lang' es lo que hace que cada uno vea la app en su idioma.
-- ---------------------------------------------------------------------
create table profiles (
  id         uuid primary key references auth.users on delete cascade,
  name       text not null,
  lang       text not null default 'es' check (lang in ('es','fr','en')),
  avatar     text default '🤴',
  mood_id    text default 'm0',
  mood_at    timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 2. HAZAÑAS (el registro de acciones)
--    user_id tiene default auth.uid(): aunque alguien intente
--    mandar el id del otro, la política de abajo lo rechaza.
-- ---------------------------------------------------------------------
create table deeds (
  id         bigserial primary key,
  user_id    uuid not null references profiles(id) default auth.uid(),
  task_id    text not null,
  stat       text not null,
  points     int  not null,
  created_at timestamptz not null default now()
);
create index deeds_recent on deeds (created_at desc);

-- ---------------------------------------------------------------------
-- 3. TABLÓN (encargos libres)
-- ---------------------------------------------------------------------
create table board (
  id           bigserial primary key,
  created_by   uuid not null references profiles(id) default auth.uid(),
  text         text not null check (char_length(text) between 1 and 70),
  stat         text not null default 'hogar',
  points       int  not null default 3,
  done_by      uuid references profiles(id),
  done_at      timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. MENSAJES (cartas, ánimos, likes)
--    Sin columna de puntos, a propósito: el afecto no es moneda.
-- ---------------------------------------------------------------------
create table messages (
  id         bigserial primary key,
  from_user  uuid not null references profiles(id) default auth.uid(),
  kind       text not null check (kind in ('quick','hype','letter','care')),
  payload_id text not null,          -- 'h3', 'l1', '👏' — nunca texto libre traducido
  deed_id    bigint references deeds(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- SEGURIDAD A NIVEL DE FILA
-- Sin esto, cualquiera con la clave pública puede escribir lo que quiera.
-- =====================================================================
alter table profiles enable row level security;
alter table deeds    enable row level security;
alter table board    enable row level security;
alter table messages enable row level security;

-- Los dos lo ven todo (sois un reino de dos, sin secretos entre vosotros)
create policy "leer todo" on profiles for select using (auth.role() = 'authenticated');
create policy "leer todo" on deeds    for select using (auth.role() = 'authenticated');
create policy "leer todo" on board    for select using (auth.role() = 'authenticated');
create policy "leer todo" on messages for select using (auth.role() = 'authenticated');

-- ESTA es la línea que impide que ella actúe por ti:
-- solo puedes insertar filas firmadas con tu propio id.
create policy "solo mis hazañas"   on deeds    for insert with check (auth.uid() = user_id);
create policy "solo mis mensajes"  on messages for insert with check (auth.uid() = from_user);
create policy "solo mis encargos"  on board    for insert with check (auth.uid() = created_by);
create policy "solo mi perfil"     on profiles for update using  (auth.uid() = id);

-- El tablón es la excepción deliberada: cualquiera puede marcar hecho
-- un encargo, lo pusiera quien lo pusiera. Pero solo puede firmarlo
-- como suyo.
create policy "cerrar encargos" on board for update
  using (auth.role() = 'authenticated')
  with check (done_by is null or auth.uid() = done_by);

-- Nadie edita ni borra hazañas pasadas, ni las suyas.
-- (No hay policy de update/delete en deeds: por defecto queda prohibido.)

-- =====================================================================
-- OLVIDO AUTOMÁTICO — nada sobrevive una semana
-- Requiere la extensión pg_cron (Database → Extensions → pg_cron)
-- =====================================================================
create extension if not exists pg_cron;

select cron.schedule(
  'olvidar-cronicas',
  '0 4 * * *',                       -- cada día a las 04:00
  $$
    delete from deeds    where created_at < now() - interval '7 days';
    delete from messages where created_at < now() - interval '7 days';
    delete from board    where created_at < now() - interval '7 days';
  $$
);

-- =====================================================================
-- REALTIME — para que aparezca en el otro móvil sin refrescar
-- =====================================================================
alter publication supabase_realtime add table deeds;
alter publication supabase_realtime add table board;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table profiles;

-- =====================================================================
-- PROSPERIDAD — se calcula, nunca se guarda.
-- Así es imposible que se desincronice entre los dos móviles.
--
-- Ventana: 'date_trunc(week, now())' = desde el lunes a las 00:00.
-- Es decir, cada lunes la prosperidad (y el tamaño del reino) empieza
-- de cero: una "temporada" semanal. Si preferís una ventana MÓVIL de
-- 7 días (el reino se apaga poco a poco en vez de resetear de golpe),
-- cambiad la línea 'where' por:   where created_at >= now() - interval '7 days'
-- =====================================================================
create view prosperity as
  select coalesce(sum(points), 0) as total
  from deeds
  where created_at >= date_trunc('week', now());

-- La vista respeta las políticas RLS de 'deeds' al consultarla el cliente.
alter view prosperity set (security_invoker = on);
grant select on prosperity to anon, authenticated;
