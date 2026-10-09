/* ------------------------------------------------------------------
   Página "Mi carrito" (carrito.html).
   Lee la tabla cart_items del usuario conectado, permite cambiar
   cantidades, quitar productos y enviar el pedido por WhatsApp.
------------------------------------------------------------------ */

import { cargarCliente, supabaseConfigurado } from './supabase-cliente.js';
import { alCambiarSesion, abrirModalAuth, obtenerUsuarioActual } from './auth.js';
import { TABLA_CARRITO, formatearPrecio, refrescarBadge, describirErrorCarrito } from './carrito.js';
import { mostrarAviso } from './avisos.js';

const WHATSAPP = '51999999999';

let items = [];
let ocupado = false;
let sesionResuelta = false;

/* ------------------------------ Arranque ------------------------------ */

export function iniciarPaginaCarrito() {
    const lista = document.getElementById('lista-carrito');
    if (!lista) return;

    lista.addEventListener('click', manejarClickEnLista);

    const vaciar = document.getElementById('vaciar-carrito');
    if (vaciar) vaciar.addEventListener('click', vaciarCarrito);

    const entrar = document.getElementById('carrito-iniciar-sesion');
    if (entrar) entrar.addEventListener('click', () => abrirModalAuth('login'));

    const whatsapp = document.getElementById('carrito-whatsapp');
    if (whatsapp) whatsapp.addEventListener('click', enviarPorWhatsapp);

    lista.innerHTML = '<p class="carrito-cargando">Comprobando tu sesión...</p>';

    alCambiarSesion(() => {
        sesionResuelta = true;
        cargarCarrito();
    });
}

function escaparHtml(texto) {
    return String(texto == null ? '' : texto).replace(/[&<>"']/g, caracter => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[caracter]));
}

function elementos() {
    return {
        lista: document.getElementById('lista-carrito'),
        estado: document.getElementById('carrito-estado'),
        estadoTitulo: document.getElementById('carrito-estado-titulo'),
        estadoTexto: document.getElementById('carrito-estado-texto'),
        estadoBoton: document.getElementById('carrito-iniciar-sesion'),
        resumen: document.getElementById('carrito-resumen'),
        articulos: document.getElementById('carrito-articulos'),
        subtotal: document.getElementById('carrito-subtotal'),
        total: document.getElementById('carrito-total'),
        vaciar: document.getElementById('vaciar-carrito'),
        whatsapp: document.getElementById('carrito-whatsapp')
    };
}

function mostrarEstado(titulo, texto, conBoton) {
    const el = elementos();
    if (!el.estado) return;

    el.estado.hidden = false;
    if (el.estadoTitulo) el.estadoTitulo.textContent = titulo;
    if (el.estadoTexto) el.estadoTexto.textContent = texto;
    if (el.estadoBoton) el.estadoBoton.hidden = !conBoton;
}

function ocultarEstado() {
    const el = elementos();
    if (el.estado) el.estado.hidden = true;
}

/* ------------------------------ Datos ------------------------------ */

async function cargarCarrito() {
    const el = elementos();
    if (!el.lista) return;

    if (!supabaseConfigurado) {
        el.lista.innerHTML = '';
        if (el.resumen) el.resumen.hidden = true;
        mostrarEstado('Carrito no disponible', 'Falta configurar las claves de Supabase en el proyecto.', false);
        return;
    }

    const usuario = obtenerUsuarioActual();
    if (!usuario) {
        items = [];

        // Si aún no sabemos si hay sesión, no mostramos el aviso de acceso.
        if (!sesionResuelta) {
            el.lista.innerHTML = '<p class="carrito-cargando">Comprobando tu sesión...</p>';
            return;
        }

        el.lista.innerHTML = '';
        if (el.resumen) el.resumen.hidden = true;
        mostrarEstado('Inicia sesión para ver tu carrito', 'Tus perfumes quedan guardados en tu cuenta y los encuentras al volver.', true);
        await refrescarBadge();
        return;
    }

    el.lista.innerHTML = '<p class="carrito-cargando">Cargando tu carrito...</p>';

    let supabase;
    try {
        supabase = await cargarCliente();
    } catch (error) {
        el.lista.innerHTML = '';
        if (el.resumen) el.resumen.hidden = true;
        mostrarEstado('No pudimos conectar con Supabase', error.message, false);
        return;
    }

    const { data, error } = await supabase
        .from(TABLA_CARRITO)
        .select('*')
        .eq('user_id', usuario.id)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error al cargar el carrito:', error);
        el.lista.innerHTML = '';
        if (el.resumen) el.resumen.hidden = true;
        mostrarEstado('No pudimos cargar tu carrito', describirErrorCarrito(error), false);
        return;
    }

    items = data || [];
    render();
}

function render() {
    const el = elementos();
    if (!el.lista) return;

    if (!items.length) {
        el.lista.innerHTML = '';
        if (el.resumen) el.resumen.hidden = true;
        mostrarEstado('Tu carrito está vacío', 'Explora el catálogo y añade tus fragancias favoritas.', false);
        refrescarBadge();
        return;
    }

    ocultarEstado();
    if (el.resumen) el.resumen.hidden = false;

    el.lista.innerHTML = items.map(item => {
        const cantidad = Number(item.quantity) || 1;
        const precio = Number(item.product_price) || 0;

        return `
            <article class="carrito-fila" data-id="${escaparHtml(item.id)}">
                <div class="carrito-detalle">
                    ${item.product_family ? `<span class="familia-chip">${escaparHtml(item.product_family)}</span>` : ''}
                    <h3>${escaparHtml(item.product_name)}</h3>
                    <span class="carrito-unitario">${formatearPrecio(precio)} por unidad</span>
                </div>

                <div class="carrito-cantidad" role="group" aria-label="Cantidad">
                    <button type="button" class="btn-cantidad" data-accion="restar" aria-label="Quitar una unidad">&minus;</button>
                    <span class="valor-cantidad">${cantidad}</span>
                    <button type="button" class="btn-cantidad" data-accion="sumar" aria-label="Añadir una unidad">+</button>
                </div>

                <span class="carrito-subtotal">${formatearPrecio(precio * cantidad)}</span>

                <button type="button" class="btn-quitar" data-accion="quitar">Quitar</button>
            </article>
        `;
    }).join('');

    const totalArticulos = items.reduce((suma, item) => suma + (Number(item.quantity) || 0), 0);
    const subtotal = items.reduce((suma, item) => suma + (Number(item.quantity) || 0) * (Number(item.product_price) || 0), 0);

    if (el.articulos) el.articulos.textContent = String(totalArticulos);
    if (el.subtotal) el.subtotal.textContent = formatearPrecio(subtotal);
    if (el.total) el.total.textContent = formatearPrecio(subtotal);

    refrescarBadge();
}

/* ------------------------------ Acciones ------------------------------ */

async function manejarClickEnLista(evento) {
    const boton = evento.target.closest('button[data-accion]');
    if (!boton || ocupado) return;

    const fila = boton.closest('.carrito-fila');
    if (!fila) return;

    const id = fila.dataset.id;
    const item = items.find(elemento => String(elemento.id) === String(id));
    if (!item) return;

    const cantidad = Number(item.quantity) || 1;
    const accion = boton.dataset.accion;

    if (accion === 'sumar') await actualizarCantidad(id, cantidad + 1);
    else if (accion === 'restar') await actualizarCantidad(id, cantidad - 1);
    else if (accion === 'quitar') await quitarItem(id);
}

async function actualizarCantidad(id, cantidad) {
    if (cantidad < 1) return quitarItem(id);

    const supabase = await cargarCliente();
    ocupado = true;
    const { error } = await supabase
        .from(TABLA_CARRITO)
        .update({ quantity: cantidad })
        .eq('id', id);
    ocupado = false;

    if (error) {
        console.error('Error al actualizar la cantidad:', error);
        mostrarAviso(describirErrorCarrito(error), 'error');
        return;
    }

    const item = items.find(elemento => String(elemento.id) === String(id));
    if (item) item.quantity = cantidad;
    render();
}

async function quitarItem(id) {
    const supabase = await cargarCliente();
    ocupado = true;
    const { error } = await supabase
        .from(TABLA_CARRITO)
        .delete()
        .eq('id', id);
    ocupado = false;

    if (error) {
        console.error('Error al quitar el producto:', error);
        mostrarAviso(describirErrorCarrito(error), 'error');
        return;
    }

    items = items.filter(elemento => String(elemento.id) !== String(id));
    render();
    mostrarAviso('Producto quitado del carrito', 'info');
}

async function vaciarCarrito() {
    const usuario = obtenerUsuarioActual();
    if (!usuario || !items.length) return;
    if (!window.confirm('¿Seguro que quieres vaciar el carrito?')) return;

    const supabase = await cargarCliente();
    ocupado = true;
    const { error } = await supabase
        .from(TABLA_CARRITO)
        .delete()
        .eq('user_id', usuario.id);
    ocupado = false;

    if (error) {
        console.error('Error al vaciar el carrito:', error);
        mostrarAviso(describirErrorCarrito(error), 'error');
        return;
    }

    items = [];
    render();
    mostrarAviso('Carrito vaciado', 'info');
}

function enviarPorWhatsapp() {
    if (!items.length) return;

    const lineas = items.map(item => {
        const cantidad = Number(item.quantity) || 1;
        const precio = Number(item.product_price) || 0;
        return `- ${cantidad} x ${item.product_name} (${formatearPrecio(precio * cantidad)})`;
    });

    const subtotal = items.reduce((suma, item) => suma + (Number(item.quantity) || 0) * (Number(item.product_price) || 0), 0);
    const mensaje = [
        'Hola The House of Parfum, quiero confirmar este pedido:',
        '',
        ...lineas,
        '',
        `Total: ${formatearPrecio(subtotal)}`
    ].join('\n');

    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener');
}