/* ------------------------------------------------------------------
   Tabla pública.profiles: datos personales que cada cliente
   completa sobre sí mismo desde perfil.html.

   · Una fila por usuario (user_id = auth.uid()).
   · RLS: solo el dueño puede leer o modificar su fila.
   · Todos los campos son opcionales salvo el user_id.
------------------------------------------------------------------ */

create table if not exists public.profiles (
    user_id              uuid primary key references auth.users (id) on delete cascade,
    nombre_completo      text,
    fecha_nacimiento     date,
    genero               text,
    telefono             text,
    ciudad               text,
    direccion            text,
    referencia           text,
    fragancia_favorita   text,
    familia_preferida    text,
    notas_favoritas      text,
    busca_que            text,
    alergias             text,
    como_nos_conocio     text,
    acepta_novedades     boolean default true,
    created_at           timestamptz default now(),
    updated_at           timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "select perfil propio" on public.profiles;
create policy "select perfil propio"
    on public.profiles for select
    using (auth.uid() = user_id);

drop policy if exists "insertar perfil propio" on public.profiles;
create policy "insertar perfil propio"
    on public.profiles for insert
    with check (auth.uid() = user_id);

drop policy if exists "actualizar perfil propio" on public.profiles;
create policy "actualizar perfil propio"
    on public.profiles for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- created_at / updated_at se refrescan solos.
create or replace function public.actualizar_marca_tiempo_perfil()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
    before update on public.profiles
    for each row
    execute function public.actualizar_marca_tiempo_perfil();
