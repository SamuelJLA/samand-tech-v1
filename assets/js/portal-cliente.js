import supabase from './supabase.js';

let userCompanyId = null;

// 1. Inicializar Portal
async function initPortal() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '../login.html'; return; }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*, companies(name)')
        .eq('id', user.id)
        .single();

    if (profile) {
        userCompanyId = profile.empresa_id;
        document.getElementById('user-name').innerText = profile.full_name;
        document.getElementById('company-name').innerText = profile.companies.name;
        loadTickets();
    }
}

// 2. Cargar Tickets y Stats
async function loadTickets() {
    const { data: tickets } = await supabase
        .from('tickets')
        .select('*')
        .eq('empresa_id', userCompanyId)
        .order('created_at', { ascending: false });

    // Llenar tabla
    const tbody = document.getElementById('client-tickets-body');
    tbody.innerHTML = tickets.map(t => `
        <tr>
            <td>#${t.id.toString().padStart(4, '0')}</td>
            <td>${new Date(t.created_at).toLocaleDateString()}</td>
            <td>
                <strong>${t.tipo_ticket === 'Mantenimiento' ? 'Mantenimiento' : t.asunto}</strong><br>
                <small>${t.tipo_ticket}</small>
            </td>
            <td><span class="badge status-${t.status.toLowerCase()}">${t.status}</span></td>
            <td>${new Date(t.updated_at || t.created_at).toLocaleDateString()}</td>
        </tr>
    `).join('');

    // Actualizar Contadores
    document.getElementById('count-pending').innerText = tickets.filter(t => t.status === 'Pendiente').length;
    document.getElementById('count-process').innerText = tickets.filter(t => t.status === 'En Proceso').length;
    document.getElementById('count-done').innerText = tickets.filter(t => t.status === 'Completado').length;
}

// 3. Manejo del Formulario
document.getElementById('tipo_ticket').addEventListener('change', (e) => {
    const isMantenimiento = e.target.value === 'Mantenimiento';
    document.getElementById('campo-asunto').style.display = isMantenimiento ? 'none' : 'block';
    document.getElementById('campo-fecha').style.display = isMantenimiento ? 'block' : 'none';
});

document.getElementById('form-nuevo-ticket').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        empresa_id: userCompanyId,
        tipo_ticket: document.getElementById('tipo_ticket').value,
        asunto: document.getElementById('asunto').value,
        descripcion: document.getElementById('descripcion').value,
        fecha_programada: document.getElementById('fecha_programada').value || null,
        status: 'Pendiente'
    };

    const { error } = await supabase.from('tickets').insert([formData]);

    if (!error) {
        alert("¡Ticket enviado con éxito!");
        document.getElementById('modal-ticket').style.display = 'none';
        loadTickets();
    }
});

initPortal();

// Seleccionar elementos
const modal = document.getElementById('modal-ticket');
const btnNuevo = document.getElementById('btn-nuevo-ticket');
const btnCerrar = document.querySelector('.close-modal');
const btnCancelar = document.querySelector('.close-btn');

// Abrir modal
btnNuevo.addEventListener('click', () => {
    modal.classList.add('open');
});

// Cerrar modal (X o botón cancelar)
[btnCerrar, btnCancelar].forEach(btn => {
    btn.addEventListener('click', () => {
        modal.classList.remove('open');
    });
});

// Cerrar si hace clic fuera del cuadrito blanco
window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('open');
    }
});