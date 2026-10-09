/* ------------------------------------------------------------------
   Mi perfil (perfil.html)
   · Datos personales del cliente: nombre, cumpleaños, género, ciudad,
     dirección, fragancia favorita, notas que le gustan, alergias...
   · Se guardan en la tabla pública.profiles (una fila por usuario).
   · Si Supabase no está configurado, se usan solo el navegador
     (localStorage) para que la página nunca quede inútil.
------------------------------------------------------------------ */

import { cargarCliente, supabaseConfigurado } from './supabase-cliente.js';
import {
    obtenerUsuarioActual,
    alCambiarSesion,
    abrirModalAuth
} from './auth.js';
import { mostrarAviso } from './avisos.js';

export const TABLA_PERFILES = 'profiles';

const CLAVE_LOCAL = 'thop-perfil-local';
const CAMPOS = [
    'nombre_completo',
    'fecha_nacimiento',
    'genero',
    'telefono',
    'ciudad',
    'direccion',
    'referencia',
    'fragancia_favorita',
    'familia_preferida',
    'notas_favoritas',
    'busca_que',
    'alergias',
    'como_nos_conocio',
    'acepta_novedades'
];

let perfilIniciado = false;

/* ------------------------------ Utilidades ------------------------------ */

function leerLocal() {
    try {
        return JSON.parse(localStorage.getItem(CLAVE_LOCAL) || '{}');
    } catch (error) {
        return {};
    }
}

function guardarLocal(datos) {
    try {
        localStorage.setItem(CLAVE_LOCAL, JSON.stringify(datos));
    } catch (error) {
        /* modo privado: se queda en memoria y ya */
    }
}

function extraerCampos(formulario) {
    const datos = {};
    for (const campo of CAMPOS) {
        const elemento = formulario.elements[campo];
        if (!elemento) continue;

        if (elemento.type === 'checkbox') {
            datos[campo] = elemento.checked;
        } else {
            datos[campo] = String(elemento.value || '').trim();
        }
    }
    return datos;
}

function rellenarFormulario(datos) {
    const formulario = document.getElementById('form-perfil');
    if (!formulario || !datos) return;

    for (const campo of CAMPOS) {
        const elemento = formulario.elements[campo];
        if (!elemento) continue;

        const valor = datos[campo];
        if (elemento.type === 'checkbox') {
            elemento.checked = Boolean(valor);
        } else if (valor != null && valor !== '') {
            elemento.value = valor;
        }
    }
}

function pintarResumen(usuario, datos) {
    const avatar = document.getElementById('perfil-avatar');
    const nombre = document.getElementById('perfil-nombre');
    const correo = document.getElementById('perfil-correo');

    const nombreVisible = (datos && datos.nombre_completo)
        || (usuario && usuario.user_metadata && usuario.user_metadata.nombre)
        || (usuario ? String(usuario.email || '').split('@')[0] : 'Tu cuenta');

    if (avatar) {
        const iniciales = String(nombreVisible)
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(parte => parte[0].toUpperCase())
            .join('');
        avatar.textContent = iniciales || 'HP';
    }
    if (nombre) nombre.textContent = nombreVisible;
    if (correo) {
        correo.textContent = usuario
            ? usuario.email || ''
            : 'Sin sesión: tus cambios se guardan solo en este navegador.';
    }
}

function gestionarSesion(usuario) {
    const aviso = document.getElementById('perfil-aviso-sesion');
    const boton = document.getElementById('perfil-iniciar-sesion');
    if (!aviso || !boton) return;

    aviso.hidden = Boolean(usuario);
    boton.hidden = Boolean(usuario);
}

/* --------------------------- Carga y guardado --------------------------- */

async function cargarPerfil(usuario) {
    const datosLocales = leerLocal();
    rellenarFormulario(datosLocales);
    pintarResumen(usuario, datosLocales);

    if (!supabaseConfigurado || !usuario) return;

    let supabase;
    try {
        supabase = await cargarCliente();
    } catch (error) {
        return;
    }

    const { data, error } = await supabase
        .from(TABLA_PERFILES)
        .select('*')
        .eq('user_id', usuario.id)
        .maybeSingle();

    if (error) {
        if (error.code === '42P01' || /does not exist|could not find the table/i.test(error.message || '')) {
            mostrarAviso('Falta crear la tabla de perfil. Ejecuta supabase/schema-perfil.sql en Supabase.', 'info');
        }
        return;
    }

    if (data) {
        rellenarFormulario(data);
        guardarLocal(data);
        pintarResumen(usuario, data);
    }
}

async function guardarPerfil(evento) {
    evento.preventDefault();

    const formulario = evento.currentTarget;
    const usuario = obtenerUsuarioActual();
    const datos = extraerCampos(formulario);

    if (!datos.nombre_completo) {
        mostrarAviso('Escribe tu nombre para guardar el perfil.', 'error');
        return;
    }

    guardarLocal(datos);
    pintarResumen(usuario, datos);

    if (!supabaseConfigurado) {
        mostrarAviso('Perfil guardado en este navegador (falta conectar Supabase para la nube).', 'info');
        return;
    }

    if (!usuario) {
        mostrarAviso('Inicia sesión para sincronizar tu perfil en tu cuenta.', 'info');
        abrirModalAuth('login');
        return;
    }

    let supabase;
    try {
        supabase = await cargarCliente();
    } catch (error) {
        mostrarAviso(error.message, 'error');
        return;
    }

    const { error } = await supabase
        .from(TABLA_PERFILES)
        .upsert({ ...datos, user_id: usuario.id, updated_at: new Date().toISOString() });

    if (error) {
        console.error('No se pudo guardar el perfil:', error);
        mostrarAviso(
            (error.code === '42P01' || /does not exist/i.test(error.message || ''))
                ? 'Falta crear la tabla de perfil. Ejecuta supabase/schema-perfil.sql en Supabase.'
                : 'No pudimos guardar tu perfil. Inténtalo de nuevo.',
            'error'
        );
        return;
    }

    mostrarAviso('Perfil guardado en tu cuenta.', 'exito');
}

/* ------------------------------ Arranque -------------------------------- */

export function iniciarPaginaPerfil() {
    if (perfilIniciado) return;
    const formulario = document.getElementById('form-perfil');
    if (!formulario) return;
    perfilIniciado = true;

    formulario.addEventListener('submit', guardarPerfil);

    const botonEntrar = document.getElementById('perfil-iniciar-sesion');
    if (botonEntrar) botonEntrar.addEventListener('click', () => abrirModalAuth('login'));

    alCambiarSesion(usuario => {
        gestionarSesion(usuario);
        void cargarPerfil(usuario);
    });
}

