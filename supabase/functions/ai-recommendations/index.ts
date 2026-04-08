// supabase/functions/ai-recommendations/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de CORS (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt } = await req.json()
    const apiKey = Deno.env.get('GROQ_API_KEY')

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { 
            role: 'system', 
            content: 'Eres un experto técnico de SAMANDTECH. Optimiza reportes de IT. Responde ESTRICTAMENTE en JSON con dos llaves: "desc_mejorada" y "recom_mejorada". No añadas texto extra fuera del JSON.' 
          },
          { role: 'user', content: `Optimiza este reporte: ${prompt}` }
        ],
        response_format: { type: 'json_object' }
      }),
    })

    const groqData = await response.json()
    
    // 🚀 AQUÍ ESTÁ EL TRUCO: Extraemos solo el contenido del mensaje
    const aiContent = groqData.choices[0].message.content
    
    // Parseamos el string que envía la IA para enviarlo como un objeto JSON real al frontend
    const cleanedResult = JSON.parse(aiContent)

    return new Response(JSON.stringify(cleanedResult), {
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