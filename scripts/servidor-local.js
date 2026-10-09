#!/usr/bin/env node
/* ------------------------------------------------------------------
   Servidor estático mínimo para probar la tienda en local.
   Necesario porque los módulos ES (import) no funcionan al abrir los
   archivos con doble clic (file://).

   Uso:  npm run dev      ->  http://localhost:5173
------------------------------------------------------------------ */

const http = require('http');
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const puerto = Number(process.env.PORT) || 5173;

const tipos = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8'
};

function responder(res, codigo, cuerpo, tipo) {
    res.writeHead(codigo, { 'Content-Type': tipo || 'text/plain; charset=utf-8' });
    res.end(cuerpo);
}

http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const relativa = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
    const archivo = path.join(raiz, relativa);

    // Evita salir de la carpeta del proyecto.
    if (!archivo.startsWith(raiz)) {
        responder(res, 403, 'Acceso denegado');
        return;
    }

    fs.readFile(archivo, (error, contenido) => {
        if (error) {
            responder(res, 404, `No encontrado: ${relativa}`);
            return;
        }

        responder(res, 200, contenido, tipos[path.extname(archivo).toLowerCase()]);
    });
}).listen(puerto, () => {
    console.log(`The House of Parfum disponible en http://localhost:${puerto}`);
});