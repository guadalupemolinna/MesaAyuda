const form = document.querySelector('.form');
const resultado = document.getElementById('resultado');

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    resultado.textContent = '';

    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    if (data.password !== data.passwordConfirm) {
        resultado.style.color = 'red';
        resultado.textContent = 'Las contraseñas no coinciden.';
        return;
    }

    const API = 'http://localhost:8080/api/resetCliente';

    try {
        const res = await fetch(API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contacto: data.contacto,
                password: data.password
            })
        });

        const respuesta = await res.json();

        if (respuesta.response === 'OK') {
            alert('Contraseña actualizada. Ya podés iniciar sesión.');
            window.location.href = 'loginClient.html';
        } else {
            resultado.style.color = 'red';
            resultado.textContent =
                respuesta.message || 'No se pudo cambiar la contraseña.';
        }
    } catch (error) {
        console.error('Error al comunicarse con el servidor:', error);
        resultado.style.color = 'red';
        resultado.textContent =
            'No se pudo conectar con el servidor. Intente nuevamente.';
    }
});