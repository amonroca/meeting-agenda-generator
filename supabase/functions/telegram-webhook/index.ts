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
    }

    return ok()
})
