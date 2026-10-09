/* ------------------------------------------------------------------
   PLANTILLA de configuración de Supabase.

   Este archivo NO contiene claves reales y sirve como referencia.

   Uso local (sin Netlify CLI):
     1. Copia este archivo y renómbralo a  js/supabase-config.js
     2. Rellena tus valores reales.
     3. NUNCA subas js/supabase-config.js al repositorio:
        ya está incluido en .gitignore.

   En producción (Netlify) este archivo se genera automáticamente con
   `npm run build` a partir de las variables de entorno SUPABASE_URL y
   SUPABASE_ANON_KEY (ver scripts/generate-config.js).
------------------------------------------------------------------ */

window.__ENV__ = {
    SUPABASE_URL: 'https://tu-proyecto.supabase.co',
    SUPABASE_ANON_KEY: 'tu_anon_key_aqui'
};