const { data, error } = await supabase
    .from('tickets')
    .select('*, companies(name), profiles(full_name)')
    .eq('status', 'resolved') // FILTRO CLAVE: Solo lo cerrado
    .order('created_at', { ascending: false });