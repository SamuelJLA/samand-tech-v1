// assets/js/access-control.js
import supabase from './supabase.js';

export async function protectRoute(requiredRole) {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        window.location.href = '/login.html';
        return;
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile.role !== requiredRole && profile.role !== 'admin') {
        // Si no es el rol requerido ni es admin, ¡pa' fuera!
        window.location.href = '/unauthorized.html'; 
    }
    
    return user;
}