import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 1. Recibimos el texto y el TIPO (tech o rec)
    const { text, type } = await req.json()
    const apiKey = Deno.env.get('GROQ_API_KEY')

    // 2. Definimos el Prompt según el botón que presionó Alan
    let systemRole = "Eres un experto senior en infraestructura tecnológica de SAMANDTECH.";
    let taskInstructions = "";

    if (type === 'tech') {
      taskInstructions = `Optimiza esta DESCRIPCIÓN TÉCNICA. 
      Usa un tono profesional, técnico y conciso. 
      Habla de acciones realizadas (ej: "Se ejecutó", "Se verificó"). 
      Elimina muletillas y errores ortográficos.`;
    } else {
      taskInstructions = `Optimiza estas RECOMENDACIONES para el cliente. 
      Usa un tono consultivo, preventivo y persuasivo. 
      Explica el beneficio de seguir la sugerencia. 
      Usa un lenguaje que el cliente entienda pero que suene profesional.`;
    }

    // 3. Llamada a Groq
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: `${systemRole} ${taskInstructions} Responde ÚNICAMENTE con el texto optimizado, sin introducciones ni comentarios adicionales.` },
          { role: 'user', content: `Texto original: ${text}` }
        ],
        temperature: 0.3, // Mantenerlo serio y no tan creativo
        max_tokens: 200
      }),
    })

    const groqData = await response.json()
    const polishedText = groqData.choices[0].message.content.trim()

    // 4. Devolvemos el resultado limpio
    return new Response(JSON.stringify({ polishedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})