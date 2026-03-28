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

    // Actualizamos UI de Usuario
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

    // Cargamos todo en orden
    await loadTickets();
    await updateStats();
    await initCalendar();
    setupEventListeners();
}

// 2. Cargar Tickets en la Tabla
async function loadTickets() {
    if (!userCompanyId) return;

    const { data: tickets, error } = await supabase
        .from('tickets')
        .select('*, profiles!assigned_to(full_name)') 
        .eq('client_id', userCompanyId)
        .neq('status', 'resolved') // <--- ESTA ES LA CLAVE: Filtra los ya terminados
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error en loadTickets:", error);
        return;
    }

    const tbody = document.getElementById('client-tickets-body');
    if (tbody) {
        // Si no hay nada pendiente, le avisamos al cliente con un mensaje limpio
        if (tickets.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 30px; color: #64748b;">
                        <i class="fa-solid fa-check-double" style="display:block; font-size: 2rem; margin-bottom: 10px; color: #10b981;"></i>
                        No tienes requerimientos activos. ¡Todo al día!
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = tickets.map(t => {
            const date = new Date(t.created_at).toLocaleDateString();
            const statusLabel = t.status === 'open' ? 'Abierto' : 'En Proceso';
            const techName = t.profiles?.full_name || '<span style="color: #94a3b8; font-style: italic;">Por asignar</span>';

            return `
                <tr>
                    <td>#${t.id.slice(0, 5).toUpperCase()}</td>
                    <td>${date}</td>
                    <td>
                        <strong>${t.ticket_type === 'maintenance' ? '🛠️ Mantenimiento' : t.subject}</strong><br>
                        <small style="color: #64748b;">${t.ticket_type === 'maintenance' ? 'Preventivo' : 'Falla Técnica'}</small>
                    </td>
                    <td><i class="fa-solid fa-user-gear" style="font-size: 0.8rem; color: #94a3b8;"></i> ${techName}</td>
                    <td><span class="status-badge ${t.status}">${statusLabel}</span></td>
                    <td>
                        <button class="btn-action view-btn" data-id="${t.id}" title="Ver Detalles">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Re-vinculamos los eventos del ojo para que funcionen tras la carga
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                viewTicketDetails(btn.dataset.id);
            };
        });
    }
}

// 3. Ver Detalles del Ticket (El Modal del Ojo)
async function viewTicketDetails(ticketId) {
    const modal = document.getElementById('view-ticket-modal');
    if (!modal) {
        console.error("Error: No se encontró el modal 'view-ticket-modal' en el HTML.");
        return;
    }

    const { data: ticket, error } = await supabase
        .from('tickets')
        .select('*, profiles!assigned_to(full_name)')
        .eq('id', ticketId)
        .single();

    if (error || !ticket) {
        console.error("Error al obtener detalles:", error);
        return;
    }

    // Rellenar datos en el modal
    document.getElementById('detail-id').innerText = ticket.id.slice(0, 8).toUpperCase();
    document.getElementById('detail-subject').innerText = ticket.subject || 'Mantenimiento Preventivo';
    document.getElementById('detail-desc').innerText = ticket.description || 'Sin descripción';
    document.getElementById('detail-date').innerText = new Date(ticket.created_at).toLocaleDateString();
    document.getElementById('detail-tech').innerText = ticket.profiles?.full_name || 'Pendiente de asignar';
    document.getElementById('detail-type').innerText = ticket.ticket_type === 'maintenance' ? 'Mantenimiento' : 'Falla Técnica';

    // Badge de estado
    const statusEl = document.getElementById('detail-status');
    if (statusEl) {
        statusEl.innerText = ticket.status === 'open' ? 'Abierto' : ticket.status === 'in_progress' ? 'En Proceso' : 'Resuelto';
        statusEl.className = `status-badge ${ticket.status}`;
    }

    // MOSTRAR MODAL
    modal.classList.add('active');

    // Listener para cerrar
    const closeDetail = () => modal.classList.remove('active');
    document.getElementById('close-detail-btn').onclick = closeDetail;
    document.getElementById('close-detail-footer').onclick = closeDetail;
}

// 4. Estadísticas
async function updateStats() {
    const { data: tickets } = await supabase
        .from('tickets')
        .select('status')
        .eq('client_id', userCompanyId);

    if (tickets) {
        document.getElementById('count-pending').innerText = tickets.filter(t => t.status === 'open').length;
        document.getElementById('count-process').innerText = tickets.filter(t => t.status === 'in_progress').length;
        document.getElementById('count-done').innerText = tickets.filter(t => t.status === 'resolved').length;
    }
}

// 5. Calendario
async function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl || !userCompanyId) return;

    const { data: tickets } = await supabase
        .from('tickets')
        .select('*')
        .eq('client_id', userCompanyId);

    const events = (tickets || []).map(t => {
        const isMtto = t.ticket_type === 'maintenance';
        let color = '#e11d48'; // Open
        if (t.status === 'resolved') color = '#10b981';
        if (t.status === 'in_progress') color = '#f59e0b';
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

// 6. Configuración de Eventos de Botones
function setupEventListeners() {
    const modalCreate = document.getElementById('ticket-modal'); 
    const btnOpenCreate = document.getElementById('btn-open-ticket-client');
    const btnCancelCreate = document.getElementById('cancel-btn');
    const ticketForm = document.getElementById('client-new-ticket-form');
    const tabs = document.querySelectorAll('.tab-item');
    const typeInput = document.getElementById('ticket-type-input');

    // Botón abrir creación
    if (btnOpenCreate) {
        btnOpenCreate.onclick = () => modalCreate.classList.add('active');
    }

    // Botón cerrar creación
    if (btnCancelCreate) {
        btnCancelCreate.onclick = () => modalCreate.classList.remove('active');
    }

    // Tabs del modal
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const type = tab.dataset.tab;
            if (typeInput) typeInput.value = type;
            document.getElementById('subject-group').style.display = type === 'maintenance' ? 'none' : 'block';
            document.getElementById('date-group').style.display = type === 'maintenance' ? 'block' : 'none';
        });
    });

    // Enviar Ticket
    if (ticketForm) {
        ticketForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const type = typeInput?.value || 'incidence';

            const { error } = await supabase.from('tickets').insert([{
                client_id: userCompanyId,
                ticket_type: type,
                subject: type === 'maintenance' ? 'Mantenimiento Preventivo' : document.getElementById('subject-input').value,
                description: document.getElementById('description-input').value,
                scheduled_date: type === 'maintenance' ? document.getElementById('scheduled-date').value : null,
                status: 'open',
                priority: 'low'
            }]);

            if (!error) {
                modalCreate.classList.remove('active');
                ticketForm.reset();
                await loadTickets();
                await updateStats();
                await initCalendar();
                alert("🚀 ¡Solicitud enviada con éxito!");
            }
        });
    }

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../login.html';
    });
}

// Arrancamos
initPortal();