// 1. IMPORTACIONES
import supabase from './supabase.js';

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

// A. Tickets y Modales
const modal = document.getElementById('ticket-modal');
const btnNewTicketDash = document.getElementById('btn-open-modal');
const btnOpenMtto = document.getElementById('btn-open-mtto');
const btnCloseModal = document.getElementById('close-modal');
const btnCancelModal = document.getElementById('cancel-btn');
const form = document.getElementById('new-ticket-form');

// B. Tablas
const incidenceListBody = document.getElementById('incidence-list-body');
const maintenanceListBody = document.getElementById('maintenance-list-body');

// C. Elementos de los Tabs
const tabs = document.querySelectorAll('.tab-item');
const indicator = document.querySelector('.tab-indicator');
const ticketTypeInput = document.getElementById('ticket-type-input');
const dateGroup = document.getElementById('date-group');
const subjectGroup = document.getElementById('subject-group');

// D. Otros Modales
const viewModal = document.getElementById('view-modal');
const editModal = document.getElementById('edit-modal');
const attendModal = document.getElementById('attend-modal');
const userModal = document.getElementById('user-modal');
const newUserForm = document.getElementById('new-user-form');
const btnConfig = document.getElementById('btn-config');

// E. Notificaciones, Sesión y Calendario
const toastContainer = document.getElementById('toast-container');
const btnLogout = document.getElementById('logout-btn');
let calendar; // Variable global para el calendario

// ============================================================
// LÓGICA DE TABS (DESLIZADO)
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
// LÓGICA DE MODALES (ABRIR Y CERRAR)
// ============================================================

const closeModalFunc = () => {
    const modals = [modal, userModal, viewModal, editModal, attendModal];
    modals.forEach(m => { if(m) m.style.display = 'none'; });
};

if(btnNewTicketDash) {
    btnNewTicketDash.addEventListener('click', () => {
        modal.style.display = 'flex';
        if(tabs.length > 0) tabs[0].click(); 
    });
}

if(btnOpenMtto) {
    btnOpenMtto.addEventListener('click', () => {
        modal.style.display = 'flex';
        if(tabs.length > 1) tabs[1].click(); 
    });
}

if(btnConfig) btnConfig.addEventListener('click', (e) => { e.preventDefault(); userModal.style.display = 'flex'; });

// Selectores dinámicos para las "X" de todos los modales
document.querySelectorAll('.btn-close, .btn-secondary, .close-view, .close-attend').forEach(btn => {
    btn.addEventListener('click', closeModalFunc);
});

window.addEventListener('click', (e) => {
    const modalsToClose = [modal, userModal, viewModal, attendModal];
    if (modalsToClose.includes(e.target)) closeModalFunc();
});

// ============================================================
// FUNCIONES DE APOYO (TOAST & STATS)
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
        // Referencias seguras a los elementos
        const elOpen = document.getElementById('count-open');
        const elCritical = document.getElementById('count-expired');
        const elMtto = document.getElementById('count-maintenance');

        // Solo escribimos si el elemento EXISTE en el HTML
        if(elOpen) {
            elOpen.innerText = tickets.filter(t => t.status === 'open').length;
        }
        
        if(elCritical) {
            elCritical.innerText = tickets.filter(t => 
                (t.priority === 'critical' || t.priority === 'high') && t.status !== 'resolved'
            ).length;
        }

        if(elMtto) {
            elMtto.innerText = tickets.filter(t => t.ticket_type === 'maintenance').length;
        }
    }
}

// ============================================================
// MOTOR DEL CALENDARIO (IDIOMA ESPAÑOL Y TOOLTIP GLASS)
// ============================================================

function initCalendar(tickets) {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    // Transformar tickets a formato de eventos
    const events = tickets.map(t => {
        const isMaintenance = t.ticket_type === 'maintenance';
        return {
            id: t.id,
            // Texto del evento en el calendario (Español)
            title: `${isMaintenance ? '🛠️' : '⚠️'} ${t.companies?.name || 'Ticket'}`,
            start: isMaintenance ? t.scheduled_date : t.created_at,
            backgroundColor: isMaintenance ? '#0ea5e9' : '#e11d48',
            // Datos extra para el tooltip
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
        locale: 'es', // <--- CONFIGURACIÓN DE IDIOMA
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        },
        events: events,

        // --- EL HOVER (Tu ventanita estilo Glass) ---
        eventMouseEnter: function(info) {
            const props = info.event.extendedProps;
            const isMaintenance = info.event.backgroundColor === '#0ea5e9';
            
            // Definimos el tipo y el color de acento
            const tipoTicket = isMaintenance ? 'Mantenimiento' : 'IyR';
            const colorAcento = info.event.backgroundColor;

            const tooltipContent = `
                <div class="calendar-tooltip-glass" style="border-left: 5px solid ${colorAcento}">
                    <div class="tooltip-header">
                        <span class="tooltip-tag" style="background: ${colorAcento}"></span>
                        <h4>Detalles - ${tipoTicket}</h4>
                    </div>
                    <p><strong><i class="fa-solid fa-building"></i> Cliente:</strong> ${props.empresa}</p>
                    <p><strong><i class="fa-solid fa-comment-dots"></i> Asunto:</strong> ${props.asunto}</p>
                    <p><strong><i class="fa-solid fa-user-gear"></i> Técnico:</strong> ${props.tecnico}</p>
                </div>
            `;

            const tooltipEl = document.createElement('div');
            tooltipEl.innerHTML = tooltipContent;
            tooltipEl.className = 'tooltip-container';
            document.body.appendChild(tooltipEl);

            // Posicionamiento (Ajustado con Scroll)
            const eventRect = info.el.getBoundingClientRect();
            tooltipEl.style.top = `${eventRect.top + window.scrollY - tooltipEl.offsetHeight - 15}px`;
            tooltipEl.style.left = `${eventRect.left + window.scrollX + (eventRect.width / 2) - (tooltipEl.offsetWidth / 2)}px`;

            info.el._tooltipEl = tooltipEl;
        },

        // --- Borrar tooltip al salir ---
        eventMouseLeave: function(info) {
            if(info.el._tooltipEl) {
                info.el._tooltipEl.remove();
                info.el._tooltipEl = null;
                info.el.classList.remove('has-tooltip');
            }
        },

        // --- EL CLICK (Abrir detalle) ---
        eventClick: function(info) {
            viewModal.style.display = 'flex';
            // Aquí luego cargaremos la data del ticket en el modal
        }
    });

    calendar.render();
}

// ============================================================
// GESTIÓN DE DATA (FETCH & RENDER)
// ============================================================

async function fetchTickets() {
    const { data: tickets, error } = await supabase
        .from('tickets')
        .select(`
            *,
            companies!fk_tickets_client ( name ),
            profiles!tickets_assigned_to_fkey ( full_name ) 
        `)
        .order('created_at', { ascending: false });

    if (!error) {
        const incidences = tickets.filter(t => t.ticket_type === 'incidence' || !t.ticket_type);
        const maintenances = tickets.filter(t => t.ticket_type === 'maintenance');
        
        renderIncidences(incidences);
        renderMaintenances(maintenances);
        updateStats(); 
        initCalendar(tickets); // Sincroniza el calendario
    }
}

function renderIncidences(list) {
    if (!incidenceListBody) return;
    
    incidenceListBody.innerHTML = list.map(t => {
        // Lógica de colores de fila
        const rowClass = (t.priority === 'critical' || t.priority === 'high') ? 'row-danger' : 'row-primary';
        
        // Lógica del botón dinámico (Play si está abierto, Editar si está en progreso)
        let actionButton = '';
        if (t.status === 'open') {
            actionButton = `
                <button class="btn-icon attend-btn" title="Empezar a Atender" data-id="${t.id}">
                    <i class="fa-solid fa-play" style="color: #10b981;"></i>
                </button>`;
        } else if (t.status === 'in_progress') {
            actionButton = `
                <button class="btn-icon edit-btn" title="Gestionar / Cerrar" data-id="${t.id}">
                    <i class="fa-solid fa-pen-to-square" style="color: #0ea5e9;"></i>
                </button>`;
        }

        return `
            <tr class="${rowClass}" data-id="${t.id}">
                <td>#${t.id.slice(0, 4)}</td>
                <td><strong>${t.companies?.name || 'N/A'}</strong></td>
                <td>${t.subject}</td>
                <td><span class="status-pill ${t.status}">${t.status}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon view-btn"><i class="fa-solid fa-eye"></i></button>
                        ${actionButton}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderMaintenances(list) {
    if (!maintenanceListBody) return;
    
    maintenanceListBody.innerHTML = list.map(t => {
        // Lógica de botón dinámico (Igual a Incidencias)
        let actionButton = '';
        if (t.status === 'open') {
            actionButton = `
                <button class="btn-icon attend-btn" title="Empezar a Atender" data-id="${t.id}">
                    <i class="fa-solid fa-play" style="color: #10b981;"></i>
                </button>`;
        } else if (t.status === 'in_progress') {
            actionButton = `
                <button class="btn-icon edit-btn" title="Gestionar / Cerrar" data-id="${t.id}">
                    <i class="fa-solid fa-pen-to-square" style="color: #0ea5e9;"></i>
                </button>`;
        }

        return `
            <tr class="row-primary" data-id="${t.id}">
                <td>#M-${t.id.slice(0, 4)}</td>
                <td><strong>${t.companies?.name || 'N/A'}</strong></td>
                <td>${t.scheduled_date || 'Pendiente'}</td>
                <td>${t.profiles?.full_name || 'Sin asignar'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon view-btn" title="Ver"><i class="fa-solid fa-eye"></i></button>
                        ${actionButton}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================================
// GUARDAR TICKET (MODIFICADO PARA TABS)
// ============================================================

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-ticket-btn');
    btn.innerText = "Procesando...";
    btn.disabled = true;

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

    if (!error) {
        showToast(`✅ ${type === 'maintenance' ? 'Programado' : 'Creado'} exitosamente.`);
        form.reset();
        closeModalFunc();
        fetchTickets();
    }
    btn.innerText = "Crear Ticket";
    btn.disabled = false;
});

// ============================================================
// SELECTORES Y SESIÓN
// ============================================================

async function loadClientsSelector() {
    const { data } = await supabase.from('companies').select('id, name').order('name');
    if(data) document.getElementById('client-select').innerHTML = '<option value="" disabled selected>Empresa...</option>' + data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

async function loadTechSelector() {
    const { data } = await supabase.from('profiles').select('id, full_name').in('role', ['tech', 'admin']);
    if(data) document.getElementById('tech-select').innerHTML = '<option value="">Técnico...</option>' + data.map(t => `<option value="${t.id}">${t.full_name}</option>`).join('');
}

if (btnLogout) btnLogout.addEventListener('click', async () => { await supabase.auth.signOut(); window.location.href = 'login.html'; });

// ============================================================
// ESCUCHADOR ÚNICO PARA AMBAS TABLAS (EL MOTOR DE ACCIONES)
// ============================================================
[incidenceListBody, maintenanceListBody].forEach(list => {
    if (list) {
        list.addEventListener('click', async (e) => {
            
            // 1. ACCIÓN: VISUALIZAR (EL OJO)
            if (e.target.closest('.view-btn')) {
                viewModal.style.display = 'flex';
                // Aquí podrías cargar la info del ticket al modal en el futuro
            }

            // 2. ACCIÓN: START / ATENDER (EL PLAY VERDE)
            const attendBtn = e.target.closest('.attend-btn');
            if (attendBtn) {
                const ticketId = attendBtn.getAttribute('data-id');
                const { error } = await supabase
                    .from('tickets')
                    .update({ status: 'in_progress' })
                    .eq('id', ticketId);

                if (!error) {
                    showToast("🚀 ¡Misión iniciada! El ticket pasó a proceso.");
                    fetchTickets(); // Esto refresca la tabla y cambia el Play por el Lápiz
                }
            }

            // 3. ACCIÓN: GESTIONAR / CERRAR (EL LÁPIZ AZUL) - ¡ESTE ES EL QUE FALTABA!
            if (e.target.closest('.edit-btn')) {
                // Por ahora abrimos el de atender, donde haremos la mini-mesa de trabajo para cerrar
                attendModal.style.display = 'flex';
                console.log("Abriendo gestión para cierre de ticket...");
            }
        });
    }
});

// ============================================================
// INICIALIZACIÓN
// ============================================================
async function init() {
    await Promise.all([loadClientsSelector(), loadTechSelector(), fetchTickets()]);
}
init();