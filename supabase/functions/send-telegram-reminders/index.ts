/// <reference path="./types.d.ts" />

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

interface ReminderPayload {
    organizationId: string
    googleEventId: string
    title: string
    meetingAt: string
    meetingType?: string
    meetingTypeLabel?: string
    location?: string
}

async function sendMessage(botToken: string, chatId: number, text: string, replyMarkup: object): Promise<{ ok: boolean; error?: string }> {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
        }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
        const errMsg = body?.description || `HTTP ${response.status}`
        console.warn(`Falha ao enviar mensagem para chat_id ${chatId}: ${errMsg}`)
        return { ok: false, error: errMsg }
    }
    return { ok: true }
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

    let payload: ReminderPayload
    try {
        payload = await request.json()
    } catch {
        return jsonResponse({ error: 'Body inválido.' }, 400)
    }

    const { organizationId, googleEventId, title, meetingAt, meetingType, meetingTypeLabel, location } = payload

    if (!organizationId || !googleEventId || !title || !meetingAt) {
        return jsonResponse({ error: 'Campos obrigatórios: organizationId, googleEventId, title, meetingAt.' }, 400)
    }

    // Busca usuários internos com Telegram vinculado
    const { data: users, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, full_name, telegram_chat_id')
        .eq('organization_id', organizationId)
        .not('telegram_chat_id', 'is', null)

    if (usersError) {
        return jsonResponse({ error: `Erro ao buscar usuários: ${usersError.message}` }, 500)
    }

    // Busca contatos externos com Telegram vinculado, filtrados pelo tipo de reunião
    let contacts: Array<{ id: string; full_name: string; telegram_chat_id: number }> = []
    if (meetingType) {
        const { data: contactData, error: contactError } = await supabase
            .from('telegram_contacts')
            .select('id, full_name, telegram_chat_id')
            .eq('organization_id', organizationId)
            .not('telegram_chat_id', 'is', null)
            .contains('meeting_types', [meetingType])

        if (contactError) {
            console.warn('Erro ao buscar contatos externos:', contactError.message)
        } else {
            contacts = contactData || []
        }
    }

    const totalParticipants = (users?.length || 0) + contacts.length
    if (totalParticipants === 0) {
        return jsonResponse({ sent: 0, message: 'Nenhum destinatário com Telegram vinculado.' })
    }

    // Formata a data
    const dateStr = new Date(meetingAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
    })

    // Monta o texto da mensagem
    const lines = [
        `📅 <b>Lembrete de Reunião</b>`,
        ``,
        `<b>${title}</b>`,
        meetingTypeLabel ? `📋 ${meetingTypeLabel}` : '',
        `🕐 ${dateStr}`,
        location ? `📍 ${location}` : '',
        ``,
        `Confirme sua presença:`,
    ].filter((l) => l !== '')

    const text = lines.join('\n')

    // Botões inline de confirmação — montados por participante com UUID único
    // Formato: c:UUID:yes ou c:UUID:no = ~42 bytes, bem abaixo do limite de 64 do Telegram

    // Função auxiliar para buscar/criar confirmação e enviar mensagem
    async function sendToParticipant(
        participantId: string,
        chatId: number,
        idColumn: 'user_id' | 'telegram_contact_id',
        displayName: string
    ): Promise<{ ok: boolean; error?: string }> {
        const { data: existing } = await supabase
            .from('meeting_confirmations')
            .select('id')
            .eq('google_event_id', googleEventId)
            .eq(idColumn, participantId)
            .maybeSingle()

        let confirmationId: string
        if (existing) {
            confirmationId = existing.id
        } else {
            const insertData: Record<string, unknown> = {
                organization_id: organizationId,
                google_event_id: googleEventId,
                status: 'pending',
            }
            insertData[idColumn] = participantId

            const { data: inserted, error: insertError } = await supabase
                .from('meeting_confirmations')
                .insert(insertData)
                .select('id')
                .single()

            if (insertError || !inserted) {
                console.warn(`Falha ao criar confirmação para ${displayName}: ${insertError?.message}`)
                return { ok: false, error: `${displayName}: falha ao criar confirmação` }
            }
            confirmationId = inserted.id
        }

        const replyMarkup = {
            inline_keyboard: [[
                { text: '✅ Confirmar presença', callback_data: `c:${confirmationId}:yes` },
                { text: '❌ Não poderei comparecer', callback_data: `c:${confirmationId}:no` },
            ]],
        }

        return await sendMessage(botToken, chatId, text, replyMarkup)
    }

    let sent = 0
    let failed = 0
    const errors: string[] = []

    // Envia para usuários internos
    for (const user of (users || [])) {
        const result = await sendToParticipant(user.id, user.telegram_chat_id, 'user_id', user.full_name)
        if (result.ok) sent++
        else { failed++; if (result.error) errors.push(result.error) }
    }

    // Envia para contatos externos
    for (const contact of contacts) {
        const result = await sendToParticipant(contact.id, contact.telegram_chat_id, 'telegram_contact_id', contact.full_name)
        if (result.ok) sent++
        else { failed++; if (result.error) errors.push(result.error) }
    }

    console.log(`Lembretes enviados: ${sent}/${totalParticipants} (${failed} falhas) — evento: ${googleEventId}`)

    return jsonResponse({ sent, failed, total: totalParticipants, errors })
})
