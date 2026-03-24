import supabase from './supabase.js';

export function initUniversalSettings() {
    // 1. INYECCIÓN DEL HTML (Aseguramos que los modales existan en el DOM)
    const modalsHTML = `
        <div id="user-modal" class="modal-overlay">
            <div class="modal-content admin-settings-modal">
                <div class="modal-header">
                    <div>
                        <h2><i class="fa-solid fa-users-gear"></i> Gestión de Usuarios</h2>
                        <span class="subtitle" style="display:block; margin-top:5px; color:#64748b;">Administra los accesos de SAMAND TECH</span>
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
                            <div class="form-group" style="flex: 1;"><label>Rol</label><select id="user-role" style="width: 100%;"><option value="tech">Técnico</option><option value="admin">Admin</option><option value="client">Cliente</option></select></div>
                            <div class="form-group" style="flex: 1;"><label>Correo</label><input type="email" id="user-email" style="width: 100%;" required></div>
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

    // 2. REFERENCIAS (Buscamos los elementos DESPUÉS de inyectarlos)
    const userModal = document.getElementById('user-modal');
    const createUserModal = document.getElementById('create-user-modal');
    const btnConfig = document.getElementById('btn-config');
    const btnLogout = document.getElementById('logout-btn');
    const btnOpenRegister = document.getElementById('btn-open-register'); // AQUÍ ESTABA EL ERROR

    // 3. LÓGICA DE USUARIOS
    async function fetchAdminUsers() {
        const userListBody = document.getElementById('user-admin-list');
        if (!userListBody) return;

        const { data: profiles, error } = await supabase.from('profiles').select('*').order('full_name');
        if (error) return;

        userListBody.innerHTML = profiles.map(p => `
            <tr style="border-bottom: 1px solid #f8f8f8;">
                <td style="padding: 10px;"><strong>${p.full_name}</strong></td>
                <td style="padding: 10px;"><span class="badge">${p.role}</span></td>
                <td style="padding: 10px;">
                    <button class="btn-icon edit-user-btn" data-id="${p.id}" data-name="${p.full_name}" data-role="${p.role}" data-email="${p.email || ''}">
                        <i class="fa-solid fa-pen-to-square" style="color: #0ea5e9;"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        document.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const d = btn.dataset;
                document.getElementById('edit-user-id').value = d.id;
                document.getElementById('user-full-name').value = d.name;
                document.getElementById('user-role').value = d.role;
                document.getElementById('user-email').value = d.email;
                document.getElementById('register-modal-title').innerText = 'Editar Usuario';
                document.getElementById('btn-save-user-form').innerText = 'Actualizar';
                document.getElementById('btn-delete-user').style.display = 'block';
                createUserModal.style.display = 'flex';
            });
        });
    }

    // EVENTOS
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
            document.getElementById('register-modal-title').innerText = 'Nuevo Usuario';
            document.getElementById('btn-save-user-form').innerText = 'Crear Usuario';
            document.getElementById('btn-delete-user').style.display = 'none';
            createUserModal.style.display = 'flex';
        });
    }

    // Lógica de Logout
    if (btnLogout) {
        btnLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm("¿Cerrar sesión en SAMAND TECH?")) {
                const { error } = await supabase.auth.signOut();
                if (!error) window.location.href = 'login.html';
            }
        });
    }

    // Botones de cierre
    document.querySelectorAll('.close-user-modal, .close-register-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            userModal.style.display = 'none';
            createUserModal.style.display = 'none';
        });
    });
}