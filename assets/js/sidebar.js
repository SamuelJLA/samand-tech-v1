import supabase from './supabase.js';

export async function injectSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    // 1. Obtener Usuario y Rol
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    const role = profile?.role || 'tech'; // Por defecto tech

    // 2. Detectar si estamos en una subcarpeta (/portal-tech/ o /portal-cliente/)
    const isSubFolder = window.location.pathname.includes('/portal-tech/') || 
                        window.location.pathname.includes('/portal-cliente/');
    
    // Si estamos en subcarpeta, para ir a la raíz usamos '../', si estamos en raíz usamos './'
    const rootPath = isSubFolder ? '../' : './';
    const techPath = isSubFolder ? './' : './portal-tech/';

    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    // 3. Definir links Dinámicos con prefijos de ruta correctos
    let menuItems = [];

    if (role === 'admin') {
        menuItems = [
            { name: 'Tickets', icon: 'fa-ticket', url: `${rootPath}index.html` },
            { name: 'Clientes', icon: 'fa-users', url: `${rootPath}clientes.html` },
            { name: 'Pedidos', icon: 'fa-cart-shopping', url: `${rootPath}pedidos.html` },
            { name: 'Reportes', icon: 'fa-chart-line', url: `${rootPath}reportes.html` },
            { name: 'Configuración', icon: 'fa-gear', url: `${rootPath}configuracion-admin.html` }
        ];
    } else if (role === 'tech') {
        // 🚀 VISTA PARA EL TÉCNICO
        menuItems = [
            { name: 'Mis Tickets', icon: 'fa-ticket', url: `${techPath}dashboard.html` },
            { name: 'Mis Reportes', icon: 'fa-chart-line', url: `${techPath}reportes-tech.html` },
            { name: 'Configuración', icon: 'fa-gear', url: `${techPath}configuracion-tech.html` }
        ];
    }

    const navHTML = menuItems.map(item => {
        const itemFileName = item.url.split("/").pop();
        const isActive = currentPage === itemFileName ? 'active' : '';
        return `<a href="${item.url}" class="${isActive}"><i class="fa-solid ${item.icon}"></i> ${item.name}</a>`;
    }).join('');

    // 4. Inyectar HTML
    const roleBadge = role === 'admin' ? 'ADMIN' : 'TECH';
    const badgeColor = role === 'admin' ? '#fbbf24' : '#10b981';

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

    // 5. Lógica de Eventos y Cierre de Sesión Seguro
    const logoutModal = document.getElementById('logout-modal');
    document.getElementById('logout-btn').onclick = () => logoutModal.style.display = 'flex';
    document.getElementById('btn-cancel-logout').onclick = () => logoutModal.style.display = 'none';
    
    document.getElementById('btn-confirm-logout').onclick = async () => {
        await supabase.auth.signOut();
        localStorage.clear();
        
        // 🚨 REDIRECCIÓN DINÁMICA: Si estamos en subcarpeta sube con ../, si no va a ./login.html
        const targetLogin = isSubFolder ? '../login.html' : './login.html';
        window.location.href = targetLogin;
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
            const name = profile.full_name || "Usuario Samand"; 
            
            const initials = name
                .split(' ')
                .filter(part => part.length > 0)
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .substring(0, 2);

            avatarDiv.innerText = initials || "??";
            avatarDiv.style.background = "#6366f1";
            avatarDiv.style.color = "white";
            avatarDiv.style.display = "flex";
            avatarDiv.style.alignItems = "center";
            avatarDiv.style.justifyContent = "center";
        }
    }
}
