import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { text, type } = await req.json()
    const apiKey = Deno.env.get('GROQ_API_KEY')

    // 🎯 NUEVAS INSTRUCCIONES ESTILO SAMANDTECH
    const systemInstructions = `
      Eres un editor técnico senior de SAMANDTECH. Tu misión es profesionalizar reportes de IT.
      
      REGLAS CRÍTICAS:
      1. PRESERVAR DETALLES: No elimines nombres de hardware (impresora, PC, router), software ni causas técnicas (picos de voltaje, saturación).
      2. TONO: Profesional, técnico y en tercera persona.
      3. NO ALUCINAR: No inventes acciones que el usuario no mencionó (como actualizaciones o tests).
      4. CONCISIÓN: Elimina palabras innecesarias pero MANTÉN la información técnica completa.
      
      EJEMPLO TÉCNICO:
      - Entrada: "Reinicie la impresora porque se pego por la luz"
      - Salida: "Se realizó el reinicio de la impresora debido a un bloqueo por fluctuación eléctrica."
      
      EJEMPLO RECOMENDACIÓN:
      - Entrada: "Comprar UPS para que la impresora no se pegue por los picos"
      - Salida: "Se recomienda instalar una UPS para proteger la impresora contra picos de voltaje y evitar bloqueos del sistema."
    `;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemInstructions },
          { role: 'user', content: `Profesionaliza este texto para el campo de ${type === 'tech' ? 'Descripción Técnica' : 'Recomendaciones'}: ${text}` }
        ],
        temperature: 0.1, // Un poquito más de margen para que no sea tan robótica
        max_tokens: 150
      }),
    })

    const groqData = await response.json()
    const polishedText = groqData.choices[0].message.content.trim();

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