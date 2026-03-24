// Este archivo guarda las constantes y funciones de ayuda
export const labels = {
    priority: {
        low: 'Baja',
        medium: 'Media',
        high: 'Alta',
        critical: 'Crítica'
    },
    status: {
        open: 'Abierto',
        in_progress: 'En Proceso',
        resolved: 'Resuelto',
        pending: 'Pendiente',
        waiting_provider: 'Esperando Proveedor'
    },
    type: {
        incidence: 'Incidencia / Falla',
        maintenance: 'Mantenimiento'
    }
    
};

export function customConfirm(title, message) {
    return new Promise((resolve) => {
        const html = `
            <div id="custom-confirm" class="confirm-overlay" style="display: flex;">
                <div class="confirm-card">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <h3>${title}</h3>
                    <p>${message}</p>
                    <div class="confirm-buttons">
                        <button id="confirm-cancel" class="btn-secondary">Cancelar</button>
                        <button id="confirm-ok" class="btn-primary" style="background: #e11d48;">Eliminar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);

        document.getElementById('confirm-ok').onclick = () => {
            document.getElementById('custom-confirm').remove();
            resolve(true);
        };
        document.getElementById('confirm-cancel').onclick = () => {
            document.getElementById('custom-confirm').remove();
            resolve(false);
        };
    });
}