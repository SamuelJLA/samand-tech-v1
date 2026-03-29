import supabase from '../supabase.js';

let rootServiceId = null;
let currentParentId = null;
let serviceHistory = [];
let userCompanyId = null;

async function init() {
    // 1. Verificar Autenticación
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '../login.html'; return; }

    // 2. Cargar Perfil y Empresa
    const { data: profile } = await supabase
        .from('profiles')
        .select('*, companies!empresa_id(name)')
        .eq('id', user.id)
        .single();

    if (profile) {
        userCompanyId = profile.empresa_id;
        document.getElementById('user-display-name').innerText = profile.full_name;
        document.getElementById('company-name').innerText = `Servicios: ${profile.companies?.name || 'SAMANDTECH'}`;
        
        const initialsEl = document.getElementById('user-initials');
        if (initialsEl) {
            const parts = profile.full_name.trim().split(' ');
            initialsEl.innerText = parts.length > 1 
                ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase() 
                : parts[0][0].toUpperCase();
        }
    }

    // 3. Obtener el ID de la raíz "Servicios Especializados"
    const { data: rootCategory } = await supabase
        .from('components')
        .select('id')
        .eq('name', 'Servicios Especializados')
        .single();
    
    if (rootCategory) {
        rootServiceId = rootCategory.id;
        currentParentId = rootServiceId;
        await loadServices(rootServiceId);
    } else {
        console.error("No se encontró la categoría raíz de servicios. Verifica el SQL.");
    }
    
    setupEventListeners();
}

// --- CARGAR SERVICIOS ---
async function loadServices(parentId) {
    const grid = document.getElementById('services-grid');
    const titleEl = document.getElementById('service-title');
    const subtitleEl = document.getElementById('service-subtitle');
    
    grid.innerHTML = '<div class="loading-spinner">Cargando servicios disponibles...</div>';

    // Buscamos hijos del parentId actual
    const { data: items, error } = await supabase
        .from('components')
        .select('*')
        .eq('parent_id', parentId)
        .order('name');

    if (error) {
        grid.innerHTML = '<p>Error al conectar con la base de datos.</p>';
        return;
    }

    // SI NO HAY HIJOS: Es un servicio final, abrimos el modal
    if ((!items || items.length === 0) && parentId !== rootServiceId) {
        openServiceModal(parentId);
        // Retrocedemos en la lógica para no dejar la pantalla vacía
        currentParentId = serviceHistory.pop();
        await loadServices(currentParentId);
        return;
    }

    // Actualizar Títulos de la UI
    if (parentId === rootServiceId) {
        titleEl.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> ¿En qué podemos ayudarte?';
        subtitleEl.innerText = 'Selecciona una línea de servicio especializado.';
        document.getElementById('btn-back-services').style.display = 'none';
    } else {
        const { data: parentInfo } = await supabase.from('components').select('name').eq('id', parentId).single();
        titleEl.innerHTML = `<i class="fa-solid fa-gears"></i> ${parentInfo?.name || 'Servicios'}`;
        subtitleEl.innerText = 'Elige el servicio específico que requieres.';
        document.getElementById('btn-back-services').style.display = 'block';
    }

    renderGrid(items);
}

// --- RENDERIZAR CUADRÍCULA ---
function renderGrid(items) {
    const grid = document.getElementById('services-grid');
    grid.innerHTML = items.map(item => `
        <div class="grid-item" data-id="${item.id}" data-name="${item.name}">
            <i class="${item.icon_class || 'fa-solid fa-screwdriver-wrench'}"></i>
            <span>${item.name}</span>
        </div>
    `).join('');

    // Eventos de clic en cada recuadro
    document.querySelectorAll('.grid-item').forEach(el => {
        el.onclick = () => {
            const id = el.dataset.id;
            serviceHistory.push(currentParentId); // Guardamos historial para "Volver"
            currentParentId = id;
            loadServices(id);
        };
    });
}

// --- MODAL DE SOLICITUD ---
async function openServiceModal(serviceId) {
    const { data: service } = await supabase.from('components').select('name').eq('id', serviceId).single();
    if (!service) return;

    document.getElementById('selected-service-name').innerText = service.name;
    document.getElementById('service-modal').classList.add('active');
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    const modal = document.getElementById('service-modal');
    const backBtn = document.getElementById('btn-back-services');
    const serviceForm = document.getElementById('service-request-form');

    // Botón Volver
    backBtn.onclick = () => {
        if (serviceHistory.length > 0) {
            currentParentId = serviceHistory.pop();
            loadServices(currentParentId);
        }
    };

    // Cerrar Modal
    document.getElementById('close-service-modal').onclick = () => modal.classList.remove('active');
    document.getElementById('cancel-service').onclick = () => modal.classList.remove('active');

    // Enviar Formulario (Crea un Ticket)
    if (serviceForm) {
        serviceForm.onsubmit = async (e) => {
            e.preventDefault();
            const serviceName = document.getElementById('selected-service-name').innerText;
            const notes = document.getElementById('service-notes').value;

            const { error } = await supabase.from('tickets').insert([{
                client_id: userCompanyId,
                subject: `SOLICITUD DE SERVICIO: ${serviceName}`,
                description: `Detalles del requerimiento:\n${notes}`,
                ticket_type: 'incidence', // Puedes cambiarlo a 'service' si añades ese tipo en SQL
                status: 'open',
                priority: 'medium'
            }]);

            if (!error) {
                alert("🚀 ¡Solicitud enviada con éxito! Nos comunicaremos pronto.");
                serviceForm.reset();
                modal.classList.remove('active');
            } else {
                alert("Hubo un error al procesar la solicitud. Intenta de nuevo.");
                console.error(error);
            }
        };
    }

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../login.html';
    });
}

init();