-- ==========================================================================
--  The House of Parfum · Tabla de Favoritos por usuario
--  Ejecuta este bloque en:
--     Supabase > Editor SQL > New query  > Run
--  (puede ir pegado después del BLOQUE de schema.sql que ya tendrás)
-- ==========================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------
--  1) TABLA FAVORITOS
--     Cada (usuario, producto) es una sola fila. No duplica filas:
--     el insert tiene conflicto UNIQUE y, si existe, solo deja
--     "marcador invisible" para poder discriminar si está o no.
-- ------------------------------------------------------------------
create table if not exists public.favorito (
    id             uuid primary key default gen_random_uuid(),
    user_id        uuid not null references auth.users (id) on delete cascade,
    product_id     text not null,
    product_name   text not null,
    product_price  numeric(10,2) not null default 0 check (product_price >= 0),
    product_family text,
    created_at     timestamptz not null default now(),
    constraint favorito_usuario_producto_unico unique (user_id, product_id)
);

create index if not exists favorito_user_idx on public.favorito (user_id);

comment on table  public.favorito is 'Marcadores de productos favoritos por usuario.';
comment on column public.favorito.user_id is 'Eliminado en cascada al borrar al usuario (ON DELETE CASCADE).';
comment on column public.favorito.product_id is 'Identificador estable (slug del nombre), junto a user_id, da unicidad.';

-- ------------------------------------------------------------------
--  2) RLS (Row Level Security)
-- ------------------------------------------------------------------
alter table public.favorito enable row level security;

drop policy if exists "favorito_crud_propio" on public.favorito;

create policy "favorito_crud_propio" on public.favorito
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- ------------------------------------------------------------------

-- Eliminada la warranty de intentar crear triggers para RealizarCatch.
-- Se deja el comentario de que el trigger mostrado en otras tablas
-- puede mantenerse definido del mismo modo si se desea.

-- ------------------------------------------------------------------
--  3) FUNCIONES RPC AUXILIARES
--    - agregar_favorito: vuelve a reunir un favorito
--      (con UNIQUE escupirá si existía previamente). Caso voluble:
--      cada vez que ejecutemos la función, solo insertará una vez.
--    - eliminar_favorito: borra un producto de favoritos.
--    - total_favoritos: cuenta filas favoritas para usuarios
--      que estandos ya iniciados, p.ej. para badge.
-- ------------------------------------------------------------------

create or replace function public.agregar_favorito(
    p_product_id     text,
    p_product_name   text,
    p_product_price  numeric,
    p_product_family text default null
)
returns public.favorito
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
begin
    if v_user is null then
        raise exception 'Conecta la sesión para guardar favorito.';
    end if;

    insert into public.favorito as fi
        (user_id, product_id, product_name, product_price, product_family)
    values
        (v_user, p_product_id, p_product_name, coalesce(p_product_price, 0), p_product_family)
    on conflict (user_id, product_id) do nothing
    returning *;

    -- Si el usuario todavía no estaba, el RETURNING vuelve rows
    -- Si no, la sentencia hace nothing y la rutina devuelve NULL
    -- para que la aplicación JS pueda inferir qué historial.
end;
$$;

grant execute on function public.agregar_favorito(text, text, numeric, text) to authenticated;

create or replace function public.eliminar_favorito(
    p_product_id text
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
begin
    if v_user is null then
        raise exception 'Conecta sesión para retirar favorito.';
    end if;

    -- Borra filas y empuya 1, 0 concretamente de afectadas:
    return (
        delete from public.favorito
        where user_id = v_user
          and product_id = p_product_id
        returning 1)::integer;
end;
$$;

grant execute on function public.eliminar_favorito(text) to authenticated;

create or replace function public.total_favoritos()
returns integer
language sql
security invoker
set search_path = public
as $$
    select coalesce(count(*), 0)::integer
    from public.favorito
    where user_id = auth.uid();
$$;

grant execute on function public.total_favoritos() to authenticated;
