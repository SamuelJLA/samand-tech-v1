import supabase from '../supabase.js';

let userCompanyId = null;

async function initReports() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '../login.html'; return; }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*, companies!empresa_id(name)')
        .eq('id', user.id)
        .single();

    if (!profile) return;
    
    userCompanyId = profile.empresa_id;
    document.getElementById('user-display-name').innerText = profile.full_name;
    document.getElementById('company-name').innerText = `Reportes: ${profile.companies?.name}`;

    await loadFullHistory();
}

async function loadFullHistory() {
    // Aquí traemos TODOS los tickets sin filtros de estado
    const { data: tickets, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('client_id', userCompanyId)
        .order('created_at', { ascending: false });

    if (error) return;

    renderStats(tickets);
    renderCharts(tickets);
    renderTable(tickets);

    // Buscador en tiempo real
    document.getElementById('report-search').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = tickets.filter(t => 
            (t.subject || '').toLowerCase().includes(term) || 
            t.id.toLowerCase().includes(term)
        );
        renderTable(filtered);
    });
}

function renderStats(tickets) {
    document.getElementById('report-total').innerText = tickets.length;
    document.getElementById('report-resolved').innerText = tickets.filter(t => t.status === 'resolved').length;
    document.getElementById('report-mtto').innerText = tickets.filter(t => t.ticket_type === 'maintenance').length;
}

function renderCharts(tickets) {
    // 1. Gráfica de Estados
    const statusData = {
        Abiertos: tickets.filter(t => t.status === 'open').length,
        Proceso: tickets.filter(t => t.status === 'in_progress').length,
        Resueltos: tickets.filter(t => t.status === 'resolved').length
    };

    new Chart(document.getElementById('chartStatus'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusData),
            datasets: [{
                data: Object.values(statusData),
                backgroundColor: ['#e11d48', '#f59e0b', '#10b981'],
                borderWidth: 0
            }]
        },
        options: { plugins: { legend: { position: 'bottom' } } }
    });

    // 2. Gráfica de Tipos
    const typeData = {
        Fallas: tickets.filter(t => t.ticket_type === 'incidence').length,
        Mantenimiento: tickets.filter(t => t.ticket_type === 'maintenance').length
    };

    new Chart(document.getElementById('chartType'), {
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

// --- 1. Modificamos el render de la tabla ---
function renderTable(tickets) {
    const tbody = document.getElementById('report-history-body');
    tbody.innerHTML = tickets.map(t => {
        const statusLabel = t.status === 'open' ? 'Abierto' : t.status === 'in_progress' ? 'En Proceso' : 'Resuelto';
        
        return `
            <tr>
                <td>#${t.id.slice(0, 5).toUpperCase()}</td>
                <td>${new Date(t.created_at).toLocaleDateString()}</td>
                <td><strong>${t.subject || 'Mantenimiento Preventivo'}</strong></td>
                <td>${t.ticket_type === 'maintenance' ? '🛠️ Mantenimiento' : '⚠️ Falla'}</td>
                <td><span class="status-badge ${t.status}">${statusLabel}</span></td>
                <td>
                    <button class="btn-action view-btn" data-id="${t.id}">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Agregamos los eventos a los nuevos botones
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.onclick = () => viewTicketDetails(btn.dataset.id);
    });
}

// --- 2. Añadimos la función que abre el Modal (Copia fiel del Dashboard) ---
async function viewTicketDetails(ticketId) {
    const modal = document.getElementById('view-ticket-modal');
    
    const { data: ticket, error } = await supabase
        .from('tickets')
        .select('*, profiles!assigned_to(full_name)')
        .eq('id', ticketId)
        .single();

    if (error || !ticket) return;

    // Llenar Modal
    document.getElementById('detail-id').innerText = ticket.id.slice(0, 8).toUpperCase();
    document.getElementById('detail-subject').innerText = ticket.subject || 'Mantenimiento Preventivo';
    document.getElementById('detail-desc').innerText = ticket.description;
    document.getElementById('detail-date').innerText = new Date(ticket.created_at).toLocaleDateString();
    document.getElementById('detail-tech').innerText = ticket.profiles?.full_name || 'Pendiente';
    document.getElementById('detail-type').innerText = ticket.ticket_type === 'maintenance' ? 'Mantenimiento' : 'Falla Técnica';

    const statusEl = document.getElementById('detail-status');
    statusEl.innerText = ticket.status === 'open' ? 'Abierto' : ticket.status === 'in_progress' ? 'En Proceso' : 'Resuelto';
    statusEl.className = `status-badge ${ticket.status}`;

    modal.classList.add('active');

    // Cerrar Modal
    const close = () => modal.classList.remove('active');
    document.getElementById('close-detail-btn').onclick = close;
    document.getElementById('close-detail-footer').onclick = close;
}

initReports();