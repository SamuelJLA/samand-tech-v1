import supabase from '../supabase.js';

let currentUserId = null;

async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '../login.html'; return; }
    currentUserId = user.id;

    // Carga de datos sin logs en consola
    const { data: profile } = await supabase
        .from('profiles')
        .select('*, companies(*)')
        .eq('id', user.id)
        .single();
    
    if (profile) {
        document.getElementById('contact-name').value = profile.full_name;
        document.getElementById('contact-phone').value = profile.phone || '';
        document.getElementById('user-display-name').innerText = profile.full_name;
        document.getElementById('email-display').innerText = user.email;
        
        // Manejo de Avatar
        const initials = profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0,2);
        const avatarImg = document.getElementById('avatar-img');
        const avatarInit = document.getElementById('avatar-initials');
        const topAvatar = document.getElementById('top-avatar');

        if (profile.avatar_url) {
            avatarImg.src = profile.avatar_url;
            avatarImg.style.display = 'block';
            avatarInit.style.display = 'none';
            topAvatar.innerHTML = `<img src="${profile.avatar_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        } else {
            avatarInit.innerText = initials;
            topAvatar.innerText = initials;
        }

        // --- INFO EMPRESA ---
        if (profile.companies) {
            // Usamos .innerText porque ahora son <span>, no <input>
            const companyNameEl = document.getElementById('company-name-view');
            const companyRifEl = document.getElementById('company-rif-view');
            const planBadge = document.getElementById('service-plan-badge');

            if (companyNameEl) companyNameEl.innerText = profile.companies.name;
            if (companyRifEl) companyRifEl.innerText = profile.companies.rif || 'J-PENDIENTE';
            if (planBadge) planBadge.innerText = (profile.companies.plan_type || 'Básico').toUpperCase();
        }
    }
    setupEventListeners();
}

function setupEventListeners() {
    // Foto de Perfil
    const container = document.getElementById('avatar-container');
    const input = document.getElementById('avatar-input');
    if (container) container.onclick = () => input.click();

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const fileName = `${currentUserId}-${Math.random().toString(36).substring(7)}`;
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(`user-avatars/${fileName}`, file);

        if (uploadError) return alert("Error al subir foto");

        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(`user-avatars/${fileName}`);
        await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', currentUserId);
        window.location.reload();
    };

    // Actualizar Datos
    document.getElementById('update-profile-form').onsubmit = async (e) => {
        e.preventDefault();
        const { error } = await supabase.from('profiles').update({
            full_name: document.getElementById('contact-name').value,
            phone: document.getElementById('contact-phone').value
        }).eq('id', currentUserId);
        
        if (!error) alert("✅ Cambios guardados.");
    };

    // Password
    document.getElementById('update-password-form').onsubmit = async (e) => {
        e.preventDefault();
        const p1 = document.getElementById('new-password').value;
        const p2 = document.getElementById('confirm-password').value;
        if (p1 !== p2) return alert("Las contraseñas no coinciden");
        
        const { error } = await supabase.auth.updateUser({ password: p1 });
        if (!error) { alert("✅ Seguridad actualizada."); e.target.reset(); }
    };

    // Modal Notificaciones
    const modal = document.getElementById('notifications-modal');
    document.getElementById('open-notifications-btn').onclick = () => modal.classList.add('active');
    document.getElementById('close-notifications-modal').onclick = () => modal.classList.remove('active');
    document.getElementById('cancel-notifications').onclick = () => modal.classList.remove('active');

    document.getElementById('logout-btn').onclick = async () => {
        await supabase.auth.signOut();
        window.location.href = '../login.html';
    };
}

init();