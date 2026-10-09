/* ------------------------------------------------------------------
   Cliente único de Supabase para toda la tienda.

   Las claves NO están escritas aquí: llegan desde window.__ENV__, que
   se rellena con js/supabase-config.js (archivo generado en el build a
   partir de las variables de entorno SUPABASE_URL y SUPABASE_ANON_KEY,
   ver scripts/generate-config.js).

   La librería se descarga del CDN de forma dinámica y solo si hay
   claves configuradas, así el catálogo sigue funcionando (sin errores
   en consola) cuando el proyecto aún no está conectado a Supabase.
------------------------------------------------------------------ */

const URL_LIBRERIA = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const entorno = window.__ENV__ || {};

export const SUPABASE_URL = String(entorno.SUPABASE_URL || '').trim();
export const SUPABASE_ANON_KEY = String(entorno.SUPABASE_ANON_KEY || '').trim();

/** true cuando las variables de entorno están presentes. */
export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let cliente = null;
let promesaCarga = null;

/**
 * Devuelve el cliente de Supabase (creándolo la primera vez).
 * Lanza un error legible si la configuración está incompleta.
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient>}
 */
export async function cargarCliente() {
    if (!supabaseConfigurado) {
        throw new Error('Supabase no está configurado (faltan SUPABASE_URL y SUPABASE_ANON_KEY).');
    }

    if (cliente) return cliente;

    if (!promesaCarga) {
        promesaCarga = import(URL_LIBRERIA)
            .then(modulo => {
                cliente = modulo.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true,
                        storageKey: 'house-of-parfum-sesion'
                    }
                });
                return cliente;
            })
            .catch(error => {
                promesaCarga = null;
                throw new Error(`No se pudo cargar la librería de Supabase: ${error.message}`);
            });
    }

    return promesaCarga;
}

/**
 * Devuelve la sesión actual (o null) sin provocar errores si
 * Supabase no está configurado.
 */
export async function obtenerSesion() {
    try {
        const supabase = await cargarCliente();
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        return data.session || null;
    } catch (error) {
        if (supabaseConfigurado) console.warn('No se pudo leer la sesión:', error.message);
        return null;
    }
}
