import supabase from './supabase.js';
import { labels } from './utils.js';

const reportsListBody = document.getElementById('reports-list-body');

// 1. VERIFICACIÓN DE USUARIO
async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'login.html';
    } else {
        fetchResolvedTickets();
        // Opcional: Cargar nombre de usuario en la top-bar
        const userDisplay = document.getElementById('user-display-name');
        if (userDisplay && user.user_metadata.full_name) {
            userDisplay.innerText = user.user_metadata.full_name;
        }
    }
}

// 2. CARGAR TICKETS Y GENERAR ESTADÍSTICAS
async function fetchResolvedTickets() {
    console.log("Conectando con Supabase...");
    
    const { data: tickets, error } = await supabase
        .from('tickets')
        .select(`
            *,
            companies!fk_tickets_client ( name ),
            profiles!tickets_assigned_to_fkey ( full_name )
        `)
        // Quitamos el filtro de 'resolved' para que las gráficas muestren la realidad
        // Si quieres que la TABLA solo muestre cerrados, lo filtramos en el .map abajo
        .order('updated_at', { ascending: false });

    if (error) {
        console.error("Error de Supabase:", error.message);
        reportsListBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Error: ${error.message}</td></tr>`;
        return;
    }

    if (!tickets || tickets.length === 0) {
        reportsListBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay tickets registrados todavía.</td></tr>';
        return;
    }

    // 1. FILTRAMOS PARA LA TABLA (Solo mostrar los resueltos en el historial)
    const resolvedTickets = tickets.filter(t => t.status === 'resolved');

    reportsListBody.innerHTML = resolvedTickets.map(t => {
        const tipoTraducido = labels.type[t.ticket_type] || 'Falla';
        const tecnicoNombre = t.profiles?.full_name || 'Sin técnico';

        return `
            <tr>
                <td>${new Date(t.updated_at).toLocaleDateString()}</td>
                <td><strong>${t.companies?.name || 'N/A'}</strong></td>
                <td><span class="status-pill ${t.ticket_type || 'incidence'}">${tipoTraducido}</span></td>
                <td>${t.subject}</td>
                <td>${tecnicoNombre}</td>
                <td>
                    <button class="btn-icon view-btn" data-id="${t.id}"><i class="fa-solid fa-eye"></i></button>
                </td>
            </tr>
        `;
    }).join('');

    // 🚀 2. ACTIVAMOS LAS GRÁFICAS (Usamos 'tickets' para que la torta vea todos los estados)
    renderCharts(tickets); 
}

// 3. EVENTO PARA VISUALIZAR DETALLES (EL OJO)
// Escuchador para el botón de ojo en Reportes (Versión Pro)
reportsListBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.view-btn');
    if (btn) {
        const id = btn.getAttribute('data-id');
        
        const { data: t } = await supabase
            .from('tickets')
            .select(`*, companies!fk_tickets_client ( name ), profiles!tickets_assigned_to_fkey ( full_name )`)
            .eq('id', id)
            .single();

        if (t) {
            const tipoLabel = labels.type[t.ticket_type] || 'Incidencia / Falla';
            const techLabel = t.profiles?.full_name || 'Sin técnico registrado';

            document.getElementById('view-ticket-id').innerText = `Servicio Finalizado #${t.id.slice(0, 5)}`;
            
            const modalBody = document.getElementById('view-modal-body');
            modalBody.innerHTML = `
                <div class="view-grid">
                    <div class="view-item"><strong>Cliente:</strong> <span>${t.companies?.name || 'N/A'}</span></div>
                    <div class="view-item"><strong>Técnico:</strong> <span>${techLabel}</span></div>
                    <div class="view-item"><strong>Recibido por:</strong> <span>${t.received_by || 'No especificado'}</span></div>
                    <div class="view-item"><strong>Tipo:</strong> <span class="badge priority-low">${tipoLabel}</span></div>
                </div>
                
                <div class="view-description" style="margin-top: 20px;">
                    <label><strong><i class="fa-solid fa-file-lines"></i> Descripción Técnica del Trabajo:</strong></label>
                    <p class="final-report-box">${t.description || 'Sin notas técnicas registradas.'}</p>
                </div>

                <div class="view-description" style="margin-top: 15px;">
                    <label><strong><i class="fa-solid fa-lightbulb"></i> Recomendaciones / Observaciones:</strong></label>
                    <p class="recommendation-box">${t.recommendations || 'Sin recomendaciones adicionales.'}</p>
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

// Iniciar proceso
checkUser();

// --- DENTRO DE reportes.js (Admin) ---

function renderCharts(tickets) {
    const ctxStatus = document.getElementById('chartStatus');
    const ctxType = document.getElementById('chartType');

    // 🛡️ Siempre verifica que existan antes de pintar
    if (!ctxStatus || !ctxType) return;

    // Destruir gráficas previas si existen (para evitar errores al recargar)
    if (window.myChartStatus) window.myChartStatus.destroy();
    if (window.myChartType) window.myChartType.destroy();

    // 1. Gráfica de Estados
    window.myChartStatus = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: ['Abiertos', 'En Proceso', 'Resueltos'], // Ajusta según tus labels
            datasets: [{
                data: [
                    tickets.filter(t => t.status === 'open').length,
                    tickets.filter(t => t.status === 'in_progress').length,
                    tickets.filter(t => t.status === 'resolved').length
                ],
                backgroundColor: ['#e11d48', '#f59e0b', '#10b981'],
                borderWidth: 0
            }]
        },
        options: { plugins: { legend: { position: 'bottom' } } }
    });

    // 2. Gráfica de Tipos (MANTENIMIENTO VS FALLAS)
    const typeData = {
        Fallas: tickets.filter(t => t.ticket_type === 'incidence' || !t.ticket_type).length,
        Mantenimiento: tickets.filter(t => t.ticket_type === 'maintenance').length
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
        options: { plugins: { legend: { position: 'bottom' } } }
    });
}