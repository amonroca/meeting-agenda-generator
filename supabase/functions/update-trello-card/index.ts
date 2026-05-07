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

    let payload: {
        organizationId: string
        cardId: string
        minuteId?: string
        name?: string
        responsible?: string
        desc?: string
        idList?: string
    }
    try {
        payload = await request.json()
    } catch {
        return jsonResponse({ error: 'Body inválido.' }, 400)
    }

    const { organizationId, cardId, minuteId, name, responsible, desc, idList } = payload
    if (!organizationId || !cardId) {
        return jsonResponse({ error: 'organizationId e cardId são obrigatórios.' }, 400)
    }

    if (name === undefined && responsible === undefined && desc === undefined && idList === undefined) {
        return jsonResponse({ error: 'Nenhum campo para atualizar foi enviado.' }, 400)
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

    const url = new URL(`https://api.trello.com/1/cards/${cardId}`)
    url.searchParams.set('key', trelloApiKey)
    url.searchParams.set('token', trelloToken)

    const body: Record<string, string> = {}
    if (name !== undefined) body.name = name
    if (desc !== undefined) body.desc = desc
    if (idList !== undefined) body.idList = idList

    const response = await fetch(url.toString(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })

    if (!response.ok) {
        const details = await response.text()
        return jsonResponse({ error: `Falha ao atualizar card no Trello: ${details}` }, 502)
    }

    const card = await response.json()

    // Atualiza trello_cards no banco com os campos editáveis
    if (minuteId && (name !== undefined || responsible !== undefined)) {
        const { data: minuteData } = await supabase
            .from('meeting_minutes')
            .select('id, trello_cards')
            .eq('id', minuteId)
            .eq('organization_id', organizationId)
            .maybeSingle()

        if (minuteData?.trello_cards) {
            const updatedCards = (minuteData.trello_cards as Array<Record<string, unknown>>).map(
                (c) => {
                    if (c.id !== cardId) return c
                    const patch: Record<string, unknown> = {}
                    if (name !== undefined) patch.name = name
                    if (responsible !== undefined) patch.responsible = responsible
                    return { ...c, ...patch }
                },
            )
            await supabase
                .from('meeting_minutes')
                .update({ trello_cards: updatedCards })
                .eq('id', minuteId)
        }
    }

    return jsonResponse({
        id: card.id,
        name: card.name,
        desc: card.desc,
        idList: card.idList,
        url: card.shortUrl || card.url,
    })
})
