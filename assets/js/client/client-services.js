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

    // 🚀 3. CAMBIO CLAVE: Ahora buscamos el ID de "Servicio Extra"
    const { data: rootCategory } = await supabase
        .from('components')
        .select('id')
        .eq('name', 'Servicio Extra') // <-- Antes decía "Servicios Especializados"
        .single();
    
    if (rootCategory) {
        rootServiceId = rootCategory.id;
        currentParentId = rootServiceId;
        await loadServices(rootServiceId);
    } else {
        // Si no lo encuentra, mostramos un error claro en consola para debuguear
        console.error("❌ No se encontró la categoría raíz 'Servicio Extra'. Verifica que exista en la tabla 'components'.");
        const grid = document.getElementById('services-grid');
        grid.innerHTML = '<p style="color:white; text-align:center;">Configurando servicios... Si el problema persiste, contacta a soporte.</p>';
    }
    
    setupEventListeners();
}

// --- CARGAR SERVICIOS ---
async function loadServices(parentId) {
    const grid = document.getElementById('services-grid');
    const titleEl = document.getElementById('service-title');
    const subtitleEl = document.getElementById('service-subtitle');
    
    grid.innerHTML = '<div class="loading-spinner">Cargando servicios disponibles...</div>';

    const { data: items, error } = await supabase
        .from('components')
        .select('*')
        .eq('parent_id', parentId)
        .order('name');

    if (error) {
        grid.innerHTML = '<p>Error al conectar con la base de datos.</p>';
        return;
    }

    // SI NO HAY HIJOS: Es un servicio final (ej. "Instalación de Cámaras"), abrimos el modal
    if ((!items || items.length === 0) && parentId !== rootServiceId) {
        openServiceModal(parentId);
        currentParentId = serviceHistory.pop();
        await loadServices(currentParentId);
        return;
    }

    // 🚀 Actualizar Títulos según el nivel donde estemos
    if (parentId === rootServiceId) {
        titleEl.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Servicio Extra';
        subtitleEl.innerText = 'Selecciona una de nuestras soluciones especializadas.';
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
    
    if (!items || items.length === 0) {
        grid.innerHTML = '<p style="color: #94a3b8; text-align: center; width: 100%;">Próximamente más servicios en esta categoría.</p>';
        return;
    }

    grid.innerHTML = items.map(item => `
        <div class="grid-item" data-id="${item.id}" data-name="${item.name}">
            <i class="${item.icon_class || 'fa-solid fa-screwdriver-wrench'}"></i>
            <span>${item.name}</span>
        </div>
    `).join('');

    document.querySelectorAll('.grid-item').forEach(el => {
        el.onclick = () => {
            const id = el.dataset.id;
            serviceHistory.push(currentParentId); 
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

    backBtn.onclick = () => {
        if (serviceHistory.length > 0) {
            currentParentId = serviceHistory.pop();
            loadServices(currentParentId);
        }
    };

    document.getElementById('close-service-modal').onclick = () => modal.classList.remove('active');
    document.getElementById('cancel-service').onclick = () => modal.classList.remove('active');

    if (serviceForm) {
        serviceForm.onsubmit = async (e) => {
            e.preventDefault();
            const serviceName = document.getElementById('selected-service-name').innerText;
            const notes = document.getElementById('service-notes').value;

            const { error } = await supabase.from('tickets').insert([{
                client_id: userCompanyId,
                subject: `SOLICITUD DE SERVICIO EXTRA: ${serviceName}`,
                description: `Detalles del requerimiento:\n${notes}`,
                ticket_type: 'incidence', 
                status: 'open',
                priority: 'medium'
            }]);

            if (!error) {
                alert("🚀 ¡Solicitud enviada con éxito! Nos comunicaremos pronto.");
                serviceForm.reset();
                modal.classList.remove('active');
            } else {
                alert("Hubo un error al procesar la solicitud.");
                console.error(error);
            }
        };
    }

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../login.html';
    });
}

init();