import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Responder al navegador rápido (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
  }

  try {
    // 2. Leer los datos que vienen del dashboard
    const body = await req.json()
    const notes = body.notes || "Sin notas"
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    if (!apiKey) throw new Error("No hay API Key en secretos")

    // 3. Llamada a Google (Desde el servidor en EE.UU.)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Como experto en TI de SAMAND TECH, sugiere 3 recomendaciones cortas para: ${notes}` }] }]
      })
    })

    const data = await response.json()
    
    if (data.error) throw new Error(data.error.message)

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo generar el texto."

    return new Response(JSON.stringify({ text: aiText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Mandamos 200 aunque sea error para que el JS no se bloquee
    })
  }
})