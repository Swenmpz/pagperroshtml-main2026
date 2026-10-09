#!/usr/bin/env node
/* ------------------------------------------------------------------
   Genera js/supabase-config.js a partir de variables de entorno.

   Fuente de datos, en orden de prioridad:
     1. Variables de entorno del sistema (Netlify las inyecta en el build):
        SUPABASE_URL  y  SUPABASE_ANON_KEY  (o SUPABASE_PUBLISHABLE_KEY)
     2. Archivo .env en la raíz del proyecto (uso local).

   Así ninguna clave queda escrita en el código fuente versionado.
------------------------------------------------------------------ */

const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const destino = path.join(raiz, 'js', 'supabase-config.js');
const archivoEnv = path.join(raiz, '.env');

/** Lee un .env sencillo (clave=valor) sin dependencias externas. */
function leerArchivoEnv() {
    const valores = {};

    if (!fs.existsSync(archivoEnv)) return valores;

    fs.readFileSync(archivoEnv, 'utf8')
        .split(/\r?\n/)
        .forEach(linea => {
            const limpia = linea.trim();
            if (!limpia || limpia.startsWith('#')) return;

            const separador = limpia.indexOf('=');
            if (separador === -1) return;

            const clave = limpia.slice(0, separador).trim();
            let valor = limpia.slice(separador + 1).trim();

            if ((valor.startsWith('"') && valor.endsWith('"')) ||
                (valor.startsWith("'") && valor.endsWith("'"))) {
                valor = valor.slice(1, -1);
            }

            valores[clave] = valor;
        });

    return valores;
}

const env = leerArchivoEnv();

const url = (process.env.SUPABASE_URL || env.SUPABASE_URL || '').trim();
const clave = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    ''
).trim();

const contenido = `/* Archivo generado automáticamente por scripts/generate-config.js.
   No lo edites a mano y no lo subas al repositorio (.gitignore). */
window.__ENV__ = {
    SUPABASE_URL: ${JSON.stringify(url)},
    SUPABASE_ANON_KEY: ${JSON.stringify(clave)}
};
`;

fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, contenido, 'utf8');

if (url && clave) {
    console.log('[config] js/supabase-config.js generado correctamente.');
    console.log(`[config] SUPABASE_URL = ${url}`);
} else {
    console.warn('[config] ATENCION: faltan variables de Supabase.');
    console.warn('[config] Define SUPABASE_URL y SUPABASE_ANON_KEY (o crea un archivo .env)');
    console.warn('[config] y vuelve a ejecutar "npm run build". El catalogo funcionara,');
    console.warn('[config] pero el inicio de sesion y el carrito quedaran desactivados.');
}