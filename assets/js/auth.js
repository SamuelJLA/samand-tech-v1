import supabase from './supabase.js';

// Capturamos el formulario de login
const loginForm = document.getElementById('login-form');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = loginForm.querySelector('button');

        // Efecto visual de carga en el botón
        const originalText = btn.innerText;
        btn.innerText = "Verificando en SAMAND TECH...";
        btn.disabled = true;

        // --- LOGIN REAL CON SUPABASE ---
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            // Si las credenciales no existen en Supabase, saldrá este error
            alert("❌ Error de acceso: " + error.message);
            btn.innerText = originalText;
            btn.disabled = false;
        } else {
            // ¡Éxito! Supabase maneja la sesión por nosotros
            console.log("Acceso concedido para:", data.user.email);
            window.location.href = 'index.html';
        }
    });
}