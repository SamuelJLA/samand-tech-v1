// 1. IMPORTACIONES
import supabase from './supabase.js';

// ============================================================
// SEGURIDAD: VERIFICACIÓN DE SESIÓN
// ============================================================
async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        window.location.href = 'login.html';
    } else {
        const userDisplay = document.getElementById('user-display-name');
        if (userDisplay && user.user_metadata.full_name) {
            userDisplay.innerText = user.user_metadata.full_name;
        }
    }
}
checkUser();

// ============================================================
// 2. REFERENCIAS DEL DOM
// ============================================================

// A. Tickets
const modal = document.getElementById('ticket-modal');
const btnNewTicketDash = document.getElementById('btn-open-modal');
const btnCloseModal = document.getElementById('close-modal');
const btnCancelModal = document.getElementById('cancel-btn');
const form = document.getElementById('new-ticket-form');
const ticketListBody = document.getElementById('ticket-list-body');

// B. Interacciones de Tickets
const viewModal = document.getElementById('view-modal');
const editModal = document.getElementById('edit-modal');
const attendModal = document.getElementById('attend-modal');

// C. Usuarios (Configuración)
const userModal = document.getElementById('user-modal');
const newUserForm = document.getElementById('new-user-form');
const btnConfig = document.getElementById('btn-config');
const btnCloseUser = document.getElementById('close-user-modal');
const btnCancelUser = document.getElementById('cancel-user-btn');

// D. Notificaciones y Sesión
const toastContainer = document.getElementById('toast-container');
const btnLogout = document.getElementById('logout-btn');

// ============================================================
// LÓGICA DE MODALES (A PRUEBA DE ERRORES)
// ============================================================

const closeModalFunc = () => {
    const modals = [modal, userModal, viewModal, editModal, attendModal];
    modals.forEach(m => { if(m) m.style.display = 'none'; });
};

if(btnNewTicketDash) btnNewTicketDash.addEventListener('click', () => modal.style.display = 'flex');

if(btnConfig) {
    btnConfig.addEventListener('click', (e) => {
        e.preventDefault();
        userModal.style.display = 'flex';
    });
}

[btnCloseModal, btnCancelModal, btnCloseUser, btnCancelUser].forEach(btn => {
    if(btn) btn.addEventListener('click', closeModalFunc);
});

document.querySelectorAll('.close-view, .close-edit, .close-attend').forEach(btn => {
    btn.addEventListener('click', closeModalFunc);
});

window.addEventListener('click', (e) => {
    const modals = [modal, userModal, viewModal, editModal, attendModal];
    if (modals.includes(e.target)) closeModalFunc();
});

// ============================================================
// FUNCIÓN DE NOTIFICACIONES TOAST
// ============================================================

function showToast(message) {
    const toast = document.createElement('div');
    toast.classList.add('toast');
    toast.innerHTML = `<i class="fa-solid fa-check-circle"></i><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================================
// GESTIÓN DE TICKETS Y ESTADÍSTICAS
// ============================================================

// 1. ACTUALIZAR CONTADORES SUPERIORES
async function updateStats() {
    const { data: tickets, error } = await supabase.from('tickets').select('status, assigned_to, priority');

    if (!error && tickets) {
        const open = tickets.filter(t => t.status === 'open').length;
        const unassigned = tickets.filter(t => !t.assigned_to && t.status !== 'resolved').length;
        const critical = tickets.filter(t => t.priority === 'critical' && t.status !== 'resolved').length;

        if(document.getElementById('count-open')) document.getElementById('count-open').innerText = open;
        if(document.getElementById('count-unassigned')) document.getElementById('count-unassigned').innerText = unassigned;
        if(document.getElementById('count-expired')) document.getElementById('count-expired').innerText = critical;
    }
}

// 2. CARGAR SELECTOR DE CLIENTES
async function loadClientsSelector() {
    const clientSelect = document.getElementById('client-select');
    if (!clientSelect) return;

    const { data: companies, error } = await supabase.from('companies').select('id, name').order('name');

    if (!error) {
        clientSelect.innerHTML = '<option value="" disabled selected>Selecciona una empresa...</option>';
        companies.forEach(c => {
            clientSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    }
}

// 3. CARGAR SELECTOR DE EQUIPO (ADMINS + TECHS)
async function loadTechSelector() {
    const techSelect = document.getElementById('tech-select');
    if (!techSelect) return;

    const { data: team, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['tech', 'admin'])
        .order('full_name');

    if (!error) {
        techSelect.innerHTML = '<option value="">Sin asignar</option>';
        team.forEach(m => {
            const tag = m.role === 'admin' ? '[Admin]' : '[Tech]';
            techSelect.innerHTML += `<option value="${m.id}">${m.full_name} ${tag}</option>`;
        });
    }
}

// 4. OBTENER Y PINTAR TICKETS
async function fetchTickets() {
    const { data: tickets, error } = await supabase
        .from('tickets')
        .select(`
            *,
            companies!fk_tickets_client ( name ),
            profiles!tickets_assigned_to_fkey ( full_name ) 
        `) // <-- Verifica que este nombre sea igual al del CONSTRAINT del SQL
        .order('created_at', { ascending: false });

    if (error) console.error("Error:", error.message);
    else {
        renderTickets(tickets);
        updateStats(); // Actualizamos los números cada vez que traemos tickets
    }
}

function renderTickets(tickets) {
    if (!ticketListBody) return;
    ticketListBody.innerHTML = '';
    
    tickets.forEach(ticket => {
        let rowClass = 'row-primary'; 
        if (ticket.priority === 'critical' || ticket.priority === 'high') rowClass = 'row-danger';
        else if (ticket.priority === 'medium') rowClass = 'row-warning';

        const techName = ticket.profiles?.full_name || "Sin asignar";
        const initials = techName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        const rowHtml = `
            <tr class="${rowClass}" data-id="${ticket.id}">
                <td>#${ticket.id.slice(0, 5)}</td>
                <td><strong>${ticket.companies?.name || 'Empresa N/A'}</strong></td>
                <td>${ticket.subject}</td>
                <td>
                    <div class="tech-info">
                        <div class="avatar-sm">${initials}</div>
                        <span>${techName}</span>
                    </div>
                </td>
                <td><span class="badge priority-${ticket.priority}">${ticket.priority}</span></td>
                <td><span class="status-pill ${ticket.status}">${ticket.status}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon view-btn" title="Ver"><i class="fa-solid fa-eye"></i></button>
                        <button class="btn-icon attend-btn" title="Atender"><i class="fa-solid fa-screwdriver-wrench"></i></button>
                    </div>
                </td>
            </tr>
        `;
        ticketListBody.insertAdjacentHTML('beforeend', rowHtml);
    });
}

// 5. GUARDAR TICKET
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.innerText = "Creando...";
    btn.disabled = true;

    const ticketData = {
        client_id: document.getElementById('client-select').value,
        assigned_to: document.getElementById('tech-select').value || null,
        priority: document.getElementById('priority-select').value,
        subject: document.getElementById('subject-input').value,
        description: document.getElementById('description-input').value,
        status: 'open'
    };

    const { error } = await supabase.from('tickets').insert([ticketData]);

    if (error) alert("❌ Error: " + error.message);
    else {
        showToast(`✅ Ticket generado correctamente.`);
        form.reset();
        closeModalFunc();
        fetchTickets();
    }
    btn.innerText = "Crear Ticket";
    btn.disabled = false;
});

// ============================================================
// GESTIÓN DE USUARIOS
// ============================================================

newUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('save-user-btn');
    btn.innerText = "Creando...";
    btn.disabled = true;

    const { error } = await supabase.auth.signUp({
        email: document.getElementById('user-email').value,
        password: document.getElementById('user-password').value,
        options: {
            data: {
                full_name: document.getElementById('user-full-name').value,
                role: document.getElementById('user-role').value
            }
        }
    });

    if (error) alert("❌ Error: " + error.message);
    else {
        showToast(`✅ Acceso creado.`);
        newUserForm.reset();
        closeModalFunc();
        loadTechSelector(); // Recargamos equipo por si registramos un nuevo técnico
    }
    btn.innerText = "Crear Acceso";
    btn.disabled = false;
});

// ============================================================
// EVENTOS Y CIERRE DE SESIÓN
// ============================================================

ticketListBody.addEventListener('click', (e) => {
    if (e.target.closest('.view-btn')) viewModal.style.display = 'flex';
    if (e.target.closest('.attend-btn')) attendModal.style.display = 'flex';
});

if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    });
}

// ============================================================
// INICIO DE CARGA
// ============================================================
loadClientsSelector();
loadTechSelector();
fetchTickets();