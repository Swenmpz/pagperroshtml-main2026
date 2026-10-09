/* ------------------------------------------------------------------
   Autenticación con Supabase Auth.
   · Modal de "Iniciar sesión" / "Crear cuenta" (sin cambiar de URL).
   · Estado de la sesión en el navbar (nombre + menú de cuenta).
   · Persistencia: la sesión se guarda en el navegador, así que al
     volver a entrar el usuario sigue conectado y con su carrito.
------------------------------------------------------------------ */

import { cargarCliente, supabaseConfigurado } from './supabase-cliente.js';
import { mostrarAviso, mostrarAvisoConfiguracion, traducirErrorAutenticacion } from './avisos.js';

let usuarioActual = null;
let sesionLista = false;
let accionPendiente = null;
let inicializado = false;
const suscriptores = new Set();

/* ------------------------------ API pública ------------------------------ */

/** Registra un callback que se ejecuta cada vez que cambia la sesión. */
export function alCambiarSesion(callback) {
    if (typeof callback !== 'function') return () => {};
    suscriptores.add(callback);
    if (sesionLista) callback(usuarioActual);
    return () => suscriptores.delete(callback);
}

/** Usuario conectado actualmente (o null). */
export function obtenerUsuarioActual() {
    return usuarioActual;
}

/** Guarda una acción para ejecutarla justo después de iniciar sesión. */
export function ejecutarTrasIniciarSesion(accion) {
    accionPendiente = typeof accion === 'function' ? accion : null;
}

/** Cierra la sesión del usuario. */
export async function cerrarSesion() {
    try {
        const supabase = await cargarCliente();
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        mostrarAviso('Sesión cerrada. ¡Hasta pronto!', 'info');
    } catch (error) {
        if (supabaseConfigurado) mostrarAviso(traducirErrorAutenticacion(error.message), 'error');
    }
}

/* ------------------------------ Arranque ------------------------------ */

export async function iniciarAutenticacion() {
    if (inicializado) return;
    inicializado = true;

    inyectarModal();
    conectarControlesNavbar();

    if (!supabaseConfigurado) {
        mostrarAvisoConfiguracion();
        sesionLista = true;
        actualizarNavbar();
        notificar();
        return;
    }

    let supabase;
    try {
        supabase = await cargarCliente();
    } catch (error) {
        mostrarAviso(error.message, 'error');
        sesionLista = true;
        actualizarNavbar();
        notificar();
        return;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
        console.warn('No se pudo leer la sesión guardada:', error.message);
    }
    aplicarSesion(data ? data.session : null);

    supabase.auth.onAuthStateChange((evento, sesion) => {
        aplicarSesion(sesion);

        if (evento === 'SIGNED_IN') {
            cerrarModalAuth();
            if (accionPendiente) {
                const accion = accionPendiente;
                accionPendiente = null;
                window.setTimeout(() => accion(), 0);
            }
        }
    });
}

/* ------------------------------ Internos ------------------------------ */

function aplicarSesion(sesion) {
    usuarioActual = (sesion && sesion.user) || null;
    sesionLista = true;
    actualizarNavbar();
    notificar();
}

function notificar() {
    // setTimeout evita llamar a Supabase dentro del lock interno de Auth.
    window.setTimeout(() => {
        suscriptores.forEach(callback => {
            try {
                callback(usuarioActual);
            } catch (error) {
                console.error('Error en un suscriptor de sesión:', error);
            }
        });
    }, 0);
}

function nombreVisible(user) {
    if (!user) return '';
    const meta = user.user_metadata || {};
    const nombre = meta.nombre || meta.full_name || meta.name;
    if (nombre) return String(nombre).split(' ')[0];
    return String(user.email || '').split('@')[0];
}

function escaparHtml(texto) {
    return String(texto).replace(/[&<>"']/g, caracter => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[caracter]));
}

function actualizarNavbar() {
    const boton = document.getElementById('nav-sesion');
    const menu = document.getElementById('sesion-menu');
    if (!boton || !menu) return;

    if (!usuarioActual) {
        boton.textContent = 'Iniciar sesión';
        boton.classList.remove('conectado');
        boton.setAttribute('aria-expanded', 'false');
        menu.hidden = true;
        menu.innerHTML = '';
        return;
    }

    boton.textContent = `Hola, ${nombreVisible(usuarioActual)}`;
    boton.classList.add('conectado');
    boton.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
    menu.innerHTML = [
        `<span class="sesion-correo">${escaparHtml(usuarioActual.email || '')}</span>`,
        '<a href="perfil.html">Mi perfil</a>',
        '<a href="carrito.html">Mi carrito</a>',
        '<a href="configuracion.html">Configuración</a>',
        '<button type="button" id="sesion-salir">Cerrar sesión</button>'
    ].join('');

    const salir = menu.querySelector('#sesion-salir');
    if (salir) salir.addEventListener('click', cerrarSesion);
}

/** Abre el modal de acceso en la pestaña indicada ('login' | 'registro'). */
export function abrirModalAuth(vista = 'login') {
    const modal = document.getElementById('modal-auth');
    if (!modal) return;

    cambiarVista(vista);
    limpiarMensaje();
    modal.hidden = false;
    modal.classList.add('abierto');
    document.body.classList.add('sin-scroll');

    window.setTimeout(() => {
        const campo = modal.querySelector('.vista-auth:not([hidden]) input');
        if (campo) campo.focus();
    }, 60);
}

/** Cierra el modal de acceso. */
export function cerrarModalAuth() {
    const modal = document.getElementById('modal-auth');
    if (!modal) return;

    modal.classList.remove('abierto');
    modal.hidden = true;
    document.body.classList.remove('sin-scroll');
    limpiarMensaje();
}

function cambiarVista(vista) {
    const modal = document.getElementById('modal-auth');
    if (!modal) return;

    modal.querySelectorAll('.tab-auth').forEach(tab => {
        tab.classList.toggle('activo', tab.dataset.vista === vista);
    });

    modal.querySelectorAll('.vista-auth').forEach(seccion => {
        seccion.hidden = seccion.dataset.vista !== vista;
    });

    const titulo = modal.querySelector('#modal-auth-titulo');
    if (titulo) {
        titulo.textContent = vista === 'registro' ? 'Crea tu cuenta' : 'Bienvenido de vuelta';
    }
}

function limpiarMensaje() {
    const mensaje = document.getElementById('auth-mensaje');
    if (!mensaje) return;
    mensaje.textContent = '';
    mensaje.className = 'auth-mensaje';
}

function mostrarMensaje(texto, tipo = 'error') {
    const mensaje = document.getElementById('auth-mensaje');
    if (!mensaje) return;
    mensaje.textContent = texto;
    mensaje.className = `auth-mensaje mostrar ${tipo}`;
}

function conectarControlesNavbar() {
    const boton = document.getElementById('nav-sesion');
    const menu = document.getElementById('sesion-menu');

    if (!boton || !menu) return;

    boton.addEventListener('click', evento => {
        evento.stopPropagation();

        if (!usuarioActual) {
            abrirModalAuth('login');
            return;
        }

        const abierto = !menu.hidden;
        menu.hidden = abierto;
        boton.setAttribute('aria-expanded', String(!abierto));
    });

    document.addEventListener('click', evento => {
        if (menu.hidden) return;
        if (!menu.contains(evento.target) && evento.target !== boton) {
            menu.hidden = true;
            boton.setAttribute('aria-expanded', 'false');
        }
    });
}

function inyectarModal() {
    if (document.getElementById('modal-auth')) return;

    const modal = document.createElement('div');
    modal.id = 'modal-auth';
    modal.className = 'modal-fondo';
    modal.hidden = true;
    modal.innerHTML = `
        <div class="modal-auth" role="dialog" aria-modal="true" aria-labelledby="modal-auth-titulo">
            <button type="button" class="modal-cerrar" id="modal-auth-cerrar" aria-label="Cerrar">&times;</button>

            <span class="eyebrow">Tu cuenta</span>
            <h3 id="modal-auth-titulo">Bienvenido de vuelta</h3>

            <div class="tabs-auth" role="tablist">
                <button type="button" class="tab-auth activo" data-vista="login">Iniciar sesión</button>
                <button type="button" class="tab-auth" data-vista="registro">Crear cuenta</button>
            </div>

            <form class="vista-auth" data-vista="login" id="form-login" novalidate>
                <div class="campo">
                    <label for="login-correo">Correo electrónico</label>
                    <input type="email" id="login-correo" name="correo" autocomplete="email" required>
                </div>
                <div class="campo">
                    <label for="login-clave">Contraseña</label>
                    <input type="password" id="login-clave" name="clave" autocomplete="current-password" required>
                </div>
                <button type="submit">Entrar</button>
            </form>

            <form class="vista-auth" data-vista="registro" id="form-registro" hidden novalidate>
                <div class="campo">
                    <label for="registro-nombre">Nombre</label>
                    <input type="text" id="registro-nombre" name="nombre" autocomplete="given-name" required>
                </div>
                <div class="campo">
                    <label for="registro-correo">Correo electrónico</label>
                    <input type="email" id="registro-correo" name="correo" autocomplete="email" required>
                </div>
                <div class="campo">
                    <label for="registro-clave">Contraseña <small>(mínimo 6 caracteres)</small></label>
                    <input type="password" id="registro-clave" name="clave" autocomplete="new-password" minlength="6" required>
                </div>
                <div class="campo">
                    <label for="registro-clave2">Repite la contraseña</label>
                    <input type="password" id="registro-clave2" name="clave2" autocomplete="new-password" minlength="6" required>
                </div>
                <button type="submit">Crear mi cuenta</button>
            </form>

            <p class="auth-mensaje" id="auth-mensaje" role="status"></p>
            <p class="auth-nota">Tu carrito se guarda en tu cuenta y te espera cada vez que vuelvas.</p>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#modal-auth-cerrar').addEventListener('click', cerrarModalAuth);
    modal.addEventListener('click', evento => {
        if (evento.target === modal) cerrarModalAuth();
    });
    document.addEventListener('keydown', evento => {
        if (evento.key === 'Escape') cerrarModalAuth();
    });

    modal.querySelectorAll('.tab-auth').forEach(tab => {
        tab.addEventListener('click', () => {
            cambiarVista(tab.dataset.vista);
            limpiarMensaje();
            const campo = modal.querySelector('.vista-auth:not([hidden]) input');
            if (campo) campo.focus();
        });
    });

    modal.querySelector('#form-login').addEventListener('submit', manejarLogin);
    modal.querySelector('#form-registro').addEventListener('submit', manejarRegistro);
}

async function manejarLogin(evento) {
    evento.preventDefault();

    const formulario = evento.currentTarget;
    const correo = formulario.correo.value.trim();
    const clave = formulario.clave.value;

    if (!correo || !clave) {
        mostrarMensaje('Completa tu correo y contraseña.');
        return;
    }

    const boton = formulario.querySelector('button[type="submit"]');
    const textoOriginal = boton.textContent;
    boton.disabled = true;
    boton.textContent = 'Entrando...';

    try {
        const supabase = await cargarCliente();
        const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
        if (error) throw error;

        formulario.reset();
        mostrarAviso('Bienvenido a The House of Parfum', 'exito');
        cerrarModalAuth();
    } catch (error) {
        mostrarMensaje(traducirErrorAutenticacion(error.message));
    } finally {
        boton.disabled = false;
        boton.textContent = textoOriginal;
    }
}

async function manejarRegistro(evento) {
    evento.preventDefault();

    const formulario = evento.currentTarget;
    const nombre = formulario.nombre.value.trim();
    const correo = formulario.correo.value.trim();
    const clave = formulario.clave.value;
    const clave2 = formulario.clave2.value;

    if (!nombre || !correo || !clave) {
        mostrarMensaje('Completa todos los campos para crear tu cuenta.');
        return;
    }

    if (clave.length < 6) {
        mostrarMensaje('La contraseña debe tener al menos 6 caracteres.');
        return;
    }

    if (clave !== clave2) {
        mostrarMensaje('Las contraseñas no coinciden.');
        return;
    }

    const boton = formulario.querySelector('button[type="submit"]');
    const textoOriginal = boton.textContent;
    boton.disabled = true;
    boton.textContent = 'Creando cuenta...';

    try {
        const supabase = await cargarCliente();
        const { data, error } = await supabase.auth.signUp({
            email: correo,
            password: clave,
            options: { data: { nombre } }
        });
        if (error) throw error;

        formulario.reset();

        if (data && data.session) {
            mostrarAviso(`¡Bienvenido, ${nombre}!`, 'exito');
            cerrarModalAuth();
        } else {
            mostrarMensaje('Cuenta creada. Revisa tu correo, confirma tu cuenta y luego inicia sesión.', 'exito');
            cambiarVista('login');
        }
    } catch (error) {
        mostrarMensaje(traducirErrorAutenticacion(error.message));
    } finally {
        boton.disabled = false;
        boton.textContent = textoOriginal;
    }
}
