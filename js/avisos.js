/* ------------------------------------------------------------------
   Avisos y notificaciones flotantes de la tienda.
   Se usan desde auth.js, carrito.js y carrito-pagina.js.
------------------------------------------------------------------ */

const DURACION_MS = 4200;

function obtenerContenedor() {
    let contenedor = document.getElementById('avisos-flotantes');
    if (!contenedor) {
        contenedor = document.createElement('div');
        contenedor.id = 'avisos-flotantes';
        contenedor.className = 'avisos-flotantes';
        document.body.appendChild(contenedor);
    }
    return contenedor;
}

/**
 * Muestra una notificación flotante.
 * @param {string} mensaje texto a mostrar
 * @param {'info'|'exito'|'error'} tipo estilo del aviso
 */
export function mostrarAviso(mensaje, tipo = 'info') {
    if (!mensaje) return;
    const contenedor = obtenerContenedor();

    const aviso = document.createElement('div');
    aviso.className = `aviso-flotante aviso-${tipo}`;
    aviso.setAttribute('role', 'status');

    const texto = document.createElement('span');
    texto.textContent = mensaje;

    const cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'aviso-cerrar';
    cerrar.setAttribute('aria-label', 'Cerrar aviso');
    cerrar.textContent = '\u00d7';
    cerrar.addEventListener('click', () => aviso.remove());

    aviso.append(texto, cerrar);
    contenedor.appendChild(aviso);

    window.setTimeout(() => {
        aviso.classList.add('aviso-saliendo');
        window.setTimeout(() => aviso.remove(), 320);
    }, DURACION_MS);
}

/** Traduce los errores más comunes de Supabase Auth al español. */
export function traducirErrorAutenticacion(mensaje = '') {
    const texto = String(mensaje).toLowerCase();

    if (texto.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
    if (texto.includes('email not confirmed')) return 'Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.';
    if (texto.includes('user already registered')) return 'Ese correo ya tiene una cuenta. Inicia sesión.';
    if (texto.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.';
    if (texto.includes('unable to validate email') || texto.includes('invalid email')) return 'El correo electrónico no es válido.';
    if (texto.includes('rate limit') || texto.includes('too many requests')) return 'Demasiados intentos. Espera un momento e inténtalo otra vez.';
    if (texto.includes('signup is disabled')) return 'El registro está deshabilitado en este momento.';

    return mensaje || 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}

/** Aviso permanente cuando faltan las variables de entorno de Supabase. */
export function mostrarAvisoConfiguracion() {
    if (document.getElementById('aviso-configuracion')) return;

    const aviso = document.createElement('div');
    aviso.id = 'aviso-configuracion';
    aviso.className = 'aviso-configuracion';
    aviso.innerHTML = [
        '<strong>Falta configurar Supabase.</strong>',
        '<span>Crea un archivo <code>.env</code> con <code>SUPABASE_URL</code> y <code>SUPABASE_ANON_KEY</code>, ',
        'luego ejecuta <code>npm run build</code> (o copia <code>js/supabase-config.example.js</code> como ',
        '<code>js/supabase-config.js</code>). El catálogo funciona, pero el carrito y las cuentas están desactivados.</span>'
    ].join('');

    document.body.appendChild(aviso);
}
