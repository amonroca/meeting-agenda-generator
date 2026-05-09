import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

const BUCKET = 'audio-transcriptions'

interface RecognizedPhrase {
    speaker?: number
    nBest?: Array<{ display: string }>
}

interface ResultFile {
    kind: string
    links: { contentUrl: string }
}

function formatTranscriptWithDiarization(phrases: RecognizedPhrase[]): string {
    if (!phrases?.length) return ''

    const lines: string[] = []
    let currentSpeaker: number | null = null
    let currentChunks: string[] = []

    function flush() {
        if (!currentChunks.length) return
        const label = currentSpeaker != null ? `Palestrante ${currentSpeaker}` : 'Desconhecido'
        lines.push(`${label}: ${currentChunks.join(' ')}`)
        currentChunks = []
    }

    for (const phrase of phrases) {
        const text = phrase.nBest?.[0]?.display?.trim()
        if (!text) continue
        const speaker = phrase.speaker ?? null

        if (speaker !== currentSpeaker) {
            flush()
            currentSpeaker = speaker
        }
        currentChunks.push(text)
    }
    flush()

    return lines.join('\n')
}

Deno.serve(async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const speechKey = Deno.env.get('AZURE_SPEECH_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!speechKey) return jsonResponse({ error: 'AZURE_SPEECH_KEY não configurada.' }, 500)
    if (!supabaseUrl || !supabaseServiceKey) return jsonResponse({ error: 'Variáveis Supabase não configuradas.' }, 500)

    let body: { jobUrl: string; storagePath: string }
    try {
        body = await request.json()
    } catch {
        return jsonResponse({ error: 'Body inválido.' }, 400)
    }

    const { jobUrl, storagePath } = body
    if (!jobUrl || !storagePath) return jsonResponse({ error: 'jobUrl e storagePath são obrigatórios.' }, 400)

    // Consulta status do job no Azure
    const statusResponse = await fetch(jobUrl, {
        headers: { 'Ocp-Apim-Subscription-Key': speechKey },
    })

    if (!statusResponse.ok) {
        const details = await statusResponse.text()
        return jsonResponse({ error: `Falha ao consultar status do job: ${details}` }, 502)
    }

    const job = await statusResponse.json()
    const status: string = job.status // NotStarted | Running | Succeeded | Failed

    if (status === 'NotStarted' || status === 'Running') {
        return jsonResponse({ status: 'running' })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (status === 'Failed') {
        // Limpa Storage e job antes de retornar erro
        await supabase.storage.from(BUCKET).remove([storagePath])
        await fetch(jobUrl, { method: 'DELETE', headers: { 'Ocp-Apim-Subscription-Key': speechKey } })
        const reason = job.properties?.error?.message || 'Falha desconhecida na transcrição.'
        return jsonResponse({ status: 'failed', error: reason })
    }

    // Succeeded — busca lista de arquivos de resultado ANTES de apagar o job
    const filesResponse = await fetch(`${jobUrl}/files`, {
        headers: { 'Ocp-Apim-Subscription-Key': speechKey },
    })

    if (!filesResponse.ok) {
        await supabase.storage.from(BUCKET).remove([storagePath])
        await fetch(jobUrl, { method: 'DELETE', headers: { 'Ocp-Apim-Subscription-Key': speechKey } })
        return jsonResponse({ status: 'failed', error: 'Falha ao obter arquivos do resultado.' })
    }

    const filesData = await filesResponse.json()
    const transcriptionFile = (filesData.values as ResultFile[])
        ?.find((f) => f.kind === 'Transcription')

    if (!transcriptionFile) {
        await supabase.storage.from(BUCKET).remove([storagePath])
        await fetch(jobUrl, { method: 'DELETE', headers: { 'Ocp-Apim-Subscription-Key': speechKey } })
        return jsonResponse({ status: 'failed', error: 'Arquivo de transcrição não encontrado no resultado.' })
    }

    const resultResponse = await fetch(transcriptionFile.links.contentUrl)
    if (!resultResponse.ok) {
        await supabase.storage.from(BUCKET).remove([storagePath])
        await fetch(jobUrl, { method: 'DELETE', headers: { 'Ocp-Apim-Subscription-Key': speechKey } })
        return jsonResponse({ status: 'failed', error: 'Falha ao baixar o resultado da transcrição.' })
    }

    const result = await resultResponse.json()
    const transcript = formatTranscriptWithDiarization(result.recognizedPhrases || [])

    // Limpeza após obter o resultado com sucesso
    await supabase.storage.from(BUCKET).remove([storagePath])
    await fetch(jobUrl, { method: 'DELETE', headers: { 'Ocp-Apim-Subscription-Key': speechKey } })

    if (!transcript) {
        return jsonResponse({ status: 'failed', error: 'A transcrição retornou vazia.' })
    }

    return jsonResponse({ status: 'succeeded', transcript })
})
