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

// 2. CARGAR TICKETS CERRADOS EN LA TABLA
async function fetchResolvedTickets() {
    console.log("Conectando con Supabase...");
    
    const { data: tickets, error } = await supabase
        .from('tickets')
        .select(`
            *,
            companies!fk_tickets_client ( name ),
            profiles!tickets_assigned_to_fkey ( full_name )
        `)
        .eq('status', 'resolved') 
        .order('updated_at', { ascending: false });

    if (error) {
        console.error("Error de Supabase:", error.message);
        reportsListBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Error: ${error.message}</td></tr>`;
        return;
    }

    if (!tickets || tickets.length === 0) {
        reportsListBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay tickets cerrados todavía.</td></tr>';
        return;
    }

    reportsListBody.innerHTML = tickets.map(t => {
        // TRADUCCIONES PARA LA TABLA
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