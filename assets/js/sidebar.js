import supabase from './supabase.js';

export async function injectSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    // 1. Obtener Usuario y Rol (La clave del filtro)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    const role = profile?.role || 'tech'; // Por defecto tech si algo falla

    // 2. Detectar página actual
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    // 3. Definir links Dinámicos según el Rol
    let menuItems = [];

    if (role === 'admin') {
        menuItems = [
            { name: 'Tickets', icon: 'fa-ticket', url: 'index.html' },
            { name: 'Clientes', icon: 'fa-users', url: 'clientes.html' },
            { name: 'Pedidos', icon: 'fa-cart-shopping', url: 'pedidos.html' },
            { name: 'Reportes', icon: 'fa-chart-line', url: 'reportes.html' },
            { name: 'Configuración', icon: 'fa-gear', url: 'configuracion-admin.html' }
        ];
    } else if (role === 'tech') {
        // 🚀 VISTA MINIMESA PARA EL TÉCNICO
        menuItems = [
            { name: 'Mis Tickets', icon: 'fa-ticket', url: 'dashboard.html' },
            { name: 'Mis Reportes', icon: 'fa-chart-line', url: 'reportes-tech.html' },
            { name: 'Configuración', icon: 'fa-gear', url: 'configuracion-tech.html' }
        ];
    }

    const navHTML = menuItems.map(item => {
        const isActive = currentPage === item.url ? 'active' : '';
        return `<a href="${item.url}" class="${isActive}"><i class="fa-solid ${item.icon}"></i> ${item.name}</a>`;
    }).join('');

    // 4. Inyectar HTML con Etiqueta Dinámica (ADMIN vs TECH)
    const roleBadge = role === 'admin' ? 'ADMIN' : 'TECH';
    const badgeColor = role === 'admin' ? '#fbbf24' : '#10b981'; // Dorado para admin, Verde para tech

    sidebar.innerHTML = `
        <div class="sidebar-logo">
            <h3>SAMANDTECH <span style="font-size: 10px; color: ${badgeColor}; vertical-align: middle;">${roleBadge}</span></h3>
        </div>
        <nav class="sidebar-nav">
            ${navHTML}
        </nav>
        <div class="sidebar-footer">
            <button id="logout-btn"><i class="fa-solid fa-power-off"></i> Cerrar Sesión</button>
        </div>
        
        <div id="logout-modal" class="modal-overlay" style="display:none; z-index: 9999; background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(5px);">
            <div class="modal-content" style="max-width: 350px; text-align: center; padding: 25px; background: white; border-radius: 12px; font-family: 'Inter', sans-serif;">
                <div style="color: #ef4444; font-size: 3rem; margin-bottom: 15px;"><i class="fa-solid fa-circle-exclamation"></i></div>
                <h3 style="margin-bottom: 10px; font-weight: 600;">¿Ya te vas, bro?</h3>
                <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 20px;">Estás a punto de cerrar tu sesión de trabajo.</p>
                <div style="display: flex; gap: 10px;">
                    <button id="btn-cancel-logout" class="btn-secondary" style="flex: 1; padding: 10px; border-radius: 8px;">No</button>
                    <button id="btn-confirm-logout" style="flex: 1; padding: 10px; background: #ef4444; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">Sí, salir</button>
                </div>
            </div>
        </div>
    `;

    // 5. Lógica de Eventos
    const logoutModal = document.getElementById('logout-modal');
    document.getElementById('logout-btn').onclick = () => logoutModal.style.display = 'flex';
    document.getElementById('btn-cancel-logout').onclick = () => logoutModal.style.display = 'none';
    document.getElementById('btn-confirm-logout').onclick = async () => {
        await supabase.auth.signOut();
        window.location.href = '../login.html'; // Ajustado para salir de carpetas
    };

    updateTopBar();
}

async function updateTopBar() {
    const avatarDiv = document.getElementById('top-bar-avatar');
    if (!avatarDiv) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single();

    if (profile) {
        if (profile.avatar_url) {
            avatarDiv.innerHTML = `<img src="${profile.avatar_url}" style="width:100%; height:100%; object-fit:cover;">`;
            avatarDiv.style.background = "transparent";
        } else {
            // 🛡️ VALIDACIÓN AQUÍ: Si no hay nombre, usamos "User" por defecto
            const name = profile.full_name || "Usuario Samand"; 
            
            const initials = name
                .split(' ')
                .filter(part => part.length > 0) // Evita errores con espacios dobles
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .substring(0, 2);

            avatarDiv.innerText = initials || "??"; // Fallback final
            avatarDiv.style.background = "#6366f1";
            avatarDiv.style.color = "white";
            avatarDiv.style.display = "flex";
            avatarDiv.style.alignItems = "center";
            avatarDiv.style.justifyContent = "center";
        }
    }
}