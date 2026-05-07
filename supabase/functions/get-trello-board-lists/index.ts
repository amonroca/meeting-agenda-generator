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

    let payload: { organizationId: string; cardId: string }
    try {
        payload = await request.json()
    } catch {
        return jsonResponse({ error: 'Body inválido.' }, 400)
    }

    const { organizationId, cardId } = payload
    if (!organizationId || !cardId) {
        return jsonResponse({ error: 'organizationId e cardId são obrigatórios.' }, 400)
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

    // Passo 1: busca o idBoard do card
    const cardUrl = new URL(`https://api.trello.com/1/cards/${cardId}`)
    cardUrl.searchParams.set('key', trelloApiKey)
    cardUrl.searchParams.set('token', trelloToken)
    cardUrl.searchParams.set('fields', 'idBoard')

    const cardResponse = await fetch(cardUrl.toString())
    if (!cardResponse.ok) {
        const details = await cardResponse.text()
        return jsonResponse({ error: `Falha ao buscar dados do card: ${details}` }, 502)
    }
    const cardData: { idBoard: string } = await cardResponse.json()
    const boardId = cardData.idBoard

    // Passo 2: busca as listas abertas do board
    const listsUrl = new URL(`https://api.trello.com/1/boards/${boardId}/lists`)
    listsUrl.searchParams.set('key', trelloApiKey)
    listsUrl.searchParams.set('token', trelloToken)
    listsUrl.searchParams.set('fields', 'id,name')
    listsUrl.searchParams.set('filter', 'open')

    const listsResponse = await fetch(listsUrl.toString())
    if (!listsResponse.ok) {
        const details = await listsResponse.text()
        return jsonResponse({ error: `Falha ao buscar listas do board: ${details}` }, 502)
    }

    const lists: Array<{ id: string; name: string }> = await listsResponse.json()
    return jsonResponse({ lists })
})
