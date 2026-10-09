-- ==========================================================================
--  The House of Parfum · Esquema de base de datos para Supabase
--  Ejecuta TODO este archivo en:  Supabase > SQL Editor > New query > Run
-- ==========================================================================

create extension if not exists pgcrypto;

-- --------------------------------------------------------------------------
--  1) TABLA DEL CARRITO
--     Una fila por usuario + producto. La cantidad se acumula, nunca se
--     sobrescribe el carrito completo.
-- --------------------------------------------------------------------------
create table if not exists public.cart_items (
    id             uuid primary key default gen_random_uuid(),
    user_id        uuid not null references auth.users (id) on delete cascade,
    product_id     text not null,
    product_name   text not null,
    product_price  numeric(10,2) not null default 0 check (product_price >= 0),
    product_family text,
    quantity       integer not null default 1 check (quantity > 0),
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    constraint cart_items_usuario_producto_unico unique (user_id, product_id)
);

create index if not exists cart_items_user_idx on public.cart_items (user_id);

comment on table  public.cart_items is 'Carrito de compras persistente por usuario.';
comment on column public.cart_items.product_id is 'Identificador estable del perfume (slug del nombre).';
comment on column public.cart_items.quantity is 'Cantidad acumulada del mismo perfume.';

-- --------------------------------------------------------------------------
--  2) SEGURIDAD POR FILA (RLS)
--     Cada usuario solo puede leer y modificar SU carrito.
-- --------------------------------------------------------------------------
alter table public.cart_items enable row level security;

drop policy if exists "carrito_ver_propio"      on public.cart_items;
drop policy if exists "carrito_insertar_propio" on public.cart_items;
drop policy if exists "carrito_actualizar_propio" on public.cart_items;
drop policy if exists "carrito_borrar_propio"   on public.cart_items;

create policy "carrito_ver_propio" on public.cart_items
    for select to authenticated
    using (auth.uid() = user_id);

create policy "carrito_insertar_propio" on public.cart_items
    for insert to authenticated
    with check (auth.uid() = user_id);

create policy "carrito_actualizar_propio" on public.cart_items
    for update to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "carrito_borrar_propio" on public.cart_items
    for delete to authenticated
    using (auth.uid() = user_id);

-- --------------------------------------------------------------------------
--  3) TRIGGER: mantener updated_at al día
-- --------------------------------------------------------------------------
create or replace function public.actualizar_marca_tiempo()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists cart_items_actualizar_marca_tiempo on public.cart_items;
create trigger cart_items_actualizar_marca_tiempo
    before update on public.cart_items
    for each row execute function public.actualizar_marca_tiempo();

-- --------------------------------------------------------------------------
--  4) FUNCIÓN RPC: agregar (o acumular) un producto en el carrito
--     Inserta la fila o, si ya existe ese producto para el usuario,
--     suma la cantidad. Es atómica y respeta RLS (security invoker).
-- --------------------------------------------------------------------------
create or replace function public.agregar_al_carrito(
    p_product_id     text,
    p_product_name   text,
    p_product_price  numeric,
    p_product_family text default null,
    p_cantidad       integer default 1
)
returns public.cart_items
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_user  uuid := auth.uid();
    v_fila  public.cart_items;
    v_cant  integer := greatest(coalesce(p_cantidad, 1), 1);
begin
    if v_user is null then
        raise exception 'Debes iniciar sesión para usar el carrito';
    end if;

    insert into public.cart_items as ci
        (user_id, product_id, product_name, product_price, product_family, quantity)
    values
        (v_user, p_product_id, p_product_name, coalesce(p_product_price, 0), p_product_family, v_cant)
    on conflict (user_id, product_id) do update
        set quantity       = ci.quantity + excluded.quantity,
            product_name   = excluded.product_name,
            product_price  = excluded.product_price,
            product_family = excluded.product_family
    returning * into v_fila;

    return v_fila;
end;
$$;

grant execute on function public.agregar_al_carrito(text, text, numeric, text, integer) to authenticated;

-- --------------------------------------------------------------------------
--  5) CONSULTA DE APOYO: total del carrito del usuario actual
-- --------------------------------------------------------------------------
create or replace function public.total_del_carrito()
returns numeric
language sql
security invoker
set search_path = public
as $$
    select coalesce(sum(quantity * product_price), 0)::numeric
    from public.cart_items
    where user_id = auth.uid();
$$;

grant execute on function public.total_del_carrito() to authenticated;

-- ==========================================================================
--  Fin del esquema. Recuerda activar "Email/Password" en
--  Supabase > Authentication > Providers y configurar en
--  Authentication > URL Configuration la Site URL de Netlify.
-- ==========================================================================