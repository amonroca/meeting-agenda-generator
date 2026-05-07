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

interface Payload {
    organizationId: string
    cardId: string
    minuteId: string
    cardName: string
    meetingTitle: string
    description?: string
    // opção 1: chatId direto (novo fluxo)
    recipientChatId?: number | string
    recipientName?: string
    // opção 2: lookup por nome (legado)
    responsible?: string
}

async function fetchCardBoard(cardId: string, apiKey: string, token: string): Promise<string | null> {
    const url = new URL(`https://api.trello.com/1/cards/${cardId}`)
    url.searchParams.set('fields', 'idBoard')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('token', token)
    try {
        const res = await fetch(url.toString())
        if (!res.ok) return null
        const data = await res.json()
        return data.idBoard ?? null
    } catch {
        return null
    }
}

async function fetchBoardLists(
    boardId: string,
    apiKey: string,
    token: string,
): Promise<Array<{ id: string; name: string }>> {
    const url = new URL(`https://api.trello.com/1/boards/${boardId}/lists`)
    url.searchParams.set('filter', 'open')
    url.searchParams.set('fields', 'id,name')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('token', token)
    try {
        const res = await fetch(url.toString())
        if (!res.ok) return []
        return await res.json()
    } catch {
        return []
    }
}

async function sendTelegramMessage(
    botToken: string,
    chatId: number | string,
    text: string,
    inlineKeyboard: Array<Array<{ text: string; callback_data: string }>>,
) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: inlineKeyboard },
        }),
    })
}

Deno.serve(async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!botToken || !supabaseUrl || !supabaseServiceKey) {
        return jsonResponse({ error: 'Variáveis de ambiente ausentes.' }, 500)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let payload: Payload
    try {
        payload = await request.json()
    } catch {
        return jsonResponse({ error: 'Body inválido.' }, 400)
    }

    const { organizationId, cardId, minuteId, cardName, meetingTitle, description, recipientChatId, recipientName, responsible } = payload

    if (!organizationId || !cardId || !minuteId || !cardName || !meetingTitle) {
        return jsonResponse({ error: 'Campos obrigatórios: organizationId, cardId, minuteId, cardName, meetingTitle.' }, 400)
    }

    if (!recipientChatId && !responsible) {
        return jsonResponse({ error: 'Informe recipientChatId ou responsible.' }, 400)
    }

    // 1. Busca credenciais Trello e Telegram
    const { data: orgSettings } = await supabase
        .from('organization_settings')
        .select('trello_api_key, trello_token')
        .eq('organization_id', organizationId)
        .maybeSingle()

    const { data: telegramSettings } = await supabase
        .from('organization_settings')
        .select('telegram_bot_token')
        .eq('organization_id', organizationId)
        .maybeSingle()

    const effectiveBotToken = (telegramSettings as Record<string, string> | null)?.telegram_bot_token || botToken

    // Função auxiliar para lookup por nome (fluxo legado)
    const findByName = async (table: string, orgId: string, name: string) => {
        const exact = await supabase
            .from(table)
            .select('full_name, telegram_chat_id')
            .eq('organization_id', orgId)
            .ilike('full_name', name)
            .not('telegram_chat_id', 'is', null)
            .maybeSingle()
        if (exact.data) return exact.data
        const partial = await supabase
            .from(table)
            .select('full_name, telegram_chat_id')
            .eq('organization_id', orgId)
            .ilike('full_name', `%${name}%`)
            .not('telegram_chat_id', 'is', null)
            .maybeSingle()
        return partial.data
    }

    // 2. Resolve destinatário
    let chatId: number | string | undefined = recipientChatId
    let displayName: string = recipientName || responsible || 'usuário'

    if (!chatId) {
        // Fluxo legado: lookup por nome
        const internalUser = await findByName('user_profiles', organizationId, responsible!)
        const externalContact = !internalUser ? await findByName('telegram_contacts', organizationId, responsible!) : null

        chatId = internalUser?.telegram_chat_id ?? externalContact?.telegram_chat_id
        if (!chatId) {
            return jsonResponse({ error: `Nenhum Telegram vinculado para o responsável "${responsible}".` }, 404)
        }
        displayName = internalUser?.full_name || externalContact?.full_name || responsible || 'usuário'
    }

    // 3. Busca listas do board para os botões de status
    const trelloApiKey = (orgSettings as Record<string, string> | null)?.trello_api_key
    const trelloToken = (orgSettings as Record<string, string> | null)?.trello_token

    let statusButtons: Array<Array<{ text: string; callback_data: string }>> = []

    if (trelloApiKey && trelloToken) {
        const boardId = await fetchCardBoard(cardId, trelloApiKey, trelloToken)
        if (boardId) {
            const lists = await fetchBoardLists(boardId, trelloApiKey, trelloToken)
            // Callback: task:{cardId}:{listId} — máx. 64 bytes por botão
            statusButtons = lists.map((l) => [{
                text: l.name,
                callback_data: `task:${cardId}:${l.id}`,
            }])
        }
    }

    // Botão de comentário sempre presente
    statusButtons.push([{ text: '💬 Comentar', callback_data: `comment:${cardId}` }])

    // 4. Monta e envia a mensagem
    const descLine = description?.trim() ? `\n\n📝 ${description.trim()}` : ''
    const firstName = displayName.split(' ')[0]

    const messageText =
        `📋 <b>Tarefa pendente</b>\n\nOlá, ${firstName}! Você tem uma tarefa atribuída:\n\n<b>${cardName}</b>${descLine}\n\n🗓 ${meetingTitle}` +
        '\n\n<i>Atualize o status ou adicione um comentário abaixo:</i>'

    await sendTelegramMessage(effectiveBotToken, chatId, messageText, statusButtons)

    // 5. Registra a notificação no banco
    await supabase
        .from('trello_card_notifications')
        .insert({ organization_id: organizationId, card_id: cardId, minute_id: minuteId })

    // 6. Conta total de notificações enviadas para este card
    const { count } = await supabase
        .from('trello_card_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('card_id', cardId)

    return jsonResponse({ ok: true, notificationsCount: count ?? 0 })
})
