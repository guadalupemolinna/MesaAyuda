const formE1 = document.querySelector('.form');

formE1.addEventListener('submit', async (event) => {
    // intercepta el submit del formulario.
    event.preventDefault();

    const formData = new FormData(formE1);
    const data = Object.fromEntries(formData);

    const resultado1 = document.getElementById('resultado1');
    const resultado2 = document.getElementById('resultado2');

    resultado1.textContent = '';
    resultado2.textContent = '';

    // Verifica que se hayan completado los campos.
    if (!data.contacto || !data.nombre || !data.password) {
        resultado1.style.color = 'red';
        resultado1.textContent = 'Complete correo, nombre y contraseña.';
        return;
    }

    // en una casilla marcada, FormData guarda el valor "on".
    if (data.termscondition !== 'on') {
        resultado2.style.color = 'red';
        resultado2.textContent = 'Debe aceptar los términos y condiciones.';
        return;
    }

    const RESTAPI = {
        addCliente: 'http://localhost:8080/api/addCliente'
    };

    // prepara los datos que el servidor necesita para crear el cliente.
    const cliente = {
        contacto: data.contacto,
        nombre: data.nombre,
        password: data.password
    };

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(cliente)
    };

    try {
        const res = await fetch(RESTAPI.addCliente, options);
        const respuesta = await res.json();

        if (respuesta.response === 'OK') {
            alert('Registro realizado. Ahora podés iniciar sesión.');

            window.location.href =
                'http://127.0.0.1:5500/HTML/loginClient.html';
        } else {
            resultado1.style.color = 'red';
            resultado1.textContent =
                respuesta.message || 'No se pudo realizar el registro.';
        }
    } catch (error) {
        console.error('Error al comunicarse con el servidor:', error);
        resultado1.style.color = 'red';
        resultado1.textContent =
            'No se pudo conectar con el servidor. Intente nuevamente.';
    }
});