import supabase from './supabase.js';

let allPedidos = []; 

async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = 'login.html'; return; }

    await fetchPedidos();
    setupTabs();
}

async function fetchPedidos() {
    const tbody = document.getElementById('pedidos-table-body');
    
    const { data, error } = await supabase
        .from('tickets')
        .select('*, companies(name)')
        .or('subject.ilike.Solicitud:%,subject.ilike.%SERVICIO:%') 
        .order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Error al conectar con la base de datos</td></tr>';
        return;
    }

    allPedidos = data;
    renderTable(allPedidos);
}

function renderTable(pedidos) {
    const tbody = document.getElementById('pedidos-table-body');
    
    if (pedidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">No hay solicitudes pendientes.</td></tr>';
        return;
    }

    tbody.innerHTML = pedidos.map(pedido => {
        const isHardware = pedido.subject.includes('Solicitud:');
        const tipoLabel = isHardware ? 'HARDWARE' : 'SERVICIO';
        const tipoClass = isHardware ? 'progress' : 'resolved'; 
        const icon = isHardware ? 'fa-microchip' : 'fa-wand-magic-sparkles';

        // Extraemos la cantidad del texto "Cantidad: X"
        const qtyMatch = pedido.description.match(/Cantidad:\s*(\d+)/);
        const cantidad = qtyMatch ? qtyMatch[1] : '1';

        // Limpiamos el texto para que se vea pro
        const detalle = pedido.subject.replace('Solicitud:', '').replace('SOLICITUD DE SERVICIO:', '').trim();

        return `
            <tr>
                <td><strong>${pedido.companies?.name || 'Empresa'}</strong></td>
                <td>
                    <span class="status-badge ${tipoClass}" style="display:flex; align-items:center; gap:5px; width:fit-content; font-size:10px;">
                        <i class="fa-solid ${icon}"></i> ${tipoLabel}
                    </span>
                </td>
                <td>
                    <div style="font-weight:600; color:#1e293b;">${detalle}</div>
                    <div style="font-size:12px; color:#64748b;">${pedido.description.split('\n').pop()}</div>
                </td>
                <td style="text-align:center; font-weight:bold;">${cantidad}</td>
                <td>${new Date(pedido.created_at).toLocaleDateString()}</td>
                <td><span class="status-badge ${pedido.status}">${pedido.status.toUpperCase()}</span></td>
                <td>
                    <button class="btn-action" title="Ver Detalle" onclick="window.location.href='index.html?id=${pedido.id}'">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="btn-action" title="Cotizar" style="color:#10b981;">
                        <i class="fa-solid fa-file-invoice-dollar"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function setupTabs() {
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        btn.onclick = () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.dataset.filter;
            if (filter === 'all') renderTable(allPedidos);
            else if (filter === 'hardware') renderTable(allPedidos.filter(p => p.subject.includes('Solicitud:')));
            else if (filter === 'service') renderTable(allPedidos.filter(p => p.subject.includes('SERVICIO:')));
        };
    });
}

init();