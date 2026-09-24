// assets/js/access-control.js
import supabase from './supabase.js';

export async function protectRoute(requiredRole) {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    // Detectamos si la página actual está en una subcarpeta (ej: /portal-tech/)
    const isSubFolder = window.location.pathname.includes('/portal-tech/') || 
                        window.location.pathname.includes('/portal-cliente/');
    
    const loginPath = isSubFolder ? '../login.html' : './login.html';
    const unauthorizedPath = isSubFolder ? '../unauthorized.html' : './unauthorized.html';

    if (error || !user) {
        localStorage.clear();
        window.location.href = loginPath;
        return null;
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (!profile || (profile.role !== requiredRole && profile.role !== 'admin')) {
        // Si no tiene el rol ni es admin
        window.location.href = unauthorizedPath; 
        return null;
    }
    
    return user;
}
