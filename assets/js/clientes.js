import supabase from './supabase.js';

// 1. REFERENCIAS DEL DOM
const companyListBody = document.getElementById('company-list-body');
const companyModal = document.getElementById('company-modal');
const viewCompanyModal = document.getElementById('view-company-modal');
const newCompanyForm = document.getElementById('new-company-form');
const btnOpenAdd = document.getElementById('btn-open-company-modal');
const toastContainer = document.getElementById('toast-container');

// Variables para manejar datos localmente
let allCompanies = [];
let editingCompanyId = null;

// ============================================================
// LÓGICA DE MODALES
// ============================================================

const closeAllModals = () => {
    companyModal.style.display = 'none';
    viewCompanyModal.style.display = 'none';

    if (newCompanyForm) newCompanyForm.reset();
    editingCompanyId = null;

    // Ocultamos el botón de eliminar al cerrar
    const btnDelete = document.getElementById('btn-delete-company');
    if (btnDelete) btnDelete.style.display = 'none';
    
    // Resetear textos del modal
    const modalTitle = document.querySelector('#company-modal h2');
    const saveBtn = document.getElementById('save-company-btn');
    
    if (modalTitle) modalTitle.innerText = "Registrar Nueva Empresa";
    if (saveBtn) saveBtn.innerText = "Guardar Empresa";
};

if(btnOpenAdd) btnOpenAdd.addEventListener('click', () => {
    editingCompanyId = null; // Aseguramos que es modo "Crear"
    companyModal.style.display = 'flex';
});

document.querySelectorAll('#close-company-modal, #cancel-company-btn, .close-info-modal').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
});

window.addEventListener('click', (e) => {
    if (e.target === companyModal || e.target === viewCompanyModal) closeAllModals();
});

// ============================================================
// FUNCIÓN TOAST
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
// OPERACIONES CON SUPABASE
// ============================================================

async function fetchCompanies() {
    const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error("Error:", error.message);
    } else {
        allCompanies = data;
        renderCompanies(data);
    }
}

function renderCompanies(companies) {
    if (!companyListBody) return;
    companyListBody.innerHTML = '';
    companies.forEach(company => {
        let planClass = 'badge-bronce';
        if (company.plan === 'Plata') planClass = 'badge-plata';
        if (company.plan === 'Oro') planClass = 'badge-oro';
        if (company.plan === 'Premium') planClass = 'badge-premium';

        const row = `
            <tr data-id="${company.id}">
                <td><strong>${company.name}</strong></td>
                <td>${company.rif || 'N/A'}</td>
                <td>${company.contact_person || 'N/A'}</td>
                <td>${company.contact_phone || 'N/A'}</td>
                <td><span class="plan-badge ${planClass}">${company.plan || 'Bronce'}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon view-btn" title="Ver Ficha"><i class="fa-solid fa-eye"></i></button>
                        <button class="btn-icon edit-btn" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    </div>
                </td>
            </tr>
        `;
        companyListBody.insertAdjacentHTML('beforeend', row);
    });
    const totalEl = document.getElementById('total-companies');
    if (totalEl) totalEl.innerText = companies.length;
}

// GUARDAR / ACTUALIZAR
newCompanyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('save-company-btn');
    const originalText = btn.innerText;
    btn.innerText = "Procesando...";
    btn.disabled = true;

    const companyData = {
        name: document.getElementById('company-name').value,
        rif: document.getElementById('company-rif').value,
        contact_person: document.getElementById('company-contact').value,
        plan: document.getElementById('company-plan').value,
        contact_phone: document.getElementById('company-phone').value,
        contact_email: document.getElementById('company-email').value,
        address: document.getElementById('company-address').value
    };

    let result;
    if (editingCompanyId) {
        result = await supabase.from('companies').update(companyData).eq('id', editingCompanyId);
    } else {
        result = await supabase.from('companies').insert([companyData]);
    }

    if (result.error) {
        alert("❌ Error: " + result.error.message);
    } else {
        const msg = editingCompanyId ? "actualizada" : "registrada";
        showToast(`🏢 ${companyData.name} ${msg} con éxito.`);
        closeAllModals();
        fetchCompanies();
    }

    btn.innerText = originalText;
    btn.disabled = false;
});

// INTERACCIONES DE LA TABLA (OJO Y LÁPIZ)
companyListBody.addEventListener('click', (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    const companyId = row.dataset.id;
    const company = allCompanies.find(c => c.id === companyId);

    // 1. LÓGICA DEL OJO (Visualizar)
    if (e.target.closest('.view-btn')) {
        if (company) {
            document.getElementById('info-name').innerText = company.name;
            document.getElementById('info-rif-top').innerText = company.rif || 'N/A';
            document.getElementById('info-rif').innerText = company.rif || '---';
            document.getElementById('info-plan').innerText = company.plan || 'Bronce';
            document.getElementById('info-contact').innerText = company.contact_person || '---';
            document.getElementById('info-phone').innerText = company.contact_phone || '---';
            document.getElementById('info-email').innerText = company.contact_email || '---';
            document.getElementById('info-address').innerText = company.address || '---';
            viewCompanyModal.style.display = 'flex';
        }
    }
    
    // 2. LÓGICA DEL LÁPIZ (Editar)
    if (e.target.closest('.edit-btn')) {
        if (company) {
            editingCompanyId = companyId;

            // MOSTRAR BOTÓN ELIMINAR
            const btnDelete = document.getElementById('btn-delete-company');
            if (btnDelete) btnDelete.style.display = 'block';
            
            // Cambiar textos del modal
            document.querySelector('#company-modal h2').innerText = `Editar Empresa: ${company.name}`;
            document.getElementById('save-company-btn').innerText = "Guardar Cambios";

            // Función segura para llenar campos
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val || '';
                else console.warn(`⚠️ Ojo Samuel: No encontré el ID "${id}" en el HTML.`);
            };

            setVal('company-name', company.name);
            setVal('company-rif', company.rif);
            setVal('company-contact', company.contact_person);
            setVal('company-plan', company.plan);
            setVal('company-phone', company.contact_phone);
            setVal('company-email', company.contact_email);
            setVal('company-address', company.address);

            companyModal.style.display = 'flex';
        }
    }
});

fetchCompanies();

// ============================================================
// ELIMINAR EMPRESA
// ============================================================
const btnDeleteCompany = document.getElementById('btn-delete-company');

if (btnDeleteCompany) {
    btnDeleteCompany.addEventListener('click', async () => {
        if (!editingCompanyId) return;

        const companyName = document.getElementById('company-name').value;
        
        const confirmar = confirm(`⚠️ Samuel, ¿estás seguro de eliminar a "${companyName}"? \n\nEsto podría afectar los tickets asociados a esta empresa.`);

        if (confirmar) {
            const { error } = await supabase
                .from('companies')
                .delete()
                .eq('id', editingCompanyId);

            if (error) {
                alert("❌ No se pudo eliminar: " + error.message);
            } else {
                showToast(`🗑️ Empresa "${companyName}" eliminada.`);
                closeAllModals();
                fetchCompanies(); // Recargar la tabla
            }
        }
    });
}