import supabase from './supabase.js';

const loginForm = document.getElementById('login-form');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Captura de credenciales (mantenemos .trim() por seguridad)
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();
        const btn = loginForm.querySelector('button');

        // Estado visual de carga
        const originalText = btn.innerText;
        btn.innerText = "Verificando...";
        btn.disabled = true;

        try {
            // 2. Intento de autenticación
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) {
                // Si falla, mostramos error y reseteamos botón
                console.error("Auth error:", error.message);
                // Si tienes showToast global úsalo, si no, un log es suficiente para el usuario
                alert("Credenciales incorrectas. Intenta de nuevo."); 
                btn.innerText = originalText;
                btn.disabled = false;
                return;
            }

            // 3. Obtención del rol para redirección
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();

            if (profileError || !profile) {
                console.error("Profile error:", profileError);
                btn.innerText = originalText;
                btn.disabled = false;
                return;
            }

            // 4. Redirección inteligente
            if (profile.role === 'client') {
                window.location.href = 'portal-cliente/dashboard-cliente.html';
            } else if (profile.role === 'admin') {
                window.location.href = 'index.html'; // El Admin se queda en la raíz
            } else if (profile.role === 'tech') {
                window.location.href = 'portal-tech/dashboard.html'; // 🚀 El técnico a su nuevo portal
            }

        } catch (err) {
            console.error("Critical error:", err);
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}