import supabase from './supabase.js';

let currentAdminId = null;

async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = 'login.html'; return; }
    currentAdminId = user.id;

    // 1. Cargar datos del Admin actual (Ahora incluye la lógica del avatar en la tarjeta)
    loadAdminProfile();
    
    // 2. Configurar Tabs
    setupTabs();

    // 3. Eventos de Perfil (Corregido para recargar la foto al subirla)
    setupProfileEvents();

    // 4. Gestión de Usuarios
    setupUserEvents();
}

// --- PESTAÑAS (TABS) ---
function setupTabs() {
    const btnProfile = document.getElementById('btn-tab-profile');
    const btnUsers = document.getElementById('btn-tab-users');
    const tabProfile = document.getElementById('tab-profile');
    const tabUsers = document.getElementById('tab-users');

    btnProfile.onclick = () => {
        btnProfile.style.color = '#6366f1'; btnProfile.style.borderBottom = '2px solid #6366f1';
        btnUsers.style.color = '#64748b'; btnUsers.style.borderBottom = 'none';
        tabProfile.classList.add('active'); tabUsers.classList.remove('active');
    };

    btnUsers.onclick = () => {
        btnUsers.style.color = '#6366f1'; btnUsers.style.borderBottom = '2px solid #6366f1';
        btnProfile.style.color = '#64748b'; btnProfile.style.borderBottom = 'none';
        tabUsers.classList.add('active'); tabProfile.classList.remove('active');
        fetchUsers();
    };
}

// --- MI PERFIL ---
async function loadAdminProfile() {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentAdminId).single();
    
    if (profile) {
        // 1. Actualizar inputs (Solo si existen en el HTML)
        const nameInput = document.getElementById('admin-name');
        const nameCard = document.getElementById('display-name-card');
        const topDisplayName = document.getElementById('user-display-name'); // El que da error

        if (nameInput) nameInput.value = profile.full_name;
        if (nameCard) nameCard.innerText = profile.full_name;
        
        // Esta es la línea que fallaba. Ahora es segura:
        if (topDisplayName) topDisplayName.innerText = profile.full_name;

        // 2. Cargar el Email
        const { data: { user } } = await supabase.auth.getUser();
        const emailInput = document.getElementById('admin-email');
        if (emailInput && user) emailInput.value = user.email;

        // 3. Lógica del Avatar (La que se bloqueaba por el error de arriba)
        const avatarImg = document.getElementById('admin-img');
        const avatarInit = document.getElementById('admin-init');

        if (avatarImg && avatarInit) {
            if (profile.avatar_url) {
                avatarImg.src = profile.avatar_url;
                avatarImg.style.display = 'block';
                avatarInit.style.display = 'none';
            } else {
                const initials = profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                avatarInit.innerText = initials;
                avatarInit.style.display = 'flex';
                avatarImg.style.display = 'none';
            }
        }
    }
}

function setupProfileEvents() {
    // Foto
    const trigger = document.getElementById('admin-avatar-trigger');
    const input = document.getElementById('admin-file-input');
    trigger.onclick = () => input.click();

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Mostrar cargando... (Opcional, pero recomendado)
        document.getElementById('admin-init').innerText = "...";

        const fileName = `${currentAdminId}-${Date.now()}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(`user-avatars/${fileName}`, file);
        
        if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(`user-avatars/${fileName}`);
            await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', currentAdminId);
            
            // --- 🚀 SOLUCIÓN: VOLVER A CARGAR EL PERFIL ---
            // Esto hace que la nueva foto se muestre en lugar de las iniciales de "JA"
            // sin tener que recargar toda la página.
            loadAdminProfile(); 
        } else {
            alert("Error al subir foto: " + uploadError.message);
        }
    };

    // Datos
    document.getElementById('admin-profile-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('admin-name').value;
        const pass = document.getElementById('admin-password').value;
        
        await supabase.from('profiles').update({ full_name: name }).eq('id', currentAdminId);
        if (pass.length >= 6) await supabase.auth.updateUser({ password: pass });
        
        alert("✅ Perfil actualizado correctamente");
        loadAdminProfile(); // Sincroniza la tarjeta por si acaso
    };
}

// --- GESTIÓN DE USUARIOS ---
async function fetchUsers() {
    const { data: profiles } = await supabase.from('profiles').select('*').order('full_name');
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = profiles.map(p => `
        <tr>
            <td><strong>${p.full_name}</strong></td>
            <td>${p.email || '---'}</td>
            <td><span class="status-badge open" style="font-size:10px;">${p.role.toUpperCase()}</span></td>
            <td style="text-align:center;">
                <button class="btn-action edit-btn" data-id="${p.id}" data-name="${p.full_name}" data-role="${p.role}" data-email="${p.email}" data-company="${p.empresa_id || ''}">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
            </td>
        </tr>
    `).join('');

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.onclick = () => openUserModal(btn.dataset);
    });
}

function setupUserEvents() {
    const userModal = document.getElementById('user-modal');
    const deleteModal = document.getElementById('delete-confirm-modal');
    
    // 1. Cerrar modales (X, Cancelar)
    const closeModals = () => {
        userModal.style.display = 'none';
        deleteModal.style.display = 'none';
    };
    
    document.getElementById('close-modal').onclick = closeModals;
    document.getElementById('btn-cancel').onclick = closeModals; // Aquí toma el estilo pro
    document.getElementById('cancel-delete-btn').onclick = () => deleteModal.style.display = 'none';

    // 2. Abrir modal para nuevo
    document.getElementById('btn-new-user').onclick = () => openUserModal();

    // 3. LÓGICA DE ELIMINAR (EL CORAZÓN DEL CAMBIO)
    const btnDeleteTrigger = document.getElementById('btn-delete');
    
    btnDeleteTrigger.onclick = () => {
        const userName = document.getElementById('u-name').value;
        document.getElementById('delete-user-name').innerText = userName;
        deleteModal.style.display = 'flex'; // Abrimos el modal pro
    };

    // 4. EL BORRADO REAL EN SUPABASE
    document.getElementById('confirm-delete-btn').onclick = async () => {
        const id = document.getElementById('edit-id').value;
        const btnFinal = document.getElementById('confirm-delete-btn');
        
        if (!id) return;

        try {
            btnFinal.innerText = "Borrando...";
            btnFinal.disabled = true;

            // Borramos de la tabla profiles (Supabase gestionará el Auth si tienes triggers, 
            // o simplemente quitamos el perfil para que no aparezca más)
            const { error } = await supabase.from('profiles').delete().eq('id', id);

            if (error) throw error;

            showToast("🚀 Usuario eliminado con éxito", "success");
            closeModals();
            fetchUsers(); // Recarga la tabla de atrás
        } catch (err) {
            console.error("Error al borrar:", err);
            showToast("Error: " + err.message, "error");
        } finally {
            btnFinal.innerText = "Sí, eliminar";
            btnFinal.disabled = false;
        }
    };

    // 5. El resto de la lógica (Roles, Submit Form, etc.)
    document.getElementById('u-role').onchange = (e) => {
        const group = document.getElementById('u-company-group');
        group.style.display = e.target.value === 'client' ? 'block' : 'none';
        if (e.target.value === 'client') loadCompanies();
    };

    document.getElementById('user-form').onsubmit = async (e) => {
        e.preventDefault();
        // ... (Tu código de Guardar/Editar que ya funciona) ...
        closeModals();
        fetchUsers();
    };
}

async function loadCompanies() {
    const { data } = await supabase.from('companies').select('id, name').order('name');
    document.getElementById('u-company').innerHTML = '<option value="">Seleccione...</option>' + 
        data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function openUserModal(data = null) {
    const modal = document.getElementById('user-modal');
    const form = document.getElementById('user-form');
    form.reset();
    
    if (data) {
        document.getElementById('modal-title').innerText = "Editar Usuario";
        document.getElementById('edit-id').value = data.id;
        document.getElementById('u-name').value = data.name;
        document.getElementById('u-email').value = data.email;
        document.getElementById('u-role').value = data.role;
        document.getElementById('btn-delete').style.display = 'block';
    } else {
        document.getElementById('modal-title').innerText = "Nuevo Usuario";
        document.getElementById('edit-id').value = "";
        document.getElementById('btn-delete').style.display = 'none';
    }
    modal.style.display = 'flex';
}

init();