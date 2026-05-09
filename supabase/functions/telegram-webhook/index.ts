/// <reference path="./types.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function ok() {
    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}

async function sendMessage(botToken: string, chatId: number | string, text: string, replyMarkup?: object) {
    const body: Record<string, unknown> = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
    }
    if (replyMarkup) body.reply_markup = replyMarkup

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

async function answerCallbackQuery(botToken: string, callbackQueryId: string, text: string) {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }),
    })
}

function formatDateBR(dt: string): string {
    const d = new Date(dt)
    if (dt.length === 10) {
        return d.toLocaleDateString('pt-BR', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
            timeZone: 'America/Sao_Paulo',
        })
    }
    return d.toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
    })
}

function cleanTitle(title = ''): string {
    return title.replace(/ - Carapicuiba Brazil Stake Atividades$/i, '').trim()
}

interface MeetingType { value: string; label: string }

function inferMeetingType(title = '', description = ''): MeetingType {
    const text = `${title} ${description}`.toLowerCase()

    // Conferência de ala/estaca → não é reunião de liderança
    if (/confer[eê]ncia\s+(de\s+|da\s+)?(ala|estaca)/i.test(text))
        return { value: 'outras', label: 'Outras Reuniões' }

    if (/entrevista/i.test(text) && /presidência|presidencia|estaca/i.test(text))
        return { value: 'entrevista_presidencia_estaca', label: 'Entrevista com a Presidência da Estaca' }
    if (/sumo\s+conselho|high\s+council/i.test(text))
        return { value: 'sumo_conselho_estaca', label: 'Reunião do Sumo Conselho da Estaca' }
    if (/conselho\s+da\s+estaca|conselho\s+estaca|stake\s+council|reunião\s+de\s+conselho|reuniao\s+de\s+conselho/i.test(text))
        return { value: 'conselho_estaca', label: 'Reunião de Conselho da Estaca' }
    if (/coordena[cç][aã]o\s+mission[aá]ria|missionary\s+coordination/i.test(text))
        return { value: 'coordenacao_missionaria_estaca', label: 'Reunião de Coordenação Missionária da Estaca' }
    if (/presidência\s+da\s+estaca|presidencia\s+da\s+estaca|stake\s+presidency|reunião\s+de\s+presidência|reuniao\s+de\s+presidencia/i.test(text))
        return { value: 'presidencia_estaca', label: 'Reunião de Presidência da Estaca' }

    return { value: 'outras', label: 'Outras Reuniões' }
}

function isLeadershipMeeting(title = '', description = ''): boolean {
    const type = inferMeetingType(title, description).value
    return type !== 'outras' && type !== 'entrevista_presidencia_estaca'
}

function isInterview(title = '', description = ''): boolean {
    return inferMeetingType(title, description).value === 'entrevista_presidencia_estaca'
}

Deno.serve(async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!botToken || !supabaseUrl || !supabaseServiceKey) {
        console.error('Variáveis de ambiente ausentes.')
        return ok() // Sempre retorna 200 para o Telegram não reenviar
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let update: Record<string, unknown>
    try {
        update = await request.json()
    } catch {
        return ok()
    }

    // -------------------------------------------------------------------------
    // Mensagem de texto recebida
    // -------------------------------------------------------------------------
    const message = update.message as Record<string, unknown> | undefined
    if (message) {
        const chatId = (message.chat as Record<string, unknown>)?.id as number
        const text = ((message.text as string) || '').trim()

        // Comando /vincular <token>
        const match = text.match(/^\/vincular\s+([a-zA-Z0-9_-]+)/)
        if (match) {
            const linkToken = match[1]

            const { data: profile, error } = await supabase
                .from('user_profiles')
                .select('id, full_name, telegram_chat_id')
                .eq('telegram_link_token', linkToken)
                .maybeSingle()

            if (error || !profile) {
                await sendMessage(botToken, chatId,
                    '❌ <b>Token inválido.</b>\n\nVerifique o código em Configurações › Perfil e tente novamente.')
                return ok()
            }

            if (profile.telegram_chat_id && profile.telegram_chat_id !== chatId) {
                await sendMessage(botToken, chatId,
                    '⚠️ Este token já foi utilizado por outra conta.')
                return ok()
            }

            await supabase
                .from('user_profiles')
                .update({ telegram_chat_id: chatId, telegram_link_token: null })
                .eq('id', profile.id)

            await sendMessage(botToken, chatId,
                `✅ <b>Conta vinculada com sucesso!</b>\n\nOlá, ${profile.full_name || 'usuário'}! Você receberá lembretes e poderá confirmar presença em reuniões por aqui.`)
            return ok()
        }

        // Verificar se há comentário pendente para este usuário (não comanda)
        if (!text.startsWith('/')) {
            const { data: commentReq } = await supabase
                .from('telegram_comment_requests')
                .select('id, card_id, card_name, organization_id')
                .eq('telegram_chat_id', chatId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (commentReq) {
                // Remove o pedido (seja qual for o resultado abaixo)
                await supabase
                    .from('telegram_comment_requests')
                    .delete()
                    .eq('id', commentReq.id)

                const { data: orgSettings } = await supabase
                    .from('organization_settings')
                    .select('trello_api_key, trello_token')
                    .eq('organization_id', commentReq.organization_id)
                    .maybeSingle()

                const trelloApiKey = (orgSettings as Record<string, string> | null)?.trello_api_key
                const trelloToken = (orgSettings as Record<string, string> | null)?.trello_token

                if (trelloApiKey && trelloToken) {
                    const commentUrl = new URL(`https://api.trello.com/1/cards/${commentReq.card_id}/actions/comments`)
                    commentUrl.searchParams.set('key', trelloApiKey)
                    commentUrl.searchParams.set('token', trelloToken)
                    const commentRes = await fetch(commentUrl.toString(), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text }),
                    })
                    if (commentRes.ok) {
                        await sendMessage(
                            botToken, chatId,
                            `✅ <b>Comentário adicionado!</b>\n\n💬 <i>${text}</i>\n\n📋 <b>${commentReq.card_name || 'Tarefa'}</b>`,
                        )
                    } else {
                        await sendMessage(botToken, chatId, '⚠️ Não foi possível adicionar o comentário no Trello. Tente novamente.')
                    }
                } else {
                    await sendMessage(botToken, chatId, '⚠️ Integração com o Trello não está configurada.')
                }
                return ok()
            }
        }

        // /reunioes, /atas, /tarefas — comandos de consulta
        if (text === '/menu' || text === '/reunioes' || text === '/entrevistas' || text === '/atas' || text === '/tarefas') {
            // Identifica o usuário pelo chat_id
            const [profileRes, contactRes] = await Promise.all([
                supabase
                    .from('user_profiles')
                    .select('id, full_name, organization_id')
                    .eq('telegram_chat_id', chatId)
                    .maybeSingle(),
                supabase
                    .from('telegram_contacts')
                    .select('id, full_name, organization_id')
                    .eq('telegram_chat_id', chatId)
                    .maybeSingle(),
            ])

            const qProfile = profileRes.data as { id: string; full_name: string | null; organization_id: string } | null
            const qContact = contactRes.data as { id: string; full_name: string | null; organization_id: string } | null

            if (!qProfile && !qContact) {
                await sendMessage(
                    botToken, chatId,
                    '❌ Sua conta não está vinculada ao sistema.\n\nEnvie /start para obter um código de vinculação ou peça ao secretário para vincular sua conta.',
                )
                return ok()
            }

            const organizationId: string = (qProfile?.organization_id || qContact?.organization_id)!
            const firstName = ((qProfile?.full_name || qContact?.full_name) ?? 'você').split(' ')[0]

            // ── /menu ─────────────────────────────────────────────────────────
            if (text === '/menu') {
                const isInternal = Boolean(qProfile)
                const internalRows = [
                    [
                        { text: '📅 Reuniões', callback_data: '/reunioes' },
                        { text: '🗒 Entrevistas', callback_data: '/entrevistas' },
                    ],
                    [
                        { text: '📋 Atas', callback_data: '/atas' },
                        { text: '✅ Tarefas', callback_data: '/tarefas' },
                    ],
                ]
                const externalRows = [
                    [{ text: '📅 Reuniões', callback_data: '/reunioes' }],
                    [{ text: '📋 Atas', callback_data: '/atas' }],
                ]
                await sendMessage(
                    botToken, chatId,
                    `📋 <b>Menu</b>\n<i>Olá, ${firstName}! Escolha uma opção:</i>`,
                    { inline_keyboard: isInternal ? internalRows : externalRows },
                )
                return ok()
            }

            // ── /reunioes ──────────────────────────────────────────────────────
            if (text === '/reunioes') {
                const today = new Date()
                const in30Days = new Date(today)
                in30Days.setDate(today.getDate() + 30)
                const startDate = today.toISOString().slice(0, 10)
                const endDate = in30Days.toISOString().slice(0, 10)

                const calRes = await fetch(`${supabaseUrl}/functions/v1/google-calendar-events`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseServiceKey}`,
                        'apikey': supabaseServiceKey,
                    },
                    body: JSON.stringify({
                        action: 'listEvents',
                        calendarId: 'primary',
                        startDate,
                        endDate,
                        maxResults: 20,
                    }),
                })

                if (!calRes.ok) {
                    await sendMessage(botToken, chatId, '⚠️ Não foi possível buscar as reuniões. Tente novamente mais tarde.')
                    return ok()
                }

                const calData = await calRes.json()
                let events: Array<Record<string, unknown>> = calData?.items || []

                // Filtra apenas reuniões de liderança (excluindo entrevistas)
                events = events.filter((e) => {
                    const t = cleanTitle((e.summary as string) || '')
                    const d = (e.description as string) || ''
                    return isLeadershipMeeting(t, d)
                })

                // Contatos externos: restringe às reuniões onde têm confirmação
                if (qContact) {
                    const { data: confirmations } = await supabase
                        .from('meeting_confirmations')
                        .select('google_event_id')
                        .eq('telegram_contact_id', qContact.id)
                    const eventIds = new Set(
                        (confirmations || []).map((c: { google_event_id: string }) => c.google_event_id),
                    )
                    events = events.filter((e) => eventIds.has(e.id as string))
                }

                if (events.length === 0) {
                    await sendMessage(botToken, chatId, `📅 Olá, ${firstName}! Nenhuma reunião encontrada para os próximos 30 dias.`)
                    return ok()
                }

                let msg = `📅 <b>Próximas reuniões</b>\n<i>Olá, ${firstName}!</i>\n\n`
                for (const event of events.slice(0, 5)) {
                    const title = cleanTitle((event.summary as string) || 'Reunião')
                    const description = (event.description as string) || ''
                    const typeLabel = inferMeetingType(title, description).label
                    const startEvt = event.start as Record<string, string> | undefined
                    const startDt = startEvt?.dateTime || startEvt?.date
                    const dateStr = startDt ? formatDateBR(startDt) : '–'
                    const location = event.location ? `\n📍 ${event.location as string}` : ''
                    msg += `🗓 <b>${title}</b>\n<i>${typeLabel}</i>\n🕐 ${dateStr}${location}\n\n`
                }
                if (events.length > 5) msg += `<i>...e mais ${events.length - 5} reuniões nos próximos 30 dias.</i>`

                await sendMessage(botToken, chatId, msg.trim())
                return ok()
            }

            // ── /entrevistas ───────────────────────────────────────────────────
            if (text === '/entrevistas') {
                // Exclusivo para usuários internos
                if (qContact) {
                    await sendMessage(
                        botToken, chatId,
                        '🔒 O comando /entrevistas está disponível apenas para membros com conta no sistema.',
                    )
                    return ok()
                }

                const today = new Date()
                const in60Days = new Date(today)
                in60Days.setDate(today.getDate() + 60)
                const startDate = today.toISOString().slice(0, 10)
                const endDate = in60Days.toISOString().slice(0, 10)

                const calRes = await fetch(`${supabaseUrl}/functions/v1/google-calendar-events`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseServiceKey}`,
                        'apikey': supabaseServiceKey,
                    },
                    body: JSON.stringify({
                        action: 'listEvents',
                        calendarId: 'primary',
                        startDate,
                        endDate,
                        maxResults: 50,
                    }),
                })

                if (!calRes.ok) {
                    await sendMessage(botToken, chatId, '⚠️ Não foi possível buscar as entrevistas. Tente novamente mais tarde.')
                    return ok()
                }

                const calData = await calRes.json()
                const events: Array<Record<string, unknown>> = (
                    (calData?.items || []) as Array<Record<string, unknown>>
                ).filter((e) => {
                    const t = cleanTitle((e.summary as string) || '')
                    const d = (e.description as string) || ''
                    return isInterview(t, d)
                })

                if (events.length === 0) {
                    await sendMessage(botToken, chatId, `🗒 Olá, ${firstName}! Nenhuma entrevista agendada para os próximos 60 dias.`)
                    return ok()
                }

                let msg = `🗒 <b>Próximas entrevistas</b>\n<i>Olá, ${firstName}!</i>\n\n`
                for (const event of events.slice(0, 10)) {
                    const title = cleanTitle((event.summary as string) || 'Entrevista')
                    const startEvt = event.start as Record<string, string> | undefined
                    const startDt = startEvt?.dateTime || startEvt?.date
                    const dateStr = startDt ? formatDateBR(startDt) : '–'
                    const location = event.location ? `\n📍 ${event.location as string}` : ''
                    msg += `🗓 <b>${title}</b>\n🕐 ${dateStr}${location}\n\n`
                }
                if (events.length > 10) msg += `<i>...e mais ${events.length - 10} entrevistas agendadas.</i>`

                await sendMessage(botToken, chatId, msg.trim())
                return ok()
            }

            // ── /atas ──────────────────────────────────────────────────────────
            if (text === '/atas') {
                // Para contatos externos: pré-filtra pelos google_event_id das suas confirmações
                let googleEventIds: string[] | null = null
                if (qContact) {
                    const { data: confirmations } = await supabase
                        .from('meeting_confirmations')
                        .select('google_event_id')
                        .eq('telegram_contact_id', qContact.id)
                    googleEventIds = (confirmations || []).map((c: { google_event_id: string }) => c.google_event_id)
                    if (googleEventIds.length === 0) {
                        await sendMessage(botToken, chatId, `📋 Olá, ${firstName}! Nenhuma ata encontrada para você.`)
                        return ok()
                    }
                }

                let minutesQuery = supabase
                    .from('meeting_minutes')
                    .select('title, meeting_at, drive_file_url, google_event_id')
                    .eq('organization_id', organizationId)
                    .eq('generation_status', 'ready')
                    .order('meeting_at', { ascending: false })
                    .limit(5)

                if (googleEventIds) {
                    minutesQuery = minutesQuery.in('google_event_id', googleEventIds)
                }

                const { data: minutes } = await minutesQuery

                if (!minutes || minutes.length === 0) {
                    await sendMessage(botToken, chatId, `📋 Olá, ${firstName}! Nenhuma ata gerada até o momento.`)
                    return ok()
                }

                let msg = `📋 <b>Últimas atas geradas</b>\n<i>Olá, ${firstName}!</i>\n\n`
                for (const m of minutes as Array<Record<string, unknown>>) {
                    const dateStr = m.meeting_at ? formatDateBR(m.meeting_at as string) : '–'
                    const link = m.drive_file_url
                        ? `\n🔗 <a href="${m.drive_file_url as string}">Abrir ata</a>`
                        : ''
                    msg += `📄 <b>${m.title as string}</b>\n🕐 ${dateStr}${link}\n\n`
                }

                await sendMessage(botToken, chatId, msg.trim())
                return ok()
            }

            // ── /tarefas ───────────────────────────────────────────────────────
            if (text === '/tarefas') {
                // Exclusivo para usuários internos
                if (qContact) {
                    await sendMessage(
                        botToken, chatId,
                        '🔒 A consulta de tarefas está disponível apenas para membros com conta no sistema.\n\n<i>Se precisar verificar uma tarefa, entre em contato com o secretário.</i>',
                    )
                    return ok()
                }

                // Delega para a Edge Function get-trello-tasks que usa as credenciais da aplicação
                const tasksRes = await fetch(`${supabaseUrl}/functions/v1/get-trello-tasks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseServiceKey}`,
                        'apikey': supabaseServiceKey,
                    },
                    body: JSON.stringify({ organizationId }),
                })

                if (!tasksRes.ok) {
                    const errBody = await tasksRes.text().catch(() => '(sem corpo)')
                    console.error(`[/tarefas] get-trello-tasks falhou: status=${tasksRes.status} body=${errBody}`)
                    await sendMessage(botToken, chatId, '⚠️ Não foi possível buscar as tarefas. Tente novamente mais tarde.')
                    return ok()
                }

                const tasksData = await tasksRes.json()
                interface TrelloTask {
                    name: string
                    responsible?: string
                    status?: string | null
                    meetingTypeLabel?: string
                    meetingAt?: string
                }
                const allTasks: TrelloTask[] = tasksData?.tasks || []

                // Filtra tarefas concluídas pelo nome da lista atual no Trello
                const donePhrases = /conclu[ií]|feito|done|arquivado/i
                const pendingTasks = allTasks.filter((t) => !t.status || !donePhrases.test(t.status))

                if (pendingTasks.length === 0) {
                    await sendMessage(botToken, chatId, `✅ Olá, ${firstName}! Nenhuma tarefa pendente no momento.`)
                    return ok()
                }

                let msg = `📋 <b>Tarefas pendentes</b>\n<i>Olá, ${firstName}!</i>\n\n`
                for (const task of pendingTasks.slice(0, 10)) {
                    const status = task.status ? `📂 ${task.status}` : '📂 –'
                    const responsible = task.responsible ? `\n   👤 ${task.responsible}` : ''
                    const meeting = task.meetingTypeLabel
                        ? `\n   🗓 ${task.meetingTypeLabel}${task.meetingAt ? ' · ' + formatDateBR(task.meetingAt) : ''}`
                        : ''
                    msg += `• <b>${task.name}</b>\n   ${status}${responsible}${meeting}\n\n`
                }
                if (pendingTasks.length > 10) msg += `<i>...e mais ${pendingTasks.length - 10} tarefas pendentes.</i>`

                await sendMessage(botToken, chatId, msg.trim())
                return ok()
            }

            return ok()
        }

        // /start — gera código de vinculação para contatos externos
        if (text.startsWith('/start')) {
            // Gera código de 8 chars alfanumérico
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
            let code = ''
            const arr = new Uint8Array(8)
            crypto.getRandomValues(arr)
            for (const byte of arr) code += chars[byte % chars.length]

            // Upsert: sobrescreve código anterior do mesmo chat_id
            const { error: upsertErr } = await supabase
                .from('telegram_link_codes')
                .upsert({ telegram_chat_id: chatId, code }, { onConflict: 'telegram_chat_id' })

            if (upsertErr) {
                console.error('Erro ao salvar código de vinculação:', upsertErr.message)
                await sendMessage(botToken, chatId,
                    '⚠️ Erro ao gerar código. Tente novamente em instantes.')
                return ok()
            }

            await sendMessage(botToken, chatId,
                `👋 <b>Bem-vindo!</b>

Seu código de vinculação é:

<code>${code}</code>

Informe este código ao secretário da estaca para que ele possa cadastrá-lo e você comece a receber lembretes de reuniões.

<i>O código é válido por 48 horas. Envie /start novamente para gerar um novo.</i>`)
        }

        return ok()
    }

    // -------------------------------------------------------------------------
    // Callback query (clique em botão inline)
    // -------------------------------------------------------------------------
    const callbackQuery = update.callback_query as Record<string, unknown> | undefined
    if (callbackQuery) {
        const callbackQueryId = callbackQuery.id as string
        const chatId = (callbackQuery.from as Record<string, unknown>)?.id as number
        const data = (callbackQuery.data as string) || ''

        // Botões do /menu — reencaminha como mensagem de texto para o mesmo handler
        if (data.startsWith('/')) {
            await answerCallbackQuery(botToken, callbackQueryId, '')
            // Simula mensagem de texto com o comando clicado
            const fakeUpdate = {
                message: {
                    chat: { id: chatId },
                    text: data,
                },
            }
            await fetch(`${supabaseUrl}/functions/v1/telegram-webhook`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'apikey': supabaseServiceKey,
                },
                body: JSON.stringify(fakeUpdate),
            })
            return ok()
        }

        // Formato: c:CONFIRMATION_UUID:yes ou c:CONFIRMATION_UUID:no
        if (data.startsWith('c:')) {
            const parts = data.split(':')
            if (parts.length === 3) {
                const confirmationId = parts[1]
                const answer = parts[2] // 'yes' ou 'no'
                const status = answer === 'yes' ? 'confirmed' : 'declined'

                // Verifica usuário interno (tem login no sistema)
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('id, full_name')
                    .eq('telegram_chat_id', chatId)
                    .maybeSingle()

                // Verifica contato externo
                const { data: contact } = await supabase
                    .from('telegram_contacts')
                    .select('id, full_name')
                    .eq('telegram_chat_id', chatId)
                    .maybeSingle()

                if (!profile && !contact) {
                    await answerCallbackQuery(botToken, callbackQueryId, '⚠️ Conta não vinculada.')
                    return ok()
                }

                // Monta filtro de acordo com o tipo de participante
                const filterColumn = profile ? 'user_id' : 'telegram_contact_id'
                const filterValue = profile ? profile.id : contact!.id
                const firstName = (profile?.full_name || contact?.full_name || 'você').split(' ')[0]

                const { error: updateError } = await supabase
                    .from('meeting_confirmations')
                    .update({ status, responded_at: new Date().toISOString() })
                    .eq('id', confirmationId)
                    .eq(filterColumn, filterValue)

                if (updateError) {
                    console.error('Erro ao registrar confirmação:', updateError.message)
                    await answerCallbackQuery(botToken, callbackQueryId, '⚠️ Erro ao registrar. Tente novamente.')
                    return ok()
                }

                const responseText = status === 'confirmed'
                    ? `✅ Presença confirmada! Até lá, ${firstName}!`
                    : `❌ Ausência registrada. Obrigado por avisar!`

                await answerCallbackQuery(botToken, callbackQueryId, responseText)
            }
        }

        // Formato: comment:{cardId}  — usuário quer adicionar comentário
        if (data.startsWith('comment:')) {
            const cardId = data.slice(8)

            // Busca contexto pelo histórico de notificações
            const { data: notif } = await supabase
                .from('trello_card_notifications')
                .select('minute_id, organization_id')
                .eq('card_id', cardId)
                .order('sent_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (!notif) {
                await answerCallbackQuery(botToken, callbackQueryId, '⚠️ Tarefa não encontrada.')
                return ok()
            }

            // Busca nome do card na ata
            const { data: minute } = await supabase
                .from('meeting_minutes')
                .select('trello_cards')
                .eq('id', (notif as Record<string, string>).minute_id)
                .maybeSingle()

            const card = (minute?.trello_cards as Array<Record<string, unknown>> | null)?.find(
                (c) => c.id === cardId,
            )
            const cardName = (card?.name as string) || 'Tarefa'

            // Upsert: sobrescreve pedido anterior do mesmo chat_id
            await supabase
                .from('telegram_comment_requests')
                .upsert(
                    {
                        telegram_chat_id: chatId,
                        card_id: cardId,
                        card_name: cardName,
                        organization_id: (notif as Record<string, string>).organization_id,
                    },
                    { onConflict: 'telegram_chat_id' },
                )

            await answerCallbackQuery(botToken, callbackQueryId, '💬 Escreva seu comentário na próxima mensagem.')
            await sendMessage(
                botToken, chatId,
                `💬 <b>Adicionar comentário</b>\n\nEscreva sua mensagem para a tarefa:\n<b>${cardName}</b>\n\n<i>Envie o texto a seguir e ele será adicionado ao Trello.</i>`,
                { force_reply: true, selective: true },
            )
            return ok()
        }

        // Formato: task:{cardId}:{listId}  — atualização de status pelo responsável
        if (data.startsWith('task:')) {
            const parts = data.split(':')
            if (parts.length === 3) {
                const [, cardId, listId] = parts

                // Busca minuteId e organizationId a partir do histórico de notificações
                const { data: notif } = await supabase
                    .from('trello_card_notifications')
                    .select('minute_id, organization_id')
                    .eq('card_id', cardId)
                    .order('sent_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (!notif) {
                    await answerCallbackQuery(botToken, callbackQueryId, '⚠️ Tarefa não encontrada.')
                    return ok()
                }

                const { minute_id: minuteId, organization_id: organizationId } = notif as Record<string, string>

                // Busca credenciais Trello
                const { data: orgSettings } = await supabase
                    .from('organization_settings')
                    .select('trello_api_key, trello_token')
                    .eq('organization_id', organizationId)
                    .maybeSingle()

                const trelloApiKey = (orgSettings as Record<string, string> | null)?.trello_api_key
                const trelloToken = (orgSettings as Record<string, string> | null)?.trello_token

                if (!trelloApiKey || !trelloToken) {
                    await answerCallbackQuery(botToken, callbackQueryId, '⚠️ Integração Trello não configurada.')
                    return ok()
                }

                // Atualiza o card no Trello
                const trelloUrl = new URL(`https://api.trello.com/1/cards/${cardId}`)
                trelloUrl.searchParams.set('key', trelloApiKey)
                trelloUrl.searchParams.set('token', trelloToken)
                const trelloRes = await fetch(trelloUrl.toString(), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idList: listId }),
                })

                if (!trelloRes.ok) {
                    await answerCallbackQuery(botToken, callbackQueryId, '⚠️ Erro ao atualizar no Trello.')
                    return ok()
                }

                const updatedCard = await trelloRes.json()
                const listName: string = updatedCard?.list?.name || listId

                // Atualiza statusListId no banco (trello_cards da ata)
                const { data: minute } = await supabase
                    .from('meeting_minutes')
                    .select('trello_cards')
                    .eq('id', minuteId)
                    .maybeSingle()

                if (minute?.trello_cards) {
                    const updatedCards = (minute.trello_cards as Array<Record<string, unknown>>).map((c) =>
                        c.id === cardId ? { ...c, idList: listId } : c
                    )
                    await supabase
                        .from('meeting_minutes')
                        .update({ trello_cards: updatedCards })
                        .eq('id', minuteId)
                }

                // Busca nome da lista para o feedback
                const listRes = await fetch(
                    `https://api.trello.com/1/lists/${listId}?fields=name&key=${trelloApiKey}&token=${trelloToken}`,
                )
                const listData = listRes.ok ? await listRes.json() : null
                const displayName = listData?.name || 'novo status'

                await answerCallbackQuery(botToken, callbackQueryId, `✅ Status atualizado para "${displayName}"!`)
                await sendMessage(
                    botToken, chatId,
                    `✅ <b>Status atualizado!</b>\n\n📋 Tarefa movida para: <b>${displayName}</b>`,
                )
            }
        }
    }

    return ok()
})
