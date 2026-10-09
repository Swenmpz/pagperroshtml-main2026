/* ------------------------------------------------------------------ *
 * Ajustes de apariencia: tema claro / dorado y color de acento.
 * La elección se guarda en este dispositivo (localStorage) y se aplica
 * en todas las páginas gracias al pequeño script que va en el <head>.
 * ------------------------------------------------------------------ */

const CLAVE_TEMA = 'thop-tema';
const CLAVE_ACCENTO = 'thop-acento';

const TEMAS = {
    claro: {
        nombre: 'Claro',
        descripcion: 'Fresco y minimal: fondos blancos con acentos suaves. El de todos los días.'
    },
    dorado: {
        nombre: 'Dorado',
        descripcion: 'El clásico de la casa: negro espresso con detalles dorados. Para gustos elegantes.'
    }
};

const ACENTOS = {
    turquesa: 'Turquesa',
    dorado: 'Dorado',
    vino: 'Vino',
    verde: 'Verde'
};

/** Tema guardado, o 'claro' si no hay nada aún. */
export function leerTema() {
    try {
        const valor = localStorage.getItem(CLAVE_TEMA);
        return valor === 'dorado' ? 'dorado' : 'claro';
    } catch (error) {
        return 'claro';
    }
}

/** Acento guardado, o el del propio tema si no hay nada aún. */
export function leerAcento() {
    try {
        const valor = localStorage.getItem(CLAVE_ACCENTO);
        if (valor && ACENTOS[valor]) return valor;
    } catch (error) {
        /* localStorage puede no estar disponible (modo privado). */
    }
    return leerTema() === 'dorado' ? 'dorado' : 'turquesa';
}

/**
 * Aplica tema + acento al documento y los recuerda en este dispositivo.
 * Desactiva style-modern.css cuando el tema es "dorado" para que
 * resplandezca el look clásico de style.css.
 */
export function aplicarTema(tema, acento) {
    const raiz = document.documentElement;
    const elegido = tema === 'dorado' ? 'dorado' : 'claro';
    const color = (acento && ACENTOS[acento]) ? acento : (elegido === 'dorado' ? 'dorado' : 'turquesa');

    raiz.setAttribute('data-tema', elegido);
    raiz.setAttribute('data-acento', color);

    const hojaModerna = document.getElementById('css-moderna');
    if (hojaModerna) hojaModerna.disabled = elegido === 'dorado';

    try {
        localStorage.setItem(CLAVE_TEMA, elegido);
        localStorage.setItem(CLAVE_ACCENTO, color);
    } catch (error) {
        /* Sin persistencia el tema igual se ve bien durante la visita. */
    }

    window.dispatchEvent(new CustomEvent('thop:tema', { detail: { tema: elegido, acento: color } }));
}

/* ------------------------------ Interfaz ------------------------------- */

let ajustesIniciados = false;

function marcarActivo(selector, atributo, valor) {
    document.querySelectorAll(selector).forEach(boton => {
        boton.classList.toggle('activo', boton.dataset[atributo] === valor);
        boton.setAttribute('aria-pressed', String(boton.dataset[atributo] === valor));
    });
}

function refrescarUI() {
    marcarActivo('[data-tema-elegir]', 'temaElegir', leerTema());
    marcarActivo('[data-acento-elegir]', 'acentoElegir', leerAcento());
}

/** Conecta los botones de la página configuración.html. */
export function iniciarAjustesTema() {
    if (ajustesIniciados) return;
    const contenedor = document.querySelector('.tema-opciones');
    if (!contenedor) return;
    ajustesIniciados = true;

    document.querySelectorAll('[data-tema-elegir]').forEach(boton => {
        boton.addEventListener('click', () => {
            aplicarTema(boton.dataset.temaElegir, leerAcento());
            refrescarUI();
        });
    });

    document.querySelectorAll('[data-acento-elegir]').forEach(boton => {
        boton.addEventListener('click', () => {
            aplicarTema(leerTema(), boton.dataset.acentoElegir);
            refrescarUI();
        });
    });

    refrescarUI();
}
