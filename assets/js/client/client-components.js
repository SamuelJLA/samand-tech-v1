import supabase from '../supabase.js';

let currentParentId = null;
let categoryHistory = []; // Para poder volver atrás
let userCompanyId = null;

async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '../login.html'; return; }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*, companies!empresa_id(name)')
        .eq('id', user.id)
        .single();

    if (profile) {
        userCompanyId = profile.empresa_id;
        document.getElementById('user-display-name').innerText = profile.full_name;
        document.getElementById('company-name').innerText = `Pedido: ${profile.companies?.name}`;
        
        const initialsEl = document.getElementById('user-initials');
        if (initialsEl) {
            const parts = profile.full_name.split(' ');
            initialsEl.innerText = parts.length > 1 ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase() : parts[0][0].toUpperCase();
        }
    }

    loadCategories(null);
    setupEventListeners();
}

// Carga las categorías o subcategorías
async function loadCategories(parentId) {
    const grid = document.getElementById('components-grid');
    const titleEl = document.getElementById('category-title');
    const subtitleEl = document.getElementById('category-subtitle');
    
    grid.innerHTML = '<div class="loading-spinner">Cargando catálogo...</div>';

    let query = supabase.from('components').select('*');
    
    if (!parentId) {
        // 🚀 CAMBIO AQUÍ: Estamos en la raíz, traemos todo EXCEPTO "Servicio Extra"
        query = query.is('parent_id', null).neq('name', 'Servicio Extra'); 
        
        document.getElementById('btn-back-categories').style.display = 'none';
        titleEl.innerHTML = '<i class="fa-solid fa-boxes-stacked"></i> Seleccione su producto';
        subtitleEl.innerText = 'Explora nuestras categorías principales de hardware.';
    } else {
        // Estamos dentro de una categoría (Aquí no filtramos nada)
        query = query.eq('parent_id', parentId);
        document.getElementById('btn-back-categories').style.display = 'block';
        
        const { data: parentData } = await supabase.from('components').select('name').eq('id', parentId).single();
        titleEl.innerHTML = `<i class="fa-solid fa-search"></i> Explorar ${parentData.name}`;
        subtitleEl.innerText = 'Selecciona el tipo específico de equipo que requieres.';
    }

    const { data: items, error } = await query.order('name');

    if (error) {
        grid.innerHTML = '<p>Error al cargar el catálogo.</p>';
        return;
    }

    // Si no hay hijos, significa que es un componente final (Hoja)
    if (items.length === 0 && parentId) {
        openOrderModal(parentId);
        // Volvemos a cargar la categoría anterior para que el grid no quede vacío
        const lastCategory = categoryHistory.pop();
        loadCategories(lastCategory);
        return;
    }

    renderGrid(items);
}

function renderGrid(items) {
    const grid = document.getElementById('components-grid');
    grid.innerHTML = items.map(item => `
        <div class="grid-item" data-id="${item.id}" data-name="${item.name}">
            <i class="${item.icon_class || 'fa-solid fa-microchip'}"></i>
            <span>${item.name}</span>
        </div>
    `).join('');

    // Eventos de clic
    document.querySelectorAll('.grid-item').forEach(el => {
        el.onclick = () => {
            const id = el.dataset.id;
            categoryHistory.push(currentParentId); // Guardamos donde estábamos
            currentParentId = id;
            loadCategories(id);
        };
    });
}

// Abrir el modal para pedir cantidad y notas
async function openOrderModal(componentId) {
    const { data: comp } = await supabase.from('components').select('name').eq('id', componentId).single();
    
    document.getElementById('selected-component-name').innerText = comp.name;
    document.getElementById('order-modal').classList.add('active');
}

function setupEventListeners() {
    const modal = document.getElementById('order-modal');
    const backBtn = document.getElementById('btn-back-categories');

    // Botón Volver
    backBtn.onclick = () => {
        currentParentId = categoryHistory.pop();
        loadCategories(currentParentId);
    };

    // Cerrar Modal
    document.getElementById('close-order-modal').onclick = () => modal.classList.remove('active');
    document.getElementById('cancel-order').onclick = () => modal.classList.remove('active');

    // Envío del pedido
    document.getElementById('component-order-form').onsubmit = async (e) => {
        e.preventDefault();
        
        const componentName = document.getElementById('selected-component-name').innerText;
        const qty = document.getElementById('order-qty').value;
        const notes = document.getElementById('order-notes').value;

        // Aquí creamos un ticket automático de tipo "Solicitud de Componente"
        const { error } = await supabase.from('tickets').insert([{
            client_id: userCompanyId,
            subject: `Solicitud: ${componentName}`,
            description: `Cantidad: ${qty}\nNotas: ${notes}`,
            ticket_type: 'incidence', // O puedes crear un tipo nuevo 'purchase'
            status: 'open',
            priority: 'medium'
        }]);

        if (!error) {
            alert("✅ Solicitud enviada. Un técnico se pondrá en contacto pronto.");
            modal.classList.remove('active');
        } else {
            alert("Error al enviar la solicitud.");
        }
    };

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../login.html';
    });
}

init();