import supabase from './supabase.js';

// Función para mostrar mensajes elegantes
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
    
    const icon = type === 'success' 
        ? '<i class="fa-solid fa-circle-check"></i>' 
        : '<i class="fa-solid fa-circle-exclamation"></i>';

    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

export function initUniversalSettings() {
    // 1. INYECCIÓN DEL HTML
    const modalsHTML = `
        <div id="user-modal" class="modal-overlay">
            <div class="modal-content admin-settings-modal">
                <div class="modal-header">
                    <div>
                        <h2><i class="fa-solid fa-users-gear"></i> Gestión de Usuarios</h2>
                        <span class="subtitle" style="display:block; margin-top:5px; color:#64748b;">Administra los accesos de SAMANDTECH</span>
                    </div>
                    <div class="header-actions" style="display:flex; gap:10px; align-items:center;">
                        <button id="btn-open-register" class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;">
                            <i class="fa-solid fa-plus"></i> Nuevo Usuario
                        </button>
                        <button class="btn-close close-user-modal">&times;</button>
                    </div>
                </div>
                <div class="modal-body">
                    <table class="user-table" style="width:100%; margin-top:15px; border-collapse: collapse;">
                        <thead>
                            <tr style="text-align: left; color: #64748b; border-bottom: 1px solid #eee;">
                                <th style="padding: 10px;">Nombre</th>
                                <th style="padding: 10px;">Rol</th>
                                <th style="padding: 10px;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="user-admin-list"></tbody>
                    </table>
                </div>
            </div>
        </div>

        <div id="create-user-modal" class="modal-overlay" style="z-index: 1100;">
            <div class="modal-content modal-small">
                <div class="modal-header">
                    <h2 id="register-modal-title">Nuevo Acceso</h2>
                    <button class="btn-close close-register-modal">&times;</button>
                </div>
                <form id="new-user-form">
                    <input type="hidden" id="edit-user-id">
                    <div class="modal-body">
                        <div class="form-group"><label>Nombre y Apellido</label><input type="text" id="user-full-name" required></div>
                        <div class="form-row" style="display: flex; gap: 10px; margin-top: 10px;">
                            <div class="form-group" style="flex: 1;"><label>Rol</label>
                                <select id="user-role" style="width: 100%;">
                                    <option value="tech">Técnico</option>
                                    <option value="admin">Admin</option>
                                    <option value="client">Cliente</option>
                                </select>
                            </div>
                            <div class="form-group" style="flex: 1;"><label>Correo</label><input type="email" id="user-email" style="width: 100%;" required></div>
                        </div>

                        <div id="company-field-group" class="form-group" style="margin-top: 10px; display: none;">
                            <label>Empresa Asociada</label>
                            <select id="user-company-id" style="width: 100%; padding: 8px; border-radius: 5px; border: 1px solid #ddd;">
                                <option value="">Seleccione una empresa...</option>
                            </select>
                        </div>

                        <div class="form-group" style="margin-top: 10px;"><label id="pass-label">Contraseña</label><input type="password" id="user-password" placeholder="Mínimo 6 caracteres"></div>
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: space-between; margin-top: 20px;">
                        <button type="button" id="btn-delete-user" class="btn-danger-outline" style="display:none; color: red; border: 1px solid red; padding: 5px 10px; border-radius: 5px;">Eliminar</button>
                        <div>
                            <button type="button" class="btn-secondary close-register-modal">Cancelar</button>
                            <button type="submit" id="btn-save-user-form" class="btn-primary">Guardar</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalsHTML);

    const userModal = document.getElementById('user-modal');
    const createUserModal = document.getElementById('create-user-modal');
    const btnConfig = document.getElementById('btn-config');
    const btnLogout = document.getElementById('logout-btn');
    const btnOpenRegister = document.getElementById('btn-open-register');
    const roleSelect = document.getElementById('user-role');
    const companyGroup = document.getElementById('company-field-group');
    const companySelect = document.getElementById('user-company-id');

    async function loadCompanies() {
        const { data, error } = await supabase.from('companies').select('id, name').order('name'); 
        if (!error && companySelect) {
            companySelect.innerHTML = '<option value="">Seleccione una empresa...</option>' + 
                data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
    }

    roleSelect.addEventListener('change', (e) => {
        if (e.target.value === 'client') {
            companyGroup.style.display = 'block';
            loadCompanies();
        } else {
            companyGroup.style.display = 'none';
        }
    });

    async function fetchAdminUsers() {
        const userListBody = document.getElementById('user-admin-list');
        const { data: profiles, error } = await supabase.from('profiles').select('*').order('full_name');
        if (error || !userListBody) return;

        userListBody.innerHTML = profiles.map(p => `
            <tr style="border-bottom: 1px solid #f8f8f8;">
                <td style="padding: 10px;"><strong>${p.full_name}</strong></td>
                <td style="padding: 10px;"><span class="badge">${p.role}</span></td>
                <td style="padding: 10px;">
                    <button class="btn-icon edit-user-btn" 
                        data-id="${p.id}" 
                        data-name="${p.full_name}" 
                        data-role="${p.role}" 
                        data-email="${p.email || ''}"
                        data-company="${p.empresa_id || ''}">
                        <i class="fa-solid fa-pen-to-square" style="color: #0ea5e9;"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        document.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const d = btn.dataset;
                document.getElementById('edit-user-id').value = d.id;
                document.getElementById('user-full-name').value = d.name;
                document.getElementById('user-role').value = d.role;
                document.getElementById('user-email').value = d.email;
                document.getElementById('user-password').placeholder = "Dejar en blanco para no cambiar";
                
                if (d.role === 'client') {
                    companyGroup.style.display = 'block';
                    await loadCompanies();
                    companySelect.value = d.company;
                } else {
                    companyGroup.style.display = 'none';
                }

                document.getElementById('register-modal-title').innerText = 'Editar Usuario';
                document.getElementById('btn-save-user-form').innerText = 'Actualizar';
                document.getElementById('btn-delete-user').style.display = 'block';
                createUserModal.style.display = 'flex';
            });
        });
    }

    if (btnConfig) {
        btnConfig.addEventListener('click', (e) => {
            e.preventDefault();
            userModal.style.display = 'flex';
            fetchAdminUsers();
        });
    }

    if (btnOpenRegister) {
        btnOpenRegister.addEventListener('click', () => {
            document.getElementById('new-user-form').reset();
            document.getElementById('edit-user-id').value = "";
            document.getElementById('user-password').placeholder = "Mínimo 6 caracteres";
            companyGroup.style.display = 'none';
            document.getElementById('register-modal-title').innerText = 'Nuevo Usuario';
            document.getElementById('btn-save-user-form').innerText = 'Crear Usuario';
            document.getElementById('btn-delete-user').style.display = 'none';
            createUserModal.style.display = 'flex';
        });
    }

    const userForm = document.getElementById('new-user-form');
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // VERIFICACIÓN: Vamos a ver qué ID estamos mandando
            const idInput = document.getElementById('edit-user-id').value;
            console.log("Enviando ID al server:", idInput); // Mira esto en la consola del navegador (F12)
            const btnSave = document.getElementById('btn-save-user-form');
            const originalText = btnSave.innerText;

            const id = document.getElementById('edit-user-id').value;
            const fullName = document.getElementById('user-full-name').value;
            const role = document.getElementById('user-role').value;
            const email = document.getElementById('user-email').value;
            const password = document.getElementById('user-password').value;

            // Validamos empresa_id: si es vacío, mandamos null
            let companyId = null;
            if (role === 'client') {
                const select = document.getElementById('user-company-id');
                companyId = select.value && select.value !== "" ? select.value : null;
            }

            try {
                const { data, error } = await supabase.functions.invoke('create-user', {
                    body: { 
                        id: id || null, // Si no hay ID, mandamos null literal
                        email: email, 
                        password: password || null, 
                        full_name: fullName, 
                        role: role, 
                        empresa_id: companyId 
                    }
                });

                if (error) throw error;

                showToast(id ? "¡Usuario actualizado!" : "🚀 ¡Acceso creado!", "success");
                createUserModal.style.display = 'none';
                fetchAdminUsers();
            } catch (err) {
                console.error("Error:", err);
                showToast("Fallo: " + err.message, "error");
            } finally {
                btnSave.innerText = originalText;
                btnSave.disabled = false;
            }
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm("¿Cerrar sesión?")) {
                const { error } = await supabase.auth.signOut();
                if (!error) window.location.href = 'login.html';
            }
        });
    }

    const btnDeleteUser = document.getElementById('btn-delete-user');
    if (btnDeleteUser) {
        btnDeleteUser.addEventListener('click', async () => {
            const id = document.getElementById('edit-user-id').value;
            if (id && confirm("¿Eliminar este acceso permanentemente?")) {
                const { error } = await supabase.from('profiles').delete().eq('id', id);
                if (!error) {
                    showToast("Usuario eliminado", "success");
                    createUserModal.style.display = 'none';
                    fetchAdminUsers();
                }
            }
        });
    }

    document.querySelectorAll('.close-user-modal, .close-register-modal, .btn-secondary').forEach(btn => {
        btn.addEventListener('click', () => {
            userModal.style.display = 'none';
            createUserModal.style.display = 'none';
        });
    });
}