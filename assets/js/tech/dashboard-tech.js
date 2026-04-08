import supabase from '../supabase.js';

let currentUserId = null;
let calendar = null;

async function initTechDashboard() {
    // 1. Verificar sesión y obtener ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '../login.html'; return; }
    
    currentUserId = user.id;

    // 2. Cargar nombre en la interfaz
    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', currentUserId)
        .single();
    
    document.getElementById('user-display-name').innerText = profile?.full_name || 'Técnico';
    
    const initialsEl = document.getElementById('top-bar-avatar');
    if (initialsEl && profile?.full_name) {
        const parts = profile.full_name.trim().split(' ');
        initialsEl.innerText = parts.length > 1 ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase() : parts[0][0].toUpperCase();
    }

    // 3. Cargar la data operativa
    await loadTechStats();
    await loadTechTickets();
    await initTechCalendar();
    setupTechEventListeners();
}

// --- 📊 ESTADÍSTICAS FILTRADAS POR TÉCNICO ---
async function loadTechStats() {
    const { data: tickets } = await supabase
        .from('tickets')
        .select('status, priority, ticket_type')
        .eq('assigned_to', currentUserId); // 🛡️ Solo lo suyo

    if (tickets) {
        document.getElementById('count-open').innerText = tickets.filter(t => t.status === 'open').length;
        document.getElementById('count-critical').innerText = tickets.filter(t => (t.priority === 'critical' || t.priority === 'high') && t.status !== 'resolved').length;
        document.getElementById('count-maintenance').innerText = tickets.filter(t => t.ticket_type === 'maintenance' && t.status !== 'resolved').length;
    }
}

// --- 📋 TABLAS DE TRABAJO ---
async function loadTechTickets() {
    const { data: tickets, error } = await supabase
        .from('tickets')
        .select('*, companies(name)')
        .eq('assigned_to', currentUserId)
        .neq('status', 'resolved')
        .order('priority', { ascending: false });

    if (error) return;

    const incidenceBody = document.getElementById('incidence-list-body');
    const maintenanceBody = document.getElementById('maintenance-list-body');

    // Limpiar tablas
    incidenceBody.innerHTML = '';
    maintenanceBody.innerHTML = '';

    tickets.forEach(t => {
        const row = `
            <tr>
                <td>#${t.id.slice(0, 5).toUpperCase()}</td>
                <td>${t.companies?.name || 'N/A'}</td>
                <td>${t.ticket_type === 'maintenance' ? '🛠️ Mantenimiento' : t.subject}</td>
                <td><span class="status-badge ${t.status}">${t.status}</span></td>
                <td>
                    <button class="btn-action attend-btn" data-id="${t.id}" title="Gestionar">
                        <i class="fa-solid fa-briefcase"></i>
                    </button>
                </td>
            </tr>
        `;

        if (t.ticket_type === 'maintenance') {
            maintenanceBody.innerHTML += row;
        } else {
            incidenceBody.innerHTML += row;
        }
    });

    // Evento para abrir el modal de gestión
    document.querySelectorAll('.attend-btn').forEach(btn => {
        btn.onclick = () => openAttendModal(btn.dataset.id);
    });
}

// --- 📅 CALENDARIO PERSONAL ---
async function initTechCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    const { data: tickets } = await supabase
        .from('tickets')
        .select('*')
        .eq('assigned_to', currentUserId);

    const events = (tickets || []).map(t => {
        let color = t.status === 'resolved' ? '#10b981' : (t.status === 'in_progress' ? '#f59e0b' : '#e11d48');
        return {
            id: t.id,
            title: `${t.ticket_type === 'maintenance' ? '🛠️' : '⚠️'} ${t.subject || 'Ticket'}`,
            start: t.scheduled_date || t.created_at,
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
        eventClick: (info) => openAttendModal(info.event.id)
    });
    calendar.render();
}

// --- 🛠️ GESTIÓN DE TICKETS (MODAL) ---
async function openAttendModal(ticketId) {
    const modal = document.getElementById('attend-modal');
    // Aquí cargarías la info del ticket en los inputs del modal de gestión
    // (Similar a como lo haces en el admin para cerrar tickets)
    modal.classList.add('active');
    modal.dataset.currentTicketId = ticketId;
}

function setupTechEventListeners() {
    // Cerrar modales
    document.querySelectorAll('.close-attend, .btn-secondary').forEach(btn => {
        btn.onclick = () => document.getElementById('attend-modal').classList.remove('active');
    });

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../login.html';
    });
}

initTechDashboard();