import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    // IMPORTANTE: Esto imprimirá en los Logs de Supabase qué está llegando
    console.log("PAYLOAD RECIBIDO:", JSON.stringify(body))

    const { id, email, password, full_name, role, empresa_id } = body

    // REGLA DE ORO: Si el ID existe y no es una cadena vacía, ACTUALIZAMOS
    const isUpdate = (id && id.trim() !== "");

    if (isUpdate) {
      console.log("MODO: ACTUALIZACIÓN de ID:", id)
      
      const updateData: any = {
        email: email,
        user_metadata: { 
          full_name, 
          role, 
          empresa_id: (empresa_id && empresa_id.length > 10) ? empresa_id : null 
        }
      }
      
      if (password && password.length >= 6) {
        updateData.password = password
      }

      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, updateData)
      if (error) throw error

      return new Response(JSON.stringify({ message: "Usuario actualizado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200
      })

    } else {
      console.log("MODO: CREACIÓN NUEVA")
      
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { 
          full_name, 
          role, 
          empresa_id: (empresa_id && empresa_id.length > 10) ? empresa_id : null 
        }
      })
      if (error) throw error

      return new Response(JSON.stringify({ message: "Usuario creado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200
      })
    }

  } catch (error: any) {
    console.error("ERROR DETECTADO:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400
    })
  }
})