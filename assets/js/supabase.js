import CONFIG from '../../config.js';

// Creamos la conexión oficial
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

export default supabaseClient;