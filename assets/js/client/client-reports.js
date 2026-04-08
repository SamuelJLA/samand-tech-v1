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
    const { data: tickets, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('client_id', userCompanyId)
        .order('created_at', { ascending: false });

    if (error) return;

    renderStats(tickets);
    // 🚀 Quitamos la llamada a renderCharts porque ya no existen en el HTML
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

// ❌ LA FUNCIÓN RENDERCHARTS FUE ELIMINADA DE AQUÍ PARA EVITAR EL SYNTAX ERROR

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

    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.onclick = () => viewTicketDetails(btn.dataset.id);
    });
}

async function viewTicketDetails(ticketId) {
    const modal = document.getElementById('view-ticket-modal');
    
    const { data: ticket, error } = await supabase
        .from('tickets')
        .select('*, profiles!assigned_to(full_name)')
        .eq('id', ticketId)
        .single();

    if (error || !ticket) return;

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

    const close = () => modal.classList.remove('active');
    document.getElementById('close-detail-btn').onclick = close;
    document.getElementById('close-detail-footer').onclick = close;
}

initReports();