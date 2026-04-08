import supabase from '../supabase.js';

let userCompanyId = null;
let calendar = null;

async function initPortal() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '../login.html'; return; }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*, companies!empresa_id(name)')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        console.error("Error cargando perfil:", profileError);
        return; 
    }

    const companyEl = document.getElementById('company-name');
    const userEl = document.getElementById('user-display-name');
    const initialsEl = document.getElementById('user-initials');

    if (companyEl) companyEl.innerText = profile.companies?.name || 'SAMAND TECH';
    if (userEl) userEl.innerText = profile.full_name;

    if (initialsEl) {
        const nameParts = profile.full_name.trim().split(' ');
        const initials = nameParts.length > 1 
            ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
            : nameParts[0][0].toUpperCase();
        initialsEl.innerText = initials;
    }

    userCompanyId = profile.empresa_id;

    await loadTickets();
    await updateStats();
    await initCalendar();
    setupEventListeners();
}

// 2. Cargar Tickets (Mantenemos la visualización de MTTO aunque ellos no los creen)
async function loadTickets() {
    if (!userCompanyId) return;

    const { data: tickets, error } = await supabase
        .from('tickets')
        .select('*, profiles!assigned_to(full_name)') 
        .eq('client_id', userCompanyId)
        .neq('status', 'resolved')
        .order('created_at', { ascending: false });

    if (error) return;

    const tbody = document.getElementById('client-tickets-body');
    if (tbody) {
        if (tickets.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: #64748b;">No tienes requerimientos activos.</td></tr>`;
            return;
        }

        tbody.innerHTML = tickets.map(t => {
            const date = new Date(t.created_at).toLocaleDateString();
            const statusLabel = t.status === 'open' ? 'Abierto' : 'En Proceso';
            const techName = t.profiles?.full_name || '<span style="color: #94a3b8;">Por asignar</span>';

            return `
                <tr>
                    <td>#${t.id.slice(0, 5).toUpperCase()}</td>
                    <td>${date}</td>
                    <td>
                        <strong>${t.ticket_type === 'maintenance' ? '🛠️ Mantenimiento' : t.subject}</strong><br>
                        <small style="color: #64748b;">${t.ticket_type === 'maintenance' ? 'Programado por SAMANDTECH' : 'Falla Técnica'}</small>
                    </td>
                    <td><i class="fa-solid fa-user-gear"></i> ${techName}</td>
                    <td><span class="status-badge ${t.status}">${statusLabel}</span></td>
                    <td>
                        <button class="btn-action view-btn" data-id="${t.id}"><i class="fa-solid fa-eye"></i></button>
                    </td>
                </tr>`;
        }).join('');

        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.onclick = () => viewTicketDetails(btn.dataset.id);
        });
    }
}

// 3. Ver Detalles (Sin cambios)
async function viewTicketDetails(ticketId) {
    const modal = document.getElementById('view-ticket-modal');
    const { data: ticket } = await supabase.from('tickets').select('*, profiles!assigned_to(full_name)').eq('id', ticketId).single();
    if (!ticket) return;

    document.getElementById('detail-id').innerText = ticket.id.slice(0, 8).toUpperCase();
    document.getElementById('detail-subject').innerText = ticket.subject || 'Mantenimiento';
    document.getElementById('detail-desc').innerText = ticket.description || 'Sin descripción';
    document.getElementById('detail-date').innerText = new Date(ticket.created_at).toLocaleDateString();
    document.getElementById('detail-tech').innerText = ticket.profiles?.full_name || 'Pendiente';
    document.getElementById('detail-type').innerText = ticket.ticket_type === 'maintenance' ? 'Mantenimiento' : 'Falla Técnica';

    const statusEl = document.getElementById('detail-status');
    statusEl.innerText = ticket.status === 'open' ? 'Abierto' : ticket.status === 'in_progress' ? 'En Proceso' : 'Resuelto';
    statusEl.className = `status-badge ${ticket.status}`;

    modal.classList.add('active');
    const closeDetail = () => modal.classList.remove('active');
    document.getElementById('close-detail-btn').onclick = closeDetail;
    document.getElementById('close-detail-footer').onclick = closeDetail;
}

// 4. Estadísticas (Sin cambios)
async function updateStats() {
    const { data: tickets } = await supabase.from('tickets').select('status').eq('client_id', userCompanyId);
    if (tickets) {
        document.getElementById('count-pending').innerText = tickets.filter(t => t.status === 'open').length;
        document.getElementById('count-process').innerText = tickets.filter(t => t.status === 'in_progress').length;
        document.getElementById('count-done').innerText = tickets.filter(t => t.status === 'resolved').length;
    }
}

// 5. Calendario (Sin cambios, el cliente debe ver cuándo vas tú)
async function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl || !userCompanyId) return;
    const { data: tickets } = await supabase.from('tickets').select('*').eq('client_id', userCompanyId);
    const events = (tickets || []).map(t => {
        const isMtto = t.ticket_type === 'maintenance';
        let color = t.status === 'resolved' ? '#10b981' : (t.status === 'in_progress' ? '#f59e0b' : '#e11d48');
        if (isMtto && t.status === 'open') color = '#0ea5e9';
        return {
            id: t.id,
            title: `${isMtto ? '🛠️' : '⚠️'} ${t.subject || 'MTTO'}`,
            start: isMtto ? t.scheduled_date : t.created_at,
            backgroundColor: color,
            borderColor: color
        };
    });
    if (calendar) calendar.destroy();
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'es',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' },
        events: events,
        eventClick: (info) => viewTicketDetails(info.event.id)
    });
    calendar.render();
}

// 🚀 6. CONFIGURACIÓN DE EVENTOS (Simplificada)
function setupEventListeners() {
    const modalCreate = document.getElementById('ticket-modal'); 
    const btnOpenCreate = document.getElementById('btn-open-ticket-client');
    const btnCancelCreate = document.getElementById('cancel-btn');
    const ticketForm = document.getElementById('client-new-ticket-form');

    if (btnOpenCreate) btnOpenCreate.onclick = () => modalCreate.classList.add('active');
    if (btnCancelCreate) btnCancelCreate.onclick = () => modalCreate.classList.remove('active');

    // --- LÓGICA DE TABS ELIMINADA ---

    if (ticketForm) {
        ticketForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Ya no hay selección, siempre es incidencia
            const subject = document.getElementById('subject-input').value;
            const description = document.getElementById('description-input').value;

            const { error } = await supabase.from('tickets').insert([{
                client_id: userCompanyId,
                ticket_type: 'incidence', // Fijo
                subject: subject,
                description: description,
                scheduled_date: null, // No aplica para fallas
                status: 'open',
                priority: 'medium'
            }]);

            if (!error) {
                modalCreate.classList.remove('active');
                ticketForm.reset();
                await loadTickets();
                await updateStats();
                await initCalendar();
                alert("🚀 ¡Falla reportada! Un técnico revisará su caso pronto.");
            } else {
                alert("Error al enviar la solicitud.");
            }
        });
    }

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../login.html';
    });
}

initPortal();