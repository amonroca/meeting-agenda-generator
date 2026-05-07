const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}

const MAX_FILE_SIZE = 200 * 1024 * 1024 // 200 MB (limite da API de transcrição rápida do Azure)
const SPEECH_API_VERSION = '2024-11-15'

Deno.serve(async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const speechKey = Deno.env.get('AZURE_SPEECH_KEY')
    const speechEndpoint = Deno.env.get('AZURE_SPEECH_ENDPOINT')

    if (!speechKey || !speechEndpoint) {
        return jsonResponse({ error: 'AZURE_SPEECH_KEY e AZURE_SPEECH_ENDPOINT são obrigatórias.' }, 500)
    }

    let formData: FormData
    try {
        formData = await request.formData()
    } catch {
        return jsonResponse({ error: 'Body inválido. Envie multipart/form-data com o campo "audio".' }, 400)
    }

    const audioFile = formData.get('audio') as File | null
    if (!audioFile || typeof audioFile === 'string') {
        return jsonResponse({ error: 'Campo "audio" ausente ou inválido.' }, 400)
    }

    if (audioFile.size > MAX_FILE_SIZE) {
        return jsonResponse({
            error: `Arquivo muito grande. O limite é 200 MB (arquivo enviado: ${(audioFile.size / 1024 / 1024).toFixed(1)} MB).`,
        }, 400)
    }

    const speechForm = new FormData()
    speechForm.append('audio', audioFile, audioFile.name || 'audio.mp3')
    speechForm.append('definition', JSON.stringify({
        locales: ['pt-BR'],
        profanityFilterMode: 'None',
    }))

    const url = `${speechEndpoint.replace(/\/$/, '')}/speechtotext/transcriptions:transcribe?api-version=${SPEECH_API_VERSION}`

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Ocp-Apim-Subscription-Key': speechKey },
        body: speechForm,
    })

    if (!response.ok) {
        const details = await response.text()
        return jsonResponse({ error: `Falha na transcrição: ${details}` }, 502)
    }

    const result = await response.json()

    // A API retorna combinedPhrases com o texto completo por canal
    const combinedPhrases: Array<{ text: string }> = result.combinedPhrases || []
    const transcript = combinedPhrases.map((p) => p.text).join('\n').trim()

    if (!transcript) {
        return jsonResponse({ error: 'A transcrição retornou vazia.' }, 422)
    }

    return jsonResponse({ transcript })
})
