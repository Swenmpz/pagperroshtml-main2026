document.addEventListener('DOMContentLoaded', () => {

    const toggle = document.querySelector('.menu-toggle');
    const menu = document.querySelector('.menu');

    if (toggle && menu) {
        toggle.addEventListener('click', () => {
            menu.classList.toggle('abierto');
        });

        menu.querySelectorAll('a').forEach(enlace => {
            enlace.addEventListener('click', () => menu.classList.remove('abierto'));
        });
    }

    const filtros = document.querySelectorAll('.filtro-btn');
    const productos = document.querySelectorAll('[data-familia]');

    filtros.forEach(boton => {
        boton.addEventListener('click', () => {
            filtros.forEach(b => b.classList.remove('activo'));
            boton.classList.add('activo');

            const familia = boton.dataset.filtro;

            productos.forEach(producto => {
                const coincide = familia === 'todos' || producto.dataset.familia === familia;
                producto.style.display = coincide ? '' : 'none';
            });
        });
    });

    // Los favoritos se gestionan en js/favorites.js, usando la sesión real.
    const formNewsletter = document.querySelector('.form-linea');
    if (formNewsletter) {
        formNewsletter.addEventListener('submit', (evento) => {
            evento.preventDefault();
            const aviso = formNewsletter.parentElement.querySelector('.aviso');
            if (aviso) {
                aviso.textContent = 'Gracias, revisa tu correo para confirmar la suscripción.';
                aviso.classList.add('mostrar');
            }
            formNewsletter.reset();
        });
    }

    const formContacto = document.querySelector('.formulario');
    if (formContacto) {
        formContacto.addEventListener('submit', (evento) => {
            evento.preventDefault();
            const boton = formContacto.querySelector('button');
            boton.textContent = 'Mensaje enviado';
            formContacto.reset();
            setTimeout(() => { boton.textContent = 'Enviar mensaje'; }, 3000);
        });
    }

    const observador = new IntersectionObserver((entradas) => {
        entradas.forEach(entrada => {
            if (entrada.isIntersecting) {
                entrada.target.classList.add('visible');
                observador.unobserve(entrada.target);
            }
        });
    }, { threshold: 0.15 });

    document.querySelectorAll('.aparece').forEach(el => observador.observe(el));

});
