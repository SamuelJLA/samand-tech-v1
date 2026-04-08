import supabase from '../supabase.js';

// --- 1. NOTIFICACIONES (TOASTS) ---
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// --- 2. CARGA INICIAL DE DATOS ---
async function loadTechData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Llenar email (que es readonly)
    document.getElementById('tech-email').value = user.email;

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profile) {
        document.getElementById('tech-name').value = profile.full_name || '';
        document.getElementById('display-name-card').innerText = profile.full_name || 'Técnico';
        
        // Manejo de Avatar
        const img = document.getElementById('tech-img');
        const init = document.getElementById('tech-init');
        
        if (profile.avatar_url) {
            img.src = profile.avatar_url;
            img.style.display = 'block';
            init.style.display = 'none';
        } else {
            const initials = profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            init.innerText = initials || '??';
        }
    }
}

// --- 3. ACTUALIZAR PERFIL ---
async function updateTechProfile(e) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const newName = document.getElementById('tech-name').value;
    const newPass = document.getElementById('tech-password').value;

    try {
        // A. Actualizar Perfil (Nombre)
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ full_name: newName })
            .eq('id', user.id);

        if (profileError) throw profileError;

        // B. Actualizar Contraseña (si escribió algo)
        if (newPass.length >= 6) {
            const { error: authError } = await supabase.auth.updateUser({ password: newPass });
            if (authError) throw authError;
        } else if (newPass.length > 0 && newPass.length < 6) {
            showToast("La clave debe tener al menos 6 caracteres", "error");
            return;
        }

        showToast("¡Perfil actualizado, Alan Brito!", "success");
        document.getElementById('tech-password').value = ""; // Limpiar campo
        loadTechData(); // Refrescar vista
    } catch (err) {
        showToast("Error: " + err.message, "error");
    }
}

// --- 4. GESTIÓN DE AVATAR (FOTO) ---
async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const { data: { user } } = await supabase.auth.getUser();
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Math.random()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    try {
        showToast("Subiendo imagen...", "success");

        // Subir a Storage
        const { error: uploadError } = await supabase.storage
            .from('samandtech-media') // Asegúrate de que el bucket exista
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Obtener URL pública
        const { data: { publicUrl } } = supabase.storage
            .from('samandtech-media')
            .getPublicUrl(filePath);

        // Actualizar tabla profiles
        await supabase
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', user.id);

        showToast("¡Foto actualizada!", "success");
        loadTechData();
    } catch (err) {
        showToast("Error al subir foto", "error");
        console.error(err);
    }
}

// --- 5. INICIALIZACIÓN ---
function init() {
    loadTechData();

    const form = document.getElementById('tech-profile-form');
    if (form) form.addEventListener('submit', updateTechProfile);

    const avatarTrigger = document.getElementById('tech-avatar-trigger');
    const fileInput = document.getElementById('tech-file-input');

    if (avatarTrigger && fileInput) {
        avatarTrigger.onclick = () => fileInput.click();
        fileInput.onchange = handleAvatarUpload;
    }
}

init();