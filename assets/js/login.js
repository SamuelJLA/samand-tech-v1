import supabase from './supabase.js';

const loginForm = document.getElementById('login-form');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Capturamos los datos del formulario
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = loginForm.querySelector('button');

        // Estado visual de carga
        const originalText = btn.innerText;
        btn.innerText = "Verificando en SAMAND TECH...";
        btn.disabled = true;

        // 2. INTENTO DE LOGIN REAL EN SUPABASE
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            // Si Supabase dice que están mal, mostramos el error real
            alert("❌ Acceso Denegado: " + error.message);
            btn.innerText = originalText;
            btn.disabled = false;
        } else {
            // 3. ¡ÉXITO! Supabase guarda la sesión automáticamente
            console.log("Bienvenido:", data.user.email);
            window.location.href = 'index.html';
        }
    });
}