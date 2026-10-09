/* ------------------------------------------------------------------
   Favoritos del usuario conectado (independiente del carrito).
   · Tabla: public.favorites (una fila por usuario + producto)
   · Toggle directo sobre la tabla para funcionar con el RLS actual.
   · Botón de "Añadir a favoritos / En favoritos" en el catálogo.
------------------------------------------------------------------ */

import { cargarCliente, supabaseConfigurado } from './supabase-cliente.js';
import {
    obtenerUsuarioActual,
    alCambiarSesion,
    abrirModalAuth,
    ejecutarTrasIniciarSesion
} from './auth.js';
import { generarId, productoDesdeTarjeta } from './carrito.js';
import { mostrarAviso } from './avisos.js';

export const TABLA_FAVORITOS = 'favorites';
const TABLA_FAVORITOS_LEGADA = 'favorito';
let tablaFavoritosActiva = TABLA_FAVORITOS;

function tablaFavoritosAusente(error) {
    const codigo = error && error.code;
    const mensaje = (error && error.message) || '';
    return codigo === '42P01' || codigo === 'PGRST205'
        || /relation .*favorites.*does not exist|could not find the table|no existe la relación/i.test(mensaje);
}

/* ---------- utilidades ---------- */

/** Convierte "Dior Sauvage" en "dior-sauvage" (id estable). */
export function favId(texto = '') {
    return generarId(texto);
}

/** Sincroniza los favoritos del usuario con la página y el catálogo.
 *  Devuelve promesa de lista (o null si no hay sesión/config). */
async function consultarFavoritos(supabase, usuario, tabla) {
    return supabase
        .from(tabla)
        .select('*')
        .eq('user_id', usuario.id)
        .order('created_at', { ascending: true });
}

export async function cargarFavoritos() {
    if (!supabaseConfigurado) return null;

    const usuario = obtenerUsuarioActual();
    if (!usuario) return [];

    const supabase = await cargarCliente();
    let resultado = await consultarFavoritos(supabase, usuario, tablaFavoritosActiva);

    if (resultado.error && tablaFavoritosAusente(resultado.error)) {
        if (tablaFavoritosActiva === TABLA_FAVORITOS) {
            tablaFavoritosActiva = TABLA_FAVORITOS_LEGADA;
            resultado = await consultarFavoritos(supabase, usuario, tablaFavoritosActiva);
        } else {
            return [];
        }
    }

    if (resultado.error) {
        console.warn('No se pudieron leer los favoritos:', resultado.error);
        return [];
    }

    return resultado.data || [];
}

/** Devuelve Set con los product_id que el usuario tiene como favoritos (ajustado a id). */
export function idsFavoritos(lista) {
    if (!Array.isArray(lista)) return new Set();
    const s = new Set();
    for (const f of lista) {
        if (f && f.product_id) s.add(String(f.product_id));
    }
    return s;
}

/* ---------- toggle (botón de pie de tarjeta) ---------- */

async function alternarFavoritoEnTabla(supabase, producto, usuario, tabla) {
    const { data: existente, error: errorLectura } = await supabase
        .from(tabla)
        .select('id')
        .eq('user_id', usuario.id)
        .eq('product_id', producto.id)
        .maybeSingle();

    if (errorLectura) throw errorLectura;

    if (existente) {
        const { error } = await supabase
            .from(tabla)
            .delete()
            .eq('id', existente.id)
            .eq('user_id', usuario.id);

        if (error) throw error;
        return false;
    }

    const { error } = await supabase
        .from(tabla)
        .insert({
            user_id: usuario.id,
            product_id: producto.id,
            product_name: producto.nombre,
            product_price: producto.precio,
            product_family: producto.familia
        });

    if (error) throw error;
    return true;
}

async function alternarFavoritoConFallback(supabase, producto, usuario) {
    try {
        return await alternarFavoritoEnTabla(supabase, producto, usuario, tablaFavoritosActiva);
    } catch (error) {
        if (tablaFavoritosAusente(error) && tablaFavoritosActiva === TABLA_FAVORITOS) {
            tablaFavoritosActiva = TABLA_FAVORITOS_LEGADA;
            return alternarFavoritoEnTabla(supabase, producto, usuario, tablaFavoritosActiva);
        }
        throw error;
    }
}

export async function toggleFavoritoDesdeTarjeta(tarjeta) {
    const producto = productoDesdeTarjeta(tarjeta);
    if (!producto) return null;

    if (!supabaseConfigurado) {
        mostrarAviso('Falta configurar Supabase para guardar favoritos.', 'error');
        return null;
    }

    const usuario = obtenerUsuarioActual();
    if (!usuario) {
        ejecutarTrasIniciarSesion(() => toggleFavoritoDesdeTarjeta(tarjeta));
        mostrarAviso('Inicia sesión para guardar favoritos', 'info');
        abrirModalAuth('login');
        return null;
    }

    const boton = tarjeta.querySelector('.fav-btn');
    if (!boton || boton.disabled) return null;

    const textoOriginal = boton.textContent;
    boton.disabled = true;
    boton.dataset.accion = 'procesando';
    boton.textContent = 'Guardando...';

    try {
        const supabase = await cargarCliente();
        const esFavorito = await alternarFavoritoConFallback(supabase, producto, usuario);

        actualizarBotonFavorito(tarjeta, esFavorito, boton);
        mostrarAviso(
            esFavorito
                ? `${producto.nombre} añadido a favoritos`
                : `${producto.nombre} quitado de favoritos`,
            esFavorito ? 'exito' : 'info'
        );
        return esFavorito;
    } catch (error) {
        console.error('Error al guardar el favorito:', error);
        boton.dataset.accion = '';
        boton.textContent = textoOriginal;
        mostrarAviso(describeErrorFavoritos(error), 'error');
        return null;
    } finally {
        boton.disabled = false;
    }
}

function actualizarBotonFavorito(tarjeta, esFav, boton) {
    if (!boton) {
        const btn = tarjeta.querySelector('.fav-btn');
        if (!btn) return;
        boton = btn;
    }
    boton.dataset.esFav = esFav ? '1' : '0';
    boton.dataset.accion = '';
    boton.classList.toggle('activo', esFav);
    boton.setAttribute('aria-pressed', String(esFav));
    boton.textContent = esFav ? 'En favoritos' : 'Añadir a favoritos';
}


let favoritosIniciados = false;

function actualizarEstadoFavoritos(lista) {
    const ids = idsFavoritos(lista);

    document.querySelectorAll('.card').forEach(tarjeta => {
        const producto = productoDesdeTarjeta(tarjeta);
        if (!producto) return;
        actualizarBotonFavorito(tarjeta, ids.has(producto.id));
    });
}

async function sincronizarEstadoFavoritos(usuario) {
    if (!usuario) {
        actualizarEstadoFavoritos([]);
        return;
    }

    try {
        actualizarEstadoFavoritos(await cargarFavoritos());
    } catch (error) {
        console.warn('No se pudo sincronizar el estado de favoritos:', error);
    }
}

/** Registra los botones de favoritos y los sincroniza con la cuenta. */
export function iniciarFavoritos() {
    if (favoritosIniciados) return;
    favoritosIniciados = true;

    document.querySelectorAll('.card').forEach(tarjeta => {
        const boton = tarjeta.querySelector('.fav-btn');
        if (!boton || boton.dataset.favoritosListo === '1') return;

        boton.dataset.favoritosListo = '1';
        boton.setAttribute('aria-pressed', 'false');
        boton.addEventListener('click', evento => {
            evento.preventDefault();
            void toggleFavoritoDesdeTarjeta(tarjeta);
        });
    });

    alCambiarSesion(usuario => {
        void sincronizarEstadoFavoritos(usuario);
    });
}

/* ---------- errores leídos ---------- */

export function describeErrorFavoritos(error) {
    const codigo = error && error.code;
    const mensaje = (error && error.message) || '';
    if (codigo === '42P01' || codigo === 'PGRST205' || /does not exist|could not find the table|no existe la relaci/i.test(mensaje)) {
        return 'Falta crear la tabla de favoritos. Ejecuta supabase/schema-favorites.sql en Supabase.';
    }
    if (codigo === 'PGRST301' || /jwt|token/i.test(mensaje)) {
        return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    }
    return 'No pudimos actualizar el favorito. Inténtalo de nuevo.';
}