// 1. IMPORTACIONES
import supabase from './supabase.js';
import { labels } from './utils.js';

// ============================================================
// SEGURIDAD Y SESIÓN
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
const modal = document.getElementById('ticket-modal');
const btnNewTicketDash = document.getElementById('btn-open-modal');
const btnOpenMtto = document.getElementById('btn-open-mtto');
const btnCloseModal = document.getElementById('close-modal');
const btnCancelModal = document.getElementById('cancel-btn');
const form = document.getElementById('new-ticket-form');

const incidenceListBody = document.getElementById('incidence-list-body');
const maintenanceListBody = document.getElementById('maintenance-list-body');

const tabs = document.querySelectorAll('.tab-item');
const indicator = document.querySelector('.tab-indicator');
const ticketTypeInput = document.getElementById('ticket-type-input');
const dateGroup = document.getElementById('date-group');
const subjectGroup = document.getElementById('subject-group');

const viewModal = document.getElementById('view-modal');
const attendModal = document.getElementById('attend-modal');

// --- REFERENCIAS IA ---
const btnAISuggest = document.getElementById('btn-ai-suggest');

const toastContainer = document.getElementById('toast-container');

// --- NUEVO: REFERENCIAS GESTIÓN DE USUARIOS ---
const userModal = document.getElementById('user-modal');
const formUser = document.getElementById('form-create-user');
const btnOpenUserModal = document.getElementById('btn-config'); 
const roleSelect = document.getElementById('new-user-role');

let calendar; 
let currentEditingId = null; 

// ============================================================
// LÓGICA DE TABS (TICKETS)
// ============================================================
tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
        if(indicator) indicator.style.transform = `translateX(${index * 100}%)`;
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const type = tab.getAttribute('data-tab');
        ticketTypeInput.value = type;

        if (type === 'maintenance') {
            dateGroup.style.display = 'block';
            subjectGroup.style.display = 'none';
            document.getElementById('submit-ticket-btn').innerText = "Programar MTTO";
        } else {
            dateGroup.style.display = 'none';
            subjectGroup.style.display = 'block';
            document.getElementById('submit-ticket-btn').innerText = "Crear Ticket";
        }
    });
});

// ============================================================
// LÓGICA DE MODALES
// ============================================================
const closeModalFunc = () => {
    // NUEVO: Añadido userModal a la lista de cierre
    const modals = [modal, viewModal, attendModal, userModal];
    modals.forEach(m => { if(m) m.style.display = 'none'; });
};

if(btnNewTicketDash) btnNewTicketDash.addEventListener('click', () => {
    modal.style.display = 'flex';
    if(tabs.length > 0) tabs[0].click(); 
});

if(btnOpenMtto) btnOpenMtto.addEventListener('click', () => {
    modal.style.display = 'flex';
    if(tabs.length > 1) tabs[1].click(); 
});

// NUEVO: Abrir Modal de Usuarios (Vínculado a Configuración temporalmente)
if(btnOpenUserModal) btnOpenUserModal.addEventListener('click', (e) => {
    e.preventDefault();
    userModal.style.display = 'flex';
    cargarEmpresasParaUser();
});

document.querySelectorAll('.btn-close, .btn-secondary, .close-view, .close-attend, #cancel-user-btn, #close-user-modal').forEach(btn => {
    btn.addEventListener('click', closeModalFunc);
});

window.addEventListener('click', (e) => {
    const modalsToClose = [modal, viewModal, attendModal, userModal];
    if (modalsToClose.includes(e.target)) closeModalFunc();
});

// ============================================================
// FUNCIONES DE APOYO
// ============================================================
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast show';
    toast.innerHTML = `<i class="fa-solid fa-check-circle"></i><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => { toast.classList.replace('show', 'hide'); setTimeout(() => toast.remove(), 300); }, 4000);
}

async function updateStats() {
    const { data: tickets, error } = await supabase.from('tickets').select('status, priority, ticket_type');
    if (!error && tickets) {
        const elOpen = document.getElementById('count-open');
        const elCritical = document.getElementById('count-expired');
        const elMtto = document.getElementById('count-maintenance');
        if(elOpen) elOpen.innerText = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
        if(elCritical) elCritical.innerText = tickets.filter(t => (t.priority === 'critical' || t.priority === 'high') && t.status !== 'resolved').length;
        if(elMtto) elMtto.innerText = tickets.filter(t => t.ticket_type === 'maintenance' && t.status !== 'resolved').length;
    }
}

// ============================================================
// NUEVO: GESTIÓN DE USUARIOS PRO (EDGE FUNCTION)
// ============================================================
async function registrarUsuarioPro(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-user');
    const originalText = btn.innerHTML;
    
    btn.innerText = "Procesando...";
    btn.disabled = true;

    const userData = {
        full_name: document.getElementById('new-user-name').value,
        email: document.getElementById('new-user-email').value,
        password: document.getElementById('new-user-pass').value,
        role: document.getElementById('new-user-role').value,
        empresa_id: document.getElementById('new-user-company').value || null
    };

    try {
        const { data, error } = await supabase.functions.invoke('create-user', {
            body: userData
        });

        if (error) throw error;

        showToast("🚀 ¡Usuario Pro creado con éxito!");
        closeModalFunc();
        formUser.reset();
        
    } catch (err) {
        console.error("Error:", err);
        alert("Fallo al crear usuario: " + err.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function cargarEmpresasParaUser() {
    const { data } = await supabase.from('companies').select('id, name').order('name');
    const select = document.getElementById('new-user-company');
    if(data && select) {
        select.innerHTML = '<option value="">Seleccione Empresa...</option>' + 
            data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
}

// Ocultar selector de empresa si no es cliente
if(roleSelect) {
    roleSelect.addEventListener('change', () => {
        const companyGroup = document.getElementById('company-select-group');
        companyGroup.style.display = roleSelect.value === 'client' ? 'block' : 'none';
    });
}

// ============================================================
// CALENDARIO
// ============================================================
function initCalendar(tickets) {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;
    const events = tickets.map(t => {
        const isMaintenance = t.ticket_type === 'maintenance';
        return {
            id: t.id,
            title: `${isMaintenance ? '🛠️' : '⚠️'} ${t.companies?.name || 'Ticket'}`,
            start: isMaintenance ? t.scheduled_date : t.created_at,
            backgroundColor: isMaintenance ? '#0ea5e9' : '#e11d48',
            extendedProps: {
                asunto: isMaintenance ? 'Mantenimiento Preventivo' : t.subject,
                tecnico: t.profiles?.full_name || 'Sin asignar',
                empresa: t.companies?.name || 'N/A'
            }
        };
    });
    if (calendar) calendar.destroy();
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'es',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' },
        events: events,
        eventMouseEnter: function(info) {
            const props = info.event.extendedProps;
            const colorAcento = info.event.backgroundColor;
            const tooltipContent = `<div class="calendar-tooltip-glass" style="border-left: 5px solid ${colorAcento}"><div class="tooltip-header"><h4>Detalles</h4></div><p><strong>Cliente:</strong> ${props.empresa}</p><p><strong>Asunto:</strong> ${props.asunto}</p><p><strong>Técnico:</strong> ${props.tecnico}</p></div>`;
            const tooltipEl = document.createElement('div');
            tooltipEl.innerHTML = tooltipContent;
            tooltipEl.className = 'tooltip-container';
            document.body.appendChild(tooltipEl);
            const eventRect = info.el.getBoundingClientRect();
            tooltipEl.style.top = `${eventRect.top + window.scrollY - tooltipEl.offsetHeight - 15}px`;
            tooltipEl.style.left = `${eventRect.left + window.scrollX + (eventRect.width / 2) - (tooltipEl.offsetWidth / 2)}px`;
            info.el._tooltipEl = tooltipEl;
        },
        eventMouseLeave: function(info) { if(info.el._tooltipEl) info.el._tooltipEl.remove(); },
        eventClick: function(info) {
            showTicketDetails(info.event.id);
        }
    });
    calendar.render();
}

// ============================================================
// GESTIÓN DE DATA (TICKETS)
// ============================================================
async function fetchTickets() {
    const { data: tickets, error } = await supabase
        .from('tickets')
        .select(`*, companies!fk_tickets_client ( name ), profiles!tickets_assigned_to_fkey ( full_name ) `)
        .order('created_at', { ascending: false });

    if (!error) {
        const activeTickets = tickets.filter(t => t.status !== 'resolved');
        const incidences = activeTickets.filter(t => t.ticket_type === 'incidence' || !t.ticket_type);
        const maintenances = activeTickets.filter(t => t.ticket_type === 'maintenance');
        
        renderIncidences(incidences);
        renderMaintenances(maintenances);
        updateStats(); 
        initCalendar(activeTickets);
    }
}

function renderIncidences(list) {
    if (!incidenceListBody) return;
    incidenceListBody.innerHTML = list.map(t => {
        const rowClass = (t.priority === 'critical' || t.priority === 'high') ? 'row-danger' : 'row-primary';
        const statusTraducido = labels.status[t.status] || t.status;
        let actionButton = t.status === 'open' 
            ? `<button class="btn-icon attend-btn" title="Atender" data-id="${t.id}"><i class="fa-solid fa-play" style="color: #10b981;"></i></button>`
            : `<button class="btn-icon edit-btn" title="Gestionar" data-id="${t.id}"><i class="fa-solid fa-pen-to-square" style="color: #0ea5e9;"></i></button>`;
        return `
            <tr class="${rowClass}" data-id="${t.id}">
                <td>#${t.id.slice(0, 4)}</td>
                <td><strong>${t.companies?.name || 'N/A'}</strong></td>
                <td>${t.subject}</td>
                <td><span class="status-pill ${t.status}">${statusTraducido}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon view-btn"><i class="fa-solid fa-eye"></i></button>
                        ${actionButton}
                    </div>
                </td>
            </tr>`;
    }).join('');
}

function renderMaintenances(list) {
    if (!maintenanceListBody) return;
    maintenanceListBody.innerHTML = list.map(t => {
        const tecnicoNombre = t.profiles?.full_name || 'Sin asignar';
        let actionButton = t.status === 'open' 
            ? `<button class="btn-icon attend-btn" title="Atender" data-id="${t.id}"><i class="fa-solid fa-play" style="color: #10b981;"></i></button>`
            : `<button class="btn-icon edit-btn" title="Gestionar" data-id="${t.id}"><i class="fa-solid fa-pen-to-square" style="color: #0ea5e9;"></i></button>`;
        return `
            <tr class="row-primary" data-id="${t.id}">
                <td>#M-${t.id.slice(0, 4)}</td>
                <td><strong>${t.companies?.name || 'N/A'}</strong></td>
                <td>${t.scheduled_date || 'Pendiente'}</td>
                <td>${tecnicoNombre}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon view-btn" title="Ver"><i class="fa-solid fa-eye"></i></button>
                        ${actionButton}
                    </div>
                </td>
            </tr>`;
    }).join('');
}

// ============================================================
// EVENTOS DE TABLAS Y FORMULARIOS
// ============================================================
[incidenceListBody, maintenanceListBody].forEach(list => {
    if (list) {
        list.addEventListener('click', async (e) => {
            if (e.target.closest('.view-btn')) {
                const id = e.target.closest('tr').getAttribute('data-id'); 
                showTicketDetails(id);
            }
            const attendBtn = e.target.closest('.attend-btn');
            if (attendBtn) {
                const id = attendBtn.getAttribute('data-id');
                const { error } = await supabase.from('tickets').update({ status: 'in_progress' }).eq('id', id);
                if (!error) { showToast("🚀 ¡Misión iniciada!"); fetchTickets(); }
            }
            const editBtn = e.target.closest('.edit-btn');
            if (editBtn) {
                currentEditingId = editBtn.getAttribute('data-id'); 
                attendModal.style.display = 'flex';
                const { data: currentTicket } = await supabase.from('tickets').select('description, recommendations, received_by').eq('id', currentEditingId).single();
                if(currentTicket){
                    document.getElementById('attend-notes').value = currentTicket.description || "";
                    document.getElementById('attend-recommendations').value = currentTicket.recommendations || "";
                    document.getElementById('attend-received').value = currentTicket.received_by || "";
                }
            }
        });
    }
});

const attendForm = document.getElementById('attend-form');
if (attendForm) {
    attendForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = attendForm.querySelector('button[type="submit"]');
        const received_by = document.getElementById('attend-received').value;
        const status = document.getElementById('attend-status').value;
        const notes = document.getElementById('attend-notes').value;
        const recommendations = document.getElementById('attend-recommendations').value;

        btnSubmit.innerText = "Guardando...";
        btnSubmit.disabled = true;

        const { error } = await supabase
            .from('tickets')
            .update({ 
                status: status,
                description: notes,
                received_by: received_by,
                recommendations: recommendations,
                updated_at: new Date()
            })
            .eq('id', currentEditingId);

        if (error) {
            alert("❌ Error: " + error.message);
        } else {
            showToast(status === 'resolved' ? "✅ ¡Servicio Cerrado con éxito!" : "💾 Gestión guardada.");
            closeModalFunc();
            fetchTickets();
        }
        btnSubmit.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Gestión';
        btnSubmit.disabled = false;
    });
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = ticketTypeInput.value;
    const ticketData = {
        client_id: document.getElementById('client-select').value,
        assigned_to: document.getElementById('tech-select').value || null,
        priority: document.getElementById('priority-select').value,
        subject: type === 'maintenance' ? 'Mantenimiento Preventivo' : document.getElementById('subject-input').value,
        description: document.getElementById('description-input').value,
        ticket_type: type,
        scheduled_date: type === 'maintenance' ? document.getElementById('scheduled-date').value : null,
        status: 'open'
    };
    const { error } = await supabase.from('tickets').insert([ticketData]);
    if (!error) { showToast("✅ Creado exitosamente"); form.reset(); closeModalFunc(); fetchTickets(); }
});

// NUEVO: Listener para el formulario de Usuarios Pro
if (formUser) {
    formUser.addEventListener('submit', registrarUsuarioPro);
}

async function showTicketDetails(id) {
    const { data: t, error } = await supabase
        .from('tickets')
        .select(`*, companies!fk_tickets_client ( name ), profiles!tickets_assigned_to_fkey ( full_name )`)
        .eq('id', id)
        .single();

    if (!error && t) {
        const priorityText = labels.priority[t.priority] || 'Media';
        const statusText = labels.status[t.status] || 'Abierto';
        const techName = t.profiles?.full_name || 'Sin técnico asignado';

        document.getElementById('view-ticket-id').innerText = `Detalle del Ticket #${t.id.slice(0, 5)}`;
        document.getElementById('view-client').innerText = t.companies?.name || 'N/A';
        document.getElementById('view-tech').innerText = techName;
        document.getElementById('view-priority').innerHTML = `<span class="badge priority-${t.priority}">${priorityText}</span>`;
        document.getElementById('view-status').innerHTML = `<span class="status-pill ${t.status}">${statusText}</span>`;
        document.getElementById('view-desc').innerText = t.description || 'No hay descripción adicional.';
        viewModal.style.display = 'flex';
    }
}

// ============================================================
// ELIMINAR TICKET
// ============================================================
const btnDeleteTicket = document.getElementById('btn-delete-ticket');
if (btnDeleteTicket) {
    btnDeleteTicket.addEventListener('click', async () => {
        if (confirm("¿Seguro que quieres eliminar este ticket? No habrá vuelta atrás, Samuel.")) {
            const { error } = await supabase.from('tickets').delete().eq('id', currentEditingId);
            if (!error) {
                showToast("🗑️ Ticket eliminado correctamente");
                closeModalFunc();
                fetchTickets();
            } else {
                alert("Error al eliminar: " + error.message);
            }
        }
    });
}

// ============================================================
// LOGICA DE INTELIGENCIA ARTIFICIAL (GROQ)
// ============================================================
const GROQ_API_KEY = "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";

if (btnAISuggest) {
    btnAISuggest.addEventListener('click', async () => {
        const descField = document.getElementById('attend-notes');
        const recomField = document.getElementById('attend-recommendations');
        if (!descField.value || descField.value.length < 5) {
            return alert("⚠️ Samuel, escribe algo en la descripción técnica para que la IA pueda trabajar.");
        }
        btnAISuggest.disabled = true;
        btnAISuggest.innerHTML = '<i class="fa-solid fa-wand-sparkles fa-spin"></i> Optimizando Reporte...';
        const prompt = `Actúa como Consultor Senior de IT en SAMAND TECH...`;

        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.5,
                    response_format: { "type": "json_object" } 
                })
            });
            const data = await response.json();
            const result = JSON.parse(data.choices[0].message.content);
            descField.value = result.desc_mejorada;
            recomField.value = result.recom_mejorada;
            showToast("✨ Reporte profesionalizado con IA");
        } catch (err) {
            console.error("Error optimizando:", err);
            alert("❌ Falló la conexión con la IA.");
        } finally {
            btnAISuggest.disabled = false;
            btnAISuggest.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Sugerir con IA';
        }
    });
}

// ============================================================
// INICIO
// ============================================================
async function loadClientsSelector() {
    const { data } = await supabase.from('companies').select('id, name').order('name');
    if(data) document.getElementById('client-select').innerHTML = '<option value="" disabled selected>Empresa...</option>' + data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

async function loadTechSelector() {
    const { data } = await supabase.from('profiles').select('id, full_name').in('role', ['tech', 'admin']);
    if(data) document.getElementById('tech-select').innerHTML = '<option value="">Técnico...</option>' + data.map(t => `<option value="${t.id}">${t.full_name}</option>`).join('');
}

async function init() {
    await Promise.all([loadClientsSelector(), loadTechSelector(), fetchTickets()]);
}
init();