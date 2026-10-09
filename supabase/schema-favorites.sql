-- ==========================================================================
--  The House of Parfum · Tabla de favoritos (nueva, independiente del carrito)
--  Este archivo es el esquema vigente que usa js/favorites.js.
--  Ejecuta en Supabase > Editor SQL > New query > Run
-- ==========================================================================
create extension if not exists pgcrypto on;

-- ------------------------------------------------------------------
--  TABLA favorites (una fila por usuario + producto)
-- ------------------------------------------------------------------
create table if not exists public.favorites (
    id             uuid primary key default gen_random_uuid(),
    user_id        uuid not null references auth.users (id) on delete cascade,
    product_id     text not null,
    product_name   text not null,
    product_price  numeric(10,2) not null default 0 check (product_price >= 0),
    product_family text,
    created_at     timestamptz not null default now(),
    constraint favorites_usuario_producto_unico unique (user_id, product_id)
);

create index if not exists favorites_user_idx on public.favorites (user_id);
-- Migración opcional desde el esquema antiguo "favorito" a "favorites".
-- Solo se ejecuta si la tabla antigua existe; no cambia ni borra la original.
do $$
begin
    if to_regclass('public.favorito') is not null then
        execute $sql$
            insert into public.favorites
                (user_id, product_id, product_name, product_price, product_family, created_at)
            select
                user_id,
                product_id,
                product_name,
                product_price,
                product_family,
                created_at
            from public.favorito
            on conflict (user_id, product_id) do nothing
        $sql$;
    end if;
end;
$$;


comment on table  public.favorites is 'Favoritos persistentes por usuario (tabla independiente del carrito).';
comment on column public.favorites.product_id is 'Identificador estable del perfume (slug del nombre).';

-- ------------------------------------------------------------------
--  RLS (igual que carrito)
-- ------------------------------------------------------------------
alter table public.favorites enable row level security;

drop policy if exists "favorites_ver_propio"      on public.favorites;
drop policy if exists "favorites_insertar_propio" on public.favorites;
drop policy if exists "favorites_borrar_proprio"   on public.favorites;

create policy "favorites_ver_propio" on public.favorites
    for select to authenticated
    using (auth.uid() = user_id);

create policy "favorites_insertar_propio" on public.favorites
    for insert to authenticated
    with check (auth.uid() = user_id);

create policy "favorites_borrar_proprio" on public.favorites
    for delete to authenticated
    using (auth.uid() = user_id);

-- ------------------------------------------------------------------
--  FUNCIÓN RPC: toggle de favorito (inserta o borra) + devuelve estado
-- ------------------------------------------------------------------
create or replace function public.toggle_favorite(
    p_product_id     text,
    p_product_name   text,
    p_product_price  numeric,
    p_product_family text default null
)
returns table (estado text, producto_id text, producto_nombre text, producto_precio numeric, es_favorito boolean)
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
begin
    if v_user is null then
        raise exception 'Debes iniciar sesión para marcar favoritos';
    end if;

    -- 1) Si ya existe, lo quitamos. Si no, lo insertamos.
    delete from public.favorites
    where user_id = v_user and product_id = p_product_id;

    if found then
        return query
        select
            'quitado'::text,
            p_product_id,
            p_product_name,
            coalesce(p_product_price, 0),
            false;

        return;
    end if;

    insert into public.favorites
        (user_id, product_id, product_name, product_price, product_family)
    values
        (v_user, p_product_id, p_product_name, coalesce(p_product_price, 0), p_product_family);

    return query
    select
        'anadido'::text,
        p_product_id,
        p_product_name,
        coalesce(p_product_price, 0),
        true;
end;
$$;

grant execute on function public.toggle_favorite(text, text, numeric, text) to authenticated;

-- ------------------------------------------------------------------
--  Función de ayuda para saber si un usuario tiene un perfume como favorito
--  (til usar en cliente si no quieres otra RPC más)
-- ------------------------------------------------------------------
create or replace function public.es_favorito(p_user_id uuid, p_product_id text)
returns boolean
language sql
as $$
    select exists (
        select 1 from public.favorites
        where user_id = p_user_id and product_id = p_product_id
    );
$$;

grant execute on function public.es_favorito(uuid, text) to authenticated;