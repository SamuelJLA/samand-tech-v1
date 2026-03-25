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

    console.log("Toast mostrado:", message); // Para ver en la consola si se dispara

    // Lo dejamos 4 segundos (4000ms) antes de empezar a desvanecerse
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        // Esperamos medio segundo más para borrarlo del mapa
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

export function initUniversalSettings() {
    // 1. INYECCIÓN DEL HTML (Actualizado con el campo de Empresa)
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
                                <option value="">Cargando empresas...</option>
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

    // REFERENCIAS
    const userModal = document.getElementById('user-modal');
    const createUserModal = document.getElementById('create-user-modal');
    const btnConfig = document.getElementById('btn-config');
    const btnLogout = document.getElementById('logout-btn');
    const btnOpenRegister = document.getElementById('btn-open-register');
    const roleSelect = document.getElementById('user-role');
    const companyGroup = document.getElementById('company-field-group');
    const companySelect = document.getElementById('user-company-id');

    // --- LÓGICA DE EMPRESAS PARA EL ROL CLIENTE (Actualizada a 'companies') ---
async function loadCompanies() {
    
    const { data, error } = await supabase.from('companies').select('id, name').order('name'); 
    
    if (!error) {
        const companySelect = document.getElementById('user-company-id');
        companySelect.innerHTML = '<option value="">Seleccione una empresa...</option>' + 
            data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } else {
        console.error("Error cargando empresas:", error);
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

    // --- LÓGICA DE USUARIOS ---
    async function fetchAdminUsers() {
        const userListBody = document.getElementById('user-admin-list');
        if (!userListBody) return;

        // Seleccionamos también empresa_id para cuando editemos
        const { data: profiles, error } = await supabase.from('profiles').select('*').order('full_name');
        if (error) return;

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
                
                // Si es cliente, cargar y marcar su empresa
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
            companyGroup.style.display = 'none'; // Resetear vista de empresa
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

    // --- LÓGICA PARA GUARDAR O ACTUALIZAR USUARIO ---
    const userForm = document.getElementById('new-user-form');

    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Recolectamos los datos del formulario
        const id = document.getElementById('edit-user-id').value;
        const fullName = document.getElementById('user-full-name').value;
        const role = document.getElementById('user-role').value;
        const email = document.getElementById('user-email').value;
        
        // 2. Si el rol es cliente, guardamos el empresa_id; si no, lo dejamos nulo
        const companyId = (role === 'client') ? document.getElementById('user-company-id').value : null;

        // Validación elegante para clientes
        if (role === 'client' && !companyId) {
            showToast("Por favor, selecciona una empresa para el cliente", "error");
            return;
        }

        let result;

        if (id) {
            // --- CASO: ACTUALIZAR USUARIO EXISTENTE ---
            const updateData = {
                full_name: fullName,
                role: role,
                email: email,
                empresa_id: companyId 
            };
            
            result = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', id);

        } else {
            // --- CASO: NUEVO USUARIO ---
            showToast("La creación de nuevos correos requiere configuración de Admin Auth.", "error");
            return;
        }

        if (result.error) {
            console.error("Error al guardar:", result.error);
            showToast("Error al guardar los cambios", "error");
        } else {
            showToast("¡Usuario actualizado correctamente!", "success");
            
            // Cerramos el modal y refrescamos la lista
            const createUserModal = document.getElementById('create-user-modal');
            if (createUserModal) createUserModal.style.display = 'none';
            fetchAdminUsers(); 
        }
    });

    const btnDeleteUser = document.getElementById('btn-delete-user');
    btnDeleteUser.addEventListener('click', async () => {
        const id = document.getElementById('edit-user-id').value;
        if (id && confirm("¿Estás seguro de eliminar este acceso? Esta acción no se puede deshacer.")) {
            const { error } = await supabase.from('profiles').delete().eq('id', id);
            if (!error) {
                alert("Usuario eliminado.");
                createUserModal.style.display = 'none';
                fetchAdminUsers();
            }
        }
    });

    // Botones de cierre
    document.querySelectorAll('.close-user-modal, .close-register-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            userModal.style.display = 'none';
            createUserModal.style.display = 'none';
        });
    });
}

