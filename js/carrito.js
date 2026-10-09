/* ------------------------------------------------------------------
   Carrito de compras conectado a Supabase.
   · Cada "Comprar" guarda el producto en la tabla cart_items.
   · Si el perfume ya estaba en el carrito, se ACUMULA la cantidad
     (no se sobrescribe ni se duplica la fila).
   · El carrito pertenece al usuario conectado, por lo que al volver a
     entrar sus productos siguen ahí.
------------------------------------------------------------------ */

import { cargarCliente, supabaseConfigurado } from './supabase-cliente.js';
import {
    obtenerUsuarioActual,
    alCambiarSesion,
    abrirModalAuth,
    ejecutarTrasIniciarSesion
} from './auth.js';
import { mostrarAviso } from './avisos.js';

export const TABLA_CARRITO = 'cart_items';

/* ------------------------------ Utilidades ------------------------------ */

/** Convierte "Dior Sauvage" en "dior-sauvage" (identificador estable). */
export function generarId(texto = '') {
    return String(texto)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'perfume';
}

/** Convierte "S/1,400" en 1400. */
export function precioANumero(texto = '') {
    const limpio = String(texto).replace(/[^\d.,]/g, '').replace(/,/g, '');
    const valor = Number.parseFloat(limpio);
    return Number.isFinite(valor) ? valor : 0;
}

/** Convierte 1400 en "S/1,400". */
export function formatearPrecio(numero = 0) {
    const valor = Number(numero) || 0;
    return `S/${valor.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Lee el producto asociado a una tarjeta del catálogo. */
export function productoDesdeTarjeta(tarjeta) {
    if (!tarjeta) return null;

    const titulo = tarjeta.querySelector('.card-cuerpo h3');
    if (!titulo || !titulo.textContent.trim()) return null;

    const etiquetaPrecio = tarjeta.querySelector('.precio');
    const etiquetaFamilia = tarjeta.querySelector('.familia');

    return {
        id: generarId(titulo.textContent),
        nombre: titulo.textContent.trim(),
        precio: precioANumero(etiquetaPrecio ? etiquetaPrecio.textContent : '0'),
        familia: tarjeta.dataset.familia
            || (etiquetaFamilia ? etiquetaFamilia.textContent.trim() : null)
    };
}

/* ------------------------------ Carrito ------------------------------ */

/**
 * Añade (o acumula) un producto en el carrito del usuario conectado.
 * @returns {Promise<'anadido'|'login'|'error'>}
 */
export async function agregarAlCarrito(producto) {
    if (!producto) return 'error';

    if (!supabaseConfigurado) {
        mostrarAviso('Falta configurar Supabase para usar el carrito.', 'error');
        return 'error';
    }

    const usuario = obtenerUsuarioActual();

    if (!usuario) {
        // Recordamos la intención y pedimos iniciar sesión en el momento.
        ejecutarTrasIniciarSesion(() => agregarAlCarrito(producto));
        mostrarAviso('Inicia sesión para guardar tu carrito', 'info');
        abrirModalAuth('login');
        return 'login';
    }

    let supabase;
    try {
        supabase = await cargarCliente();
    } catch (error) {
        mostrarAviso(error.message, 'error');
        return 'error';
    }

    const { error: errorRpc } = await supabase.rpc('agregar_al_carrito', {
        p_product_id: producto.id,
        p_product_name: producto.nombre,
        p_product_price: producto.precio,
        p_product_family: producto.familia,
        p_cantidad: 1
    });

    if (!errorRpc) {
        await refrescarBadge();
        mostrarAviso(`${producto.nombre} añadido al carrito`, 'exito');
        return 'anadido';
    }

    const rpcAusente = errorRpc.code === 'PGRST202'
        || /agregar_al_carrito/i.test(errorRpc.message || '');

    if (!rpcAusente) {
        console.error('Error al añadir al carrito:', errorRpc);
        mostrarAviso(describirErrorCarrito(errorRpc), 'error');
        return 'error';
    }

    // Respaldo por si aún no ejecutaste la función RPC del esquema SQL.
    return agregarSinFuncion(producto, usuario);
}

async function agregarSinFuncion(producto, usuario) {
    const supabase = await cargarCliente();

    const { data: existente, error: errorLectura } = await supabase
        .from(TABLA_CARRITO)
        .select('id, quantity')
        .eq('user_id', usuario.id)
        .eq('product_id', producto.id)
        .maybeSingle();

    if (errorLectura) {
        console.error('Error al leer el carrito:', errorLectura);
        mostrarAviso(describirErrorCarrito(errorLectura), 'error');
        return 'error';
    }

    const datos = {
        product_name: producto.nombre,
        product_price: producto.precio,
        product_family: producto.familia
    };

    const { error } = existente
        ? await supabase
            .from(TABLA_CARRITO)
            .update({ ...datos, quantity: Number(existente.quantity || 0) + 1 })
            .eq('id', existente.id)
        : await supabase
            .from(TABLA_CARRITO)
            .insert({ ...datos, user_id: usuario.id, product_id: producto.id, quantity: 1 });

    if (error) {
        console.error('Error al guardar en el carrito:', error);
        mostrarAviso(describirErrorCarrito(error), 'error');
        return 'error';
    }

    await refrescarBadge();
    mostrarAviso(`${producto.nombre} añadido al carrito`, 'exito');
    return 'anadido';
}

/** Mensaje claro según el error devuelto por Supabase. */
export function describirErrorCarrito(error) {
    const codigo = error && error.code;
    const mensaje = (error && error.message) || '';

    if (codigo === '42P01' || /does not exist|no existe la relaci/i.test(mensaje)) {
        return 'Falta crear la tabla del carrito. Ejecuta supabase/schema.sql en Supabase.';
    }
    if (codigo === 'PGRST301' || /jwt|token/i.test(mensaje)) {
        return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    }
    if (codigo === '23514') {
        return 'La cantidad del producto no es válida.';
    }
    return 'No pudimos guardar el producto. Inténtalo de nuevo.';
}

/** Actualiza el número que aparece sobre el icono del carrito. */
export async function refrescarBadge() {
    const badge = document.getElementById('badge-carrito');
    if (!badge) return;

    const usuario = obtenerUsuarioActual();

    if (!supabaseConfigurado || !usuario) {
        badge.textContent = '0';
        badge.hidden = true;
        return;
    }

    let supabase;
    try {
        supabase = await cargarCliente();
    } catch (error) {
        badge.hidden = true;
        return;
    }

    const { data, error } = await supabase
        .from(TABLA_CARRITO)
        .select('quantity')
        .eq('user_id', usuario.id);

    if (error) {
        console.warn('No se pudo contar el carrito:', error.message);
        badge.hidden = true;
        return;
    }

    const total = (data || []).reduce((suma, fila) => suma + (Number(fila.quantity) || 0), 0);
    badge.textContent = String(total);
    badge.hidden = total === 0;
    badge.classList.remove('latido');
    void badge.offsetWidth;
    badge.classList.add('latido');
}

/* ------------------------------ Arranque ------------------------------ */

export function iniciarCarrito() {
    document.querySelectorAll('.card-pie button').forEach(boton => {
        if (boton.dataset.carritoListo === '1') return;
        boton.dataset.carritoListo = '1';

        boton.addEventListener('click', async evento => {
            evento.preventDefault();

            const producto = productoDesdeTarjeta(boton.closest('.card'));
            if (!producto) return;

            const textoOriginal = boton.textContent;
            boton.disabled = true;
            boton.textContent = 'Añadiendo...';

            const resultado = await agregarAlCarrito(producto);

            if (resultado === 'anadido') {
                boton.textContent = 'Añadido';
                boton.classList.add('confirmado');
                window.setTimeout(() => {
                    boton.textContent = textoOriginal;
                    boton.classList.remove('confirmado');
                    boton.disabled = false;
                }, 1500);
            } else {
                boton.textContent = textoOriginal;
                boton.disabled = false;
            }
        });
    });

    alCambiarSesion(() => refrescarBadge());
}