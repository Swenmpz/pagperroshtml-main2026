# The House of Parfum 

Tienda de perfumes (HTML + CSS + JavaScript) con **cuentas de usuario**, **carrito persistente**, **tema configurable** y **perfil personal** gracias a **Supabase**, lista para desplegar en **Netlify** desde **GitHub**.

---

## 0. Novedades

| Función | Dónde vive |
|---|---|
| Cambio de tema (Claro / Dorado) y color de acento | `configuracion.html` + `js/tema.js` + `style-temas.css` |
| Perfil personal del cliente (cumpleaños, ciudad, fragancia favorita...) | `perfil.html` + `js/perfil.js` |
| Tabla del perfil con RLS | `supabase/schema-perfil.sql` |

El tema se guarda en el navegador (`localStorage`) y se aplica sin parpadeo en todas las páginas. El perfil se guarda en la tabla `public.profiles` (solo el dueño puede leerlo) y, si Supabase no está conectado, funciona en modo local.

---

## 1. Qué incluye

| Función | Dónde vive |
|---|---|
| Inicio de sesión / registro de usuarios | `js/auth.js` (Supabase Auth) |
| Modal de acceso (sin salir de la página) | `js/auth.js` → `inyectarModal()` |
| Cliente único de Supabase | `js/supabase-cliente.js` |
| Carrito acumulativo por usuario | `js/carrito.js` + `supabase/schema.sql` |
| Página "Mi carrito" | `carrito.html` + `js/carrito-pagina.js` |
| Notificaciones flotantes | `js/avisos.js` |
| Punto de entrada | `js/app.js` |
| Esquema de base de datos | `supabase/schema.sql` |

Si Supabase no está configurado, **el catálogo sigue funcionando** y aparece un aviso indicando
que falta configurar las claves.

---

## 2. Crear la base de datos en Supabase

1. Entra a [supabase.com](https://supabase.com) → **New project**.
2. Cuando termine de crearse, abre **SQL Editor → New query**.
3. Pega **todo** el contenido de `supabase/schema.sql` y pulsa **Run**.

### Tablas y estructura creadas

#### Tabla `public.cart_items` (el carrito)

Una fila por **usuario + producto**. La cantidad se **acumula**, nunca se sobrescribe el carrito.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` (PK) | Generado con `gen_random_uuid()`. |
| `user_id` | `uuid` | FK → `auth.users(id)`, `ON DELETE CASCADE`. A qué usuario pertenece la fila. |
| `product_id` | `text` | Identificador estable del perfume (slug del nombre, ej. `dior-sauvage`). |
| `product_name` | `text` | Nombre visible del perfume. |
| `product_price` | `numeric(10,2)` | Precio unitario (`CHECK >= 0`). |
| `product_family` | `text` | Familia olfativa (Amaderado, Floral...). |
| `quantity` | `integer` | Cantidad acumulada (`CHECK > 0`), por defecto 1. |
| `created_at` | `timestamptz` | Fecha de creación (`now()`). |
| `updated_at` | `timestamptz` | Se actualiza solo con un trigger `BEFORE UPDATE`. |

**Restricción clave:** `UNIQUE (user_id, product_id)` → impide duplicar el mismo perfume
para el mismo usuario, y es la base del `ON CONFLICT ... DO UPDATE` que suma cantidades.
También hay un índice `cart_items_user_idx` sobre `user_id`.

#### Tabla `auth.users` (ya existe en Supabase)

La gestiona Supabase Auth: guarda correo, contraseña cifrada (bcrypt) y `user_metadata`
(donde guardamos el `nombre` del formulario de registro). **No se debe tocar ni modificar.**

#### Funciones (RPC) creadas

| Función | Para qué sirve |
|---|---|
| `agregar_al_carrito(product_id, product_name, product_price, product_family, cantidad)` | Inserta la fila o **suma la cantidad** si ese perfume ya estaba en el carrito. Es atómica. |
| `total_del_carrito()` | Devuelve el total en dinero del carrito del usuario actual. |
| `actualizar_marca_tiempo()` | Trigger que refresca `updated_at`. |

#### Seguridad: Row Level Security (RLS)

`cart_items` tiene RLS **activado** con 4 políticas (`select`, `insert`, `update`, `delete`)
que exigen `auth.uid() = user_id`. Resultado: **cada usuario solo puede ver y modificar su propio
carrito**, aunque alguien copie la `anon key` que va en el navegador.

---

## 3. Activar el acceso por correo en Supabase

En el panel de Supabase:

1. **Authentication → Providers → Email**: deja activado *Email* + *Password*.
   - Si **desactivas** "Confirm email", el usuario queda logueado al registrarse (más rápido para probar).
   - Si lo dejas **activado**, el usuario debe abrir el correo de confirmación antes de entrar.
2. **Authentication → URL Configuration**:
   - **Site URL**: la URL de tu web (ej. `https://tu-sitio.netlify.app`).
   - **Redirect URLs**: añade esa misma URL y, para desarrollo, `http://localhost:5173`.
3. Copia tus credenciales en **Project Settings**:
   - `SUPABASE_URL`: *Data API → Project URL*
   - `SUPABASE_ANON_KEY`: *API Keys → anon / publishable key*

> La `anon key` es **pública** y puede ir en el navegador: la seguridad real la da el RLS.
> Nunca uses la `service_role key` en el frontend.

---

## 4. Probar en local

Los módulos ES (`import`) **no funcionan abriendo el archivo con doble clic** (`file://`),
necesitas un servidor:

```bash
npm run dev      # crea la config y levanta http://localhost:5173
```

Antes, rellena tus claves:

1. Copia `.env.example` a `.env` y pon tus valores:
   ```
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_ANON_KEY=tu_anon_key_aqui
   ```
2. Ejecuta `npm run build` (genera `js/supabase-config.js`) o simplemente `npm run dev`,
   que ya lo hace por ti.

El archivo `.env` y `js/supabase-config.js` están en `.gitignore`: **tus claves nunca se suben a GitHub**.

> **¿No tienes Node.js instalado en tu PC?**
> No es obligatorio: Node solo se usa en el paso de build de Netlify (la nube).
> Para probar en local sin Node, copia `js/supabase-config.example.js` como
> `js/supabase-config.js`, escribe tus claves ahí y abre el proyecto con la extensión
> **Live Server** de VS Code (clic derecho sobre `index.html` → *Open with Live Server*).
> Recuerda que ese archivo **no** se sube a GitHub (está en `.gitignore`).

---

## 5. Despliegue en Netlify (desde GitHub)

### 5.1 Subir el proyecto a GitHub

```bash
git init
git add .
git commit -m "Tienda con Supabase Auth y carrito"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

### 5.2 Conectar Netlify

1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project → GitHub**.
2. Elige el repositorio. Netlify leerá `netlify.toml`, pero comprueba que quede así:

   | Ajuste | Valor |
   |---|---|
   | **Build command** | `npm run build` |
   | **Publish directory** | `.` |
   | **Base directory** | *(vacío)* |
   | **Node version** | 20 (viene en `netlify.toml`) |

3. **Site configuration → Environment variables → Add a variable**: crea estas dos
   (ámbito *All deploy contexts*):

   | Variable | Valor |
   |---|---|
   | `SUPABASE_URL` | `https://tu-proyecto.supabase.co` |
   | `SUPABASE_ANON_KEY` | tu clave `anon` / `publishable` |

   También puedes usar el nombre `SUPABASE_PUBLISHABLE_KEY`; `scripts/generate-config.js`
   acepta ambos.

4. Pulsa **Deploy site**. En el log del build verás:
   `[config] js/supabase-config.js generado correctamente.`
5. Copia tu URL (`https://algo.netlify.app`) y pégala en Supabase en
   **Authentication → URL Configuration → Site URL** y **Redirect URLs**.
6. Cada `git push` a `main` redepliega automáticamente. Si cambias una variable de entorno,
---

## 6. Cómo funciona el carrito (persistencia por usuario)

1. El usuario pulsa **Comprar**. Si no ha iniciado sesión, se abre el modal de acceso y,
   al entrar, **se guarda automáticamente el producto que había elegido**.
2. `agregarAlCarrito()` llama a la función RPC `agregar_al_carrito`:
   - Si el perfume no estaba → inserta una fila con `quantity = 1`.
   - Si ya estaba → `quantity = quantity + 1` (se **acumula**, no se sobrescribe).
   - Si la RPC no existe todavía, hay un respaldo que hace `select` + `update`/`insert`
     desde el cliente (mismo comportamiento).
3. La tabla usa `user_id = auth.uid()`, así que **al volver a entrar el usuario encuentra
   su carrito tal como lo dejó**, incluso desde otro dispositivo.
4. El contador del navbar (`#badge-carrito`) y la página `carrito.html` muestran el estado real
   leído de Supabase (cantidades, subtotal y total). Desde ahí se puede sumar, restar, quitar,
   vaciar o enviar el pedido por WhatsApp.

---

## 7. Estructura del proyecto

```
.
├── index.html              # Inicio
├── perfumes.html           # Catálogo con filtros
├── carrito.html            # Mi carrito (nueva)
├── blog.html               # Blog
├── contacto.html           # Contacto
├── style.css               # Estilos (incluye cuenta, carrito y avisos)
├── script.js               # Menú móvil, filtros, newsletter
├── js/
│   ├── app.js              # Punto de entrada de módulos
│   ├── supabase-cliente.js # Cliente único de Supabase
│   ├── supabase-config.js  # Generado en el build (en .gitignore)
│   ├── supabase-config.example.js
│   ├── auth.js             # Login / registro / sesión
│   ├── carrito.js          # Añadir al carrito + contador
│   ├── carrito-pagina.js   # Lógica de carrito.html
│   ── avisos.js           # Notificaciones flotantes
├── scripts/
│   ├── generate-config.js  # Crea la config desde variables de entorno
│   ── servidor-local.js   # Servidor local para desarrollo
├── supabase/
│   └── schema.sql          # Tablas, RLS, triggers y RPC
├── netlify.toml            # Configuración de despliegue
├── .env.example            # Plantilla de variables de entorno
└── .gitignore              # Protege .env y js/supabase-config.js
```

---

## 8. Preguntas frecuentes

**¿Por qué no puedo iniciar sesión con mi cuenta recién creada?**
Porque tienes activada la confirmación por correo. Revisa tu bandeja (y spam), confirma y entra.
También puedes desactivarla en *Authentication → Providers → Email*.

**Quiero usar otro número de WhatsApp para los pedidos.**
Cambia la constante `WHATSAPP` al inicio de `js/carrito-pagina.js`.

**¿Dónde cambio los precios?**
En los HTML del catálogo (`<span class="precio">S/650</span>`). Al pulsar *Comprar*, el precio
se lee de ahí y se guarda en el carrito.
   ve a **Deploys → Trigger deploy → Clear cache and deploy site**.
