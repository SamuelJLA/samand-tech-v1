import supabase from './supabase.js';

export function injectSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    // 1. Detectar página actual
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    // 2. Definir links
    const menuItems = [
        { name: 'Tickets', icon: 'fa-ticket', url: 'index.html' },
        { name: 'Clientes', icon: 'fa-users', url: 'clientes.html' },
        { name: 'Pedidos', icon: 'fa-cart-shopping', url: 'pedidos.html' },
        { name: 'Reportes', icon: 'fa-chart-line', url: 'reportes.html' },
        { name: 'Configuración', icon: 'fa-gear', url: 'configuracion-admin.html' }
    ];

    const navHTML = menuItems.map(item => {
        const isActive = currentPage === item.url ? 'active' : '';
        return `<a href="${item.url}" class="${isActive}"><i class="fa-solid ${item.icon}"></i> ${item.name}</a>`;
    }).join('');

    // 3. Inyectar HTML + Modal de Logout
    sidebar.innerHTML = `
        <div class="sidebar-logo">
            <h3>SAMANDTECH <span style="font-size: 10px; color: #fbbf24; vertical-align: middle;">ADMIN</span></h3>
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
                <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 20px;">Estás a punto de cerrar tu sesión administrativa.</p>
                <div style="display: flex; gap: 10px;">
                    <button id="btn-cancel-logout" class="btn-secondary" style="flex: 1; padding: 10px; border-radius: 8px;">No</button>
                    <button id="btn-confirm-logout" style="flex: 1; padding: 10px; background: #ef4444; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">Sí, salir</button>
                </div>
            </div>
        </div>
    `;

    // 4. Lógica de Eventos del Modal
    const logoutModal = document.getElementById('logout-modal');
    
    document.getElementById('logout-btn').onclick = () => logoutModal.style.display = 'flex';
    document.getElementById('btn-cancel-logout').onclick = () => logoutModal.style.display = 'none';
    
    document.getElementById('btn-confirm-logout').onclick = async () => {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    };

    // Estilos de animación
    if (!document.getElementById('logout-modal-styles')) {
        const styles = document.createElement('style');
        styles.id = 'logout-modal-styles';
        styles.textContent = `
            #logout-modal .modal-content { animation: popIn 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55); }
            @keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        `;
        document.head.appendChild(styles);
    }

    // --- 🚀 ESTA ES LA MAGIA: ACTUALIZAR LA TOP BAR AUTOMÁTICAMENTE ---
    updateTopBar();
}

async function updateTopBar() {
    const avatarDiv = document.getElementById('top-bar-avatar'); // Usamos el ID específico

    if (!avatarDiv) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single();

    if (profile) {
        if (profile.avatar_url) {
            avatarDiv.innerHTML = `<img src="${profile.avatar_url}" style="width:100%; height:100%; object-fit:cover;">`;
            avatarDiv.style.background = "transparent";
        } else {
            const initials = profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            avatarDiv.innerText = initials;
            avatarDiv.style.fontSize = "0.8rem"; // Letra pequeña para el mini-avatar
            avatarDiv.style.display = "flex";
            avatarDiv.style.alignItems = "center";
            avatarDiv.style.justifyContent = "center";
            avatarDiv.style.background = "#6366f1";
            avatarDiv.style.color = "white";
        }
    }
}