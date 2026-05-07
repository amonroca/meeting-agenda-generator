import { createClient } from 'npm:@supabase/supabase-js@2'

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

Deno.serve(async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseServiceKey) {
        return jsonResponse({ error: 'Variáveis de ambiente do Supabase não configuradas.' }, 500)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let payload: { organizationId: string; cardId: string; minuteId: string }
    try {
        payload = await request.json()
    } catch {
        return jsonResponse({ error: 'Body inválido.' }, 400)
    }

    const { organizationId, cardId, minuteId } = payload
    if (!organizationId || !cardId || !minuteId) {
        return jsonResponse({ error: 'organizationId, cardId e minuteId são obrigatórios.' }, 400)
    }

    const { data: orgSettings } = await supabase
        .from('organization_settings')
        .select('trello_api_key, trello_token')
        .eq('organization_id', organizationId)
        .maybeSingle()

    const trelloApiKey: string | undefined = orgSettings?.trello_api_key
    const trelloToken: string | undefined = orgSettings?.trello_token

    if (!trelloApiKey || !trelloToken) {
        return jsonResponse({ error: 'Credenciais do Trello não configuradas.' }, 422)
    }

    // 1. Remove o card do Trello
    const url = new URL(`https://api.trello.com/1/cards/${cardId}`)
    url.searchParams.set('key', trelloApiKey)
    url.searchParams.set('token', trelloToken)

    const trelloResponse = await fetch(url.toString(), { method: 'DELETE' })
    if (!trelloResponse.ok) {
        const details = await trelloResponse.text()
        return jsonResponse({ error: `Falha ao remover card do Trello: ${details}` }, 502)
    }

    // 2. Remove o card do array trello_cards na ata
    const { data: minuteData } = await supabase
        .from('meeting_minutes')
        .select('id, trello_cards')
        .eq('id', minuteId)
        .eq('organization_id', organizationId)
        .maybeSingle()

    if (minuteData?.trello_cards) {
        const updatedCards = (minuteData.trello_cards as Array<Record<string, unknown>>).filter(
            (c) => c.id !== cardId,
        )
        await supabase
            .from('meeting_minutes')
            .update({ trello_cards: updatedCards })
            .eq('id', minuteId)
    }

    return jsonResponse({ success: true })
})
