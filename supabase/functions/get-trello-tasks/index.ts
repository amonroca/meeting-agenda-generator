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

const MEETING_TYPE_LABELS: Record<string, string> = {
    conselho_estaca: 'Reunião de Conselho da Estaca',
    coordenacao_missionaria_estaca: 'Reunião de Coordenação Missionária da Estaca',
    presidencia_estaca: 'Reunião de Presidência da Estaca',
    sumo_conselho_estaca: 'Reunião do Sumo Conselho da Estaca',
    outras: 'Outras Reuniões',
}

/**
 * Busca dados de um card individual do Trello.
 */
async function fetchTrelloCard(
    cardId: string,
    apiKey: string,
    token: string,
): Promise<{ idList?: string; name?: string; desc?: string } | null> {
    const url = new URL(`https://api.trello.com/1/cards/${cardId}`)
    url.searchParams.set('fields', 'idList,name,desc')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('token', token)

    try {
        const res = await fetch(url.toString())
        if (!res.ok) return null
        return await res.json()
    } catch {
        return null
    }
}

/**
 * Busca dados de uma lista do Trello.
 */
async function fetchTrelloList(
    listId: string,
    apiKey: string,
    token: string,
): Promise<{ name?: string } | null> {
    const url = new URL(`https://api.trello.com/1/lists/${listId}`)
    url.searchParams.set('fields', 'name')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('token', token)

    try {
        const res = await fetch(url.toString())
        if (!res.ok) return null
        return await res.json()
    } catch {
        return null
    }
}

Deno.serve(async (request: Request) => {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
        return jsonResponse({ error: 'Variáveis de ambiente do Supabase não configuradas.' }, 500)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let payload: { organizationId: string }
    try {
        payload = await request.json()
    } catch {
        return jsonResponse({ error: 'Body inválido. Envie um JSON válido.' }, 400)
    }

    const { organizationId } = payload
    if (!organizationId) {
        return jsonResponse({ error: 'organizationId é obrigatório.' }, 400)
    }

    // 1. Busca credenciais Trello da organização
    const { data: orgSettings } = await supabase
        .from('organization_settings')
        .select('trello_api_key, trello_token')
        .eq('organization_id', organizationId)
        .maybeSingle()

    const trelloApiKey: string | undefined = orgSettings?.trello_api_key
    const trelloToken: string | undefined = orgSettings?.trello_token

    // 2. Busca todas as atas com trello_cards
    const { data: minutes, error: minutesError } = await supabase
        .from('meeting_minutes')
        .select('id, title, meeting_type, meeting_at, trello_cards')
        .eq('organization_id', organizationId)
        .order('meeting_at', { ascending: false })

    if (minutesError) {
        return jsonResponse({ error: minutesError.message }, 500)
    }

    // 3. Achata tasks de todas as atas
    interface RawTask {
        id: string
        url: string
        name: string
        responsible: string
        minuteId: string
        meetingTitle: string
        meetingType: string
        meetingTypeLabel: string
        meetingAt: string
    }

    const tasks: RawTask[] = []
    for (const minute of minutes || []) {
        const cards = Array.isArray(minute.trello_cards) ? minute.trello_cards : []
        for (const card of cards) {
            if (!card?.id) continue
            tasks.push({
                id: card.id,
                url: card.url,
                name: card.name,
                responsible: card.responsible,
                minuteId: minute.id,
                meetingTitle: minute.title,
                meetingType: minute.meeting_type,
                meetingTypeLabel: MEETING_TYPE_LABELS[minute.meeting_type] || minute.meeting_type,
                meetingAt: minute.meeting_at,
            })
        }
    }

    if (tasks.length === 0) {
        return jsonResponse({ tasks: [] })
    }

    // Se não há credenciais Trello, retorna sem status
    if (!trelloApiKey || !trelloToken) {
        return jsonResponse({
            tasks: tasks.map((t) => ({ ...t, status: null, statusListId: null })),
        })
    }

    // 4. Busca dados atuais de cada card no Trello em paralelo
    const cardIds = tasks.map((t) => t.id)

    const cardResults = await Promise.all(
        cardIds.map((id) => fetchTrelloCard(id, trelloApiKey, trelloToken))
    )

    const cardListMap: Record<string, string> = {}
    const cardNameMap: Record<string, string> = {}
    const cardDescMap: Record<string, string> = {}

    for (let i = 0; i < cardIds.length; i++) {
        const data = cardResults[i]
        if (!data) continue
        if (data.idList) cardListMap[cardIds[i]] = data.idList
        if (data.name) cardNameMap[cardIds[i]] = data.name
        if (data.desc !== undefined) cardDescMap[cardIds[i]] = data.desc
    }

    // 5. Busca os nomes das listas em paralelo (IDs únicos)
    const listIds = [...new Set(Object.values(cardListMap))]
    const listResults = await Promise.all(
        listIds.map((id) => fetchTrelloList(id, trelloApiKey, trelloToken))
    )
    const listNameMap: Record<string, string> = {}
    for (let i = 0; i < listIds.length; i++) {
        const data = listResults[i]
        if (data?.name) listNameMap[listIds[i]] = data.name
    }

    // 6. Enriquece tasks com dados atuais do Trello
    const enrichedTasks = tasks.map((task) => {
        const listId = cardListMap[task.id] || null
        const status = listId ? (listNameMap[listId] || null) : null
        return {
            ...task,
            name: cardNameMap[task.id] ?? task.name,
            description: cardDescMap[task.id] ?? '',
            status,
            statusListId: listId,
        }
    })

    return jsonResponse({ tasks: enrichedTasks })
})
