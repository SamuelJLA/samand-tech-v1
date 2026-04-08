import supabase from '../supabase.js';
import { labels } from '../utils.js'; // Asegúrate de que la ruta sea correcta según tu carpeta

const reportsListBody = document.getElementById('reports-list-body');
let currentUserId = null;

// 1. VERIFICACIÓN DE USUARIO Y SETEO DE ID
async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        window.location.href = '../login.html';
        return;
    }

    currentUserId = user.id;

    // Cargar nombre en la top-bar (con el parche anti-error que hicimos)
    const userDisplay = document.getElementById('user-display-name');
    const initialsEl = document.getElementById('top-bar-avatar');

    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', currentUserId)
        .single();

    if (profile && userDisplay) {
        userDisplay.innerText = profile.full_name || "Técnico";
        
        if (initialsEl) {
            const name = profile.full_name || "Técnico";
            initialsEl.innerText = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        }
    }

    fetchMyReports();
}

// 2. CARGAR MIS TICKETS (SOLO LOS DE ALAN)
async function fetchMyReports() {
    console.log("Cargando historial personal de servicios...");
    
    const { data: tickets, error } = await supabase
        .from('tickets')
        .select(`
            *,
            companies!fk_tickets_client ( name )
        `)
        .eq('assigned_to', currentUserId) // 🛡️ FILTRO DE SEGURIDAD: Solo lo mío
        .order('updated_at', { ascending: false });

    if (error) {
        console.error("Error:", error.message);
        reportsListBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Error al cargar.</td></tr>`;
        return;
    }

    if (!tickets || tickets.length === 0) {
        reportsListBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Aún no tienes servicios registrados.</td></tr>';
        return;
    }

    // 1. FILTRAMOS SOLO RESUELTOS PARA LA TABLA
    const resolvedTickets = tickets.filter(t => t.status === 'resolved');

    reportsListBody.innerHTML = resolvedTickets.map(t => {
        const tipoTraducido = labels.type[t.ticket_type] || 'Falla';
        
        return `
            <tr>
                <td>${new Date(t.updated_at).toLocaleDateString()}</td>
                <td><strong>${t.companies?.name || 'N/A'}</strong></td>
                <td><span class="status-pill ${t.ticket_type || 'incidence'}">${tipoTraducido}</span></td>
                <td>${t.subject}</td>
                <td>
                    <button class="btn-icon view-btn" data-id="${t.id}" style="background: #f1f5f9; border: none; padding: 8px; border-radius: 6px; cursor: pointer;">
                        <i class="fa-solid fa-eye" style="color: #6366f1;"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // 🚀 2. GRÁFICAS DE RENDIMIENTO PERSONAL
    renderCharts(tickets); 
}

// 3. EVENTO PARA VER DETALLES (EL OJO)
reportsListBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.view-btn');
    if (btn) {
        const id = btn.getAttribute('data-id');
        
        const { data: t } = await supabase
            .from('tickets')
            .select(`*, companies!fk_tickets_client ( name )`)
            .eq('id', id)
            .single();

        if (t) {
            const tipoLabel = labels.type[t.ticket_type] || 'Servicio Técnico';

            document.getElementById('view-ticket-id').innerText = `Detalle de mi Servicio #${t.id.slice(0, 5).toUpperCase()}`;
            
            const modalBody = document.getElementById('view-modal-body');
            modalBody.innerHTML = `
                <div class="view-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 8px;">
                    <div class="view-item"><strong><i class="fa-solid fa-building"></i> Cliente:</strong> <br> <span>${t.companies?.name || 'N/A'}</span></div>
                    <div class="view-item"><strong><i class="fa-solid fa-user-check"></i> Recibido por:</strong> <br> <span>${t.received_by || 'No especificado'}</span></div>
                    <div class="view-item"><strong><i class="fa-solid fa-tag"></i> Tipo:</strong> <br> <span class="badge priority-low">${tipoLabel}</span></div>
                    <div class="view-item"><strong><i class="fa-solid fa-calendar-check"></i> Finalizado:</strong> <br> <span>${new Date(t.updated_at).toLocaleDateString()}</span></div>
                </div>
                
                <div class="view-description" style="margin-top: 20px;">
                    <label style="color: #475569; font-weight: 600;">📝 Mi Descripción Técnica:</label>
                    <p style="background: #fff; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; margin-top: 5px; font-size: 0.9rem;">${t.tech_notes || t.description || 'Sin notas técnicas.'}</p>
                </div>

                <div class="view-description" style="margin-top: 15px;">
                    <label style="color: #475569; font-weight: 600;">💡 Recomendaciones dadas:</label>
                    <p style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 6px; margin-top: 5px; font-size: 0.9rem; color: #166534;">${t.recommendations || 'Sin recomendaciones.'}</p>
                </div>
            `;
            document.getElementById('view-modal').style.display = 'flex';
        }
    }
});

// 4. CERRAR MODAL
document.querySelector('.close-view')?.addEventListener('click', () => {
    document.getElementById('view-modal').style.display = 'none';
});

// 5. GRÁFICAS DE RENDIMIENTO (SOLO ALAN)
function renderCharts(tickets) {
    const ctxStatus = document.getElementById('chartStatus');
    const ctxType = document.getElementById('chartType');

    if (!ctxStatus || !ctxType) return;

    if (window.myChartStatus) window.myChartStatus.destroy();
    if (window.myChartType) window.myChartType.destroy();

    // Mis Estados
    window.myChartStatus = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: ['Pendientes', 'En Proceso', 'Resueltos'],
            datasets: [{
                data: [
                    tickets.filter(t => t.status === 'open').length,
                    tickets.filter(t => t.status === 'in_progress').length,
                    tickets.filter(t => t.status === 'resolved').length
                ],
                backgroundColor: ['#f43f5e', '#f59e0b', '#10b981'],
                borderWidth: 0
            }]
        },
        options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } }
    });

    // Mis Tipos de Trabajo
    const typeData = {
        Fallas: tickets.filter(t => t.ticket_type === 'incidence').length,
        MTTO: tickets.filter(t => t.ticket_type === 'maintenance').length
    };

    window.myChartType = new Chart(ctxType, {
        type: 'pie',
        data: {
            labels: Object.keys(typeData),
            datasets: [{
                data: Object.values(typeData),
                backgroundColor: ['#6366f1', '#0ea5e9'],
                borderWidth: 0
            }]
        },
        options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } }
    });
}

// Arrancar
checkUser();