import supabase from '../supabase.js';

let currentUserId = null;
let calendar = null;
let lastTechValue = ""; 
let lastRecValue = "";

async function initTechDashboard() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '../login.html'; return; }
    
    currentUserId = user.id;

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

    await loadTechStats();
    await loadTechTickets();
    await initTechCalendar();
    setupTechEventListeners(); // 🚀 Activamos todos los clics de una vez
}

// --- 📊 ESTADÍSTICAS ---
async function loadTechStats() {
    const { data: tickets } = await supabase
        .from('tickets')
        .select('status, priority, ticket_type')
        .eq('assigned_to', currentUserId);

    if (tickets) {
        document.getElementById('count-open').innerText = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
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

    if (incidenceBody) incidenceBody.innerHTML = '';
    if (maintenanceBody) maintenanceBody.innerHTML = '';

    tickets.forEach(t => {
        let statusLabel = t.status === 'open' ? 'Pendiente' : 'En Proceso';
        
        // 🚀 Generamos la fila estilo PREMIUM (Igual que Admin)
        const row = `
            <tr>
                <td style="color: #6366f1; font-weight: 600; font-size: 0.85rem;">#${t.id.slice(0, 5).toUpperCase()}</td>
                <td><strong style="color: #1e293b;">${t.companies?.name || 'N/A'}</strong></td>
                <td style="color: #475569;">${t.subject}</td>
                <td>
                    <span class="status-pill ${t.status}">${statusLabel}</span>
                </td>
                <td>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button class="btn-action view-btn" data-id="${t.id}" title="Ver Detalles">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        
                        <button class="btn-action ${t.status === 'open' ? 'attend-btn' : 'manage-btn'}" 
                                data-id="${t.id}" 
                                title="${t.status === 'open' ? 'Atender' : 'Gestionar'}">
                            <i class="fa-solid ${t.status === 'open' ? 'fa-screwdriver-wrench' : 'fa-circle-check'}"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;

        if (t.ticket_type === 'maintenance') {
            if (maintenanceBody) maintenanceBody.innerHTML += row;
        } else {
            if (incidenceBody) incidenceBody.innerHTML += row;
        }
    });

    // 🔗 IMPORTANTE: Re-vincular los clics para que los botones funcionen
    document.querySelectorAll('.attend-btn, .manage-btn').forEach(btn => {
        btn.onclick = () => openAttendModal(btn.dataset.id);
    });

    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.onclick = () => openViewModal(btn.dataset.id);
    });
}

// --- 📅 CALENDARIO ---
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
        eventClick: (info) => openViewModal(info.event.id)
    });
    calendar.render();
}

// --- 🛠️ MODAL DE ATENCIÓN (LLAVE/GESTIÓN) ---
async function openAttendModal(id) {
    const modal = document.getElementById('attend-modal');
    const { data: t } = await supabase.from('tickets').select('*, companies(name)').eq('id', id).single();
    if (!t) return;

    document.getElementById('modal-ticket-id').innerText = `Atendiendo Ticket #${t.id.slice(0, 5).toUpperCase()}`;
    document.getElementById('attend-ticket-id').value = t.id;
    document.getElementById('attend-client').innerText = t.companies?.name || 'N/A';
    document.getElementById('attend-subject').innerText = t.subject;

    // Pasar a "En Proceso" automáticamente al abrir
    if (t.status === 'open') {
        await supabase.from('tickets').update({ status: 'in_progress' }).eq('id', id);
        loadTechTickets();
    }
    modal.style.display = 'flex';
}

// --- 👁️ MODAL DE VISTA (OJO) ---
async function openViewModal(id) {
    const modal = document.getElementById('view-ticket-modal');
    const { data: t } = await supabase.from('tickets').select('*, companies(name)').eq('id', id).single();
    if (!t) return;

    document.getElementById('v-id').innerText = `#${t.id.slice(0, 5).toUpperCase()}`;
    document.getElementById('v-client').innerText = t.companies?.name || 'N/A';
    document.getElementById('v-subject').innerText = t.subject;
    document.getElementById('v-description').innerText = t.description || 'Sin descripción detallada.';
    const statusText = t.status === 'open' ? 'Pendiente' : (t.status === 'resolved' ? 'Resuelto' : 'En Proceso');
    document.getElementById('v-status').innerHTML = `<span class="status-badge ${t.status}">${statusText}</span>`;
    document.getElementById('v-priority').innerText = t.priority.toUpperCase();

    modal.style.display = 'flex';
}

function setupTechEventListeners() {
    const attendModal = document.getElementById('attend-modal');
    const viewModal = document.getElementById('view-ticket-modal');

    // --- 🚪 GESTIÓN DE MODALES ---
    document.getElementById('close-attend-modal').onclick = () => attendModal.style.display = 'none';
    document.getElementById('btn-cancel-attend').onclick = () => attendModal.style.display = 'none';
    document.getElementById('close-view-modal').onclick = () => viewModal.style.display = 'none';
    document.getElementById('btn-close-view').onclick = () => viewModal.style.display = 'none';

    window.onclick = (event) => {
        if (event.target == attendModal) attendModal.style.display = 'none';
        if (event.target == viewModal) viewModal.style.display = 'none';
    };

    // --- 🪄 LÓGICA DE IA INTELIGENTE ---
    
    // Referencias a elementos
    const techNotes = document.getElementById('tech-notes');
    const btnIATech = document.getElementById('btn-ia-tech');
    const recNotes = document.getElementById('recommendations');
    const btnIARec = document.getElementById('btn-ia-rec');

    // 🕵️ Escuchar cambios en Descripción Técnica
    techNotes.addEventListener('input', () => {
        // Solo aparece si el texto cambió respecto al último pulido y tiene contenido
        if (techNotes.value.trim() !== lastTechValue && techNotes.value.length > 10) {
            btnIATech.style.display = 'inline-flex';
        } else {
            btnIATech.style.display = 'none';
        }
    });

    // 🕵️ Escuchar cambios en Recomendaciones
    recNotes.addEventListener('input', () => {
        if (recNotes.value.trim() !== lastRecValue && recNotes.value.length > 10) {
            btnIARec.style.display = 'inline-flex';
        } else {
            btnIARec.style.display = 'none';
        }
    });

    // Asignar clics a los botones
    if (btnIATech) btnIATech.onclick = () => handleIAMagic('tech-notes', 'tech', btnIATech);
    if (btnIARec) btnIARec.onclick = () => handleIAMagic('recommendations', 'rec', btnIARec);

    // --- 📨 ENVÍO DE FORMULARIO ---
    const attendForm = document.getElementById('attend-form');
    if (attendForm) {
        attendForm.onsubmit = handleFinalizeTicket;
    }
}

async function handleIAMagic(fieldId, type, btn) {
    const textarea = document.getElementById(fieldId);
    const originalText = textarea.value;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-sparkles fa-spin"></i>';

    try {
        const { data, error } = await supabase.functions.invoke('polish-report', {
            body: { text: originalText, type: type }
        });

        if (error) throw error;

        // 1. Reemplazamos el texto
        textarea.value = data.polishedText;

        // 2. 🛡️ Sincronizamos la memoria para que el botón desaparezca
        if (type === 'tech') {
            lastTechValue = data.polishedText;
        } else {
            lastRecValue = data.polishedText;
        }

        // 3. Escondemos el botón inmediatamente
        btn.style.display = 'none';

        // 4. ✅ NOTIFICACIÓN ELEGANTE (Toast)
        showToast("✨ Texto optimizado por la IA", "success");

    } catch (err) {
        console.error("Error IA:", err);
        showToast("La IA no pudo procesar el texto", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
    }
}

async function handleFinalizeTicket(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const ticketId = document.getElementById('attend-ticket-id').value;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

    try {
        // 🚨 IMPORTANTE: Verifica los nombres de tus columnas en Supabase
        const { error } = await supabase.from('tickets').update({
            status: 'resolved',
            received_by: document.getElementById('received-by').value,
            // Si el error 400 persiste, cambia 'description' por el nombre real en tu BD
            description: document.getElementById('tech-notes').value, 
            recommendations: document.getElementById('recommendations').value,
            updated_at: new Date()
        }).eq('id', ticketId);

        if (error) throw error;

        // ✅ USAMOS EL TOAST EN VEZ DEL ALERT
        showToast("¡Servicio finalizado con éxito!", "success");

        document.getElementById('attend-modal').style.display = 'none';
        e.target.reset();
        
        // Limpiamos memorias de IA
        lastTechValue = "";
        lastRecValue = "";

        loadTechStats();
        loadTechTickets();
        initTechCalendar();

    } catch (err) {
        console.error("Error al cerrar ticket:", err);
        showToast("Error al guardar: " + err.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-check-double"></i> Finalizar y Cerrar Ticket';
    }
}

// Arrancamos
initTechDashboard();

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-triangle-exclamation';
    
    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);

    // Animación de entrada
    setTimeout(() => toast.classList.add('show'), 100);

    // Auto-eliminar después de 3 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}