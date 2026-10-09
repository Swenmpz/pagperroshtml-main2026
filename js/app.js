/* ------------------------------------------------------------------
   Punto de entrada de la tienda.
   Se carga como módulo en todas las páginas y arranca:
     · la autenticación (Supabase Auth + modal de acceso)
     · los favoritos del catálogo
     · el carrito (botones "Comprar" y contador del navbar)
     · la página "Mi carrito" si estamos en carrito.html
   Si Supabase no está configurado, el catálogo sigue funcionando.
------------------------------------------------------------------ */

import { iniciarFavoritos } from './favorites.js';

import { iniciarAutenticacion } from './auth.js';
import { iniciarCarrito } from './carrito.js';
import { iniciarPaginaCarrito } from './carrito-pagina.js';
import { iniciarPaginaPerfil } from './perfil.js';
import { iniciarAjustesTema } from './tema.js';

async function iniciar() {
    try {
        await iniciarAutenticacion();
    } catch (error) {
        console.error('No se pudo inicializar la autenticación:', error);
    }

    iniciarFavoritos();
    iniciarCarrito();
    iniciarPaginaCarrito();
    iniciarPaginaPerfil();
    iniciarAjustesTema();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
} else {
    void iniciar();
}