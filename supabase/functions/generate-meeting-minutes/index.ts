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
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
        },
    })
}

// ---------------------------------------------------------------------------
// Google OAuth
// ---------------------------------------------------------------------------

async function getGoogleAccessToken(): Promise<string> {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')
    const tokenUrl =
        Deno.env.get('GOOGLE_OAUTH_TOKEN_URL') ||
        Deno.env.get('GOOGLE_TOKEN_URI') ||
        'https://oauth2.googleapis.com/token'

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error(
            'As secrets GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REFRESH_TOKEN são obrigatórias.',
        )
    }

    const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
    })

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    })

    if (!response.ok) {
        const details = await response.text()
        throw new Error(`Falha ao obter token OAuth do Google: ${details}`)
    }

    const data = await response.json()
    if (!data.access_token) {
        throw new Error('Resposta OAuth do Google sem access_token.')
    }

    return data.access_token
}

// ---------------------------------------------------------------------------
// Azure OpenAI
// ---------------------------------------------------------------------------

async function generateMinutesWithAI(
    title: string,
    meetingTypeLabel: string,
    meetingAt: string,
    transcript: string,
    attendees: string[],
    customPrompt?: string,
): Promise<string> {
    const endpoint = Deno.env.get('AZURE_OPENAI_ENDPOINT')
    const apiKey = Deno.env.get('AZURE_OPENAI_API_KEY')
    const deployment = Deno.env.get('AZURE_OPENAI_DEPLOYMENT') || 'gpt-4.1-mini'

    if (!endpoint || !apiKey) {
        throw new Error('As secrets AZURE_OPENAI_ENDPOINT e AZURE_OPENAI_API_KEY são obrigatórias.')
    }

    const formattedDate = new Date(meetingAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'America/Sao_Paulo',
    })

    const attendeesList = attendees.length > 0 ? attendees.join(', ') : 'Não informados'

    const defaultSystemPrompt = `Você é um secretário eclesiástico experiente da Igreja de Jesus Cristo dos Santos dos Últimos Dias. 
Sua função é redigir atas de reuniões de forma clara, objetiva e respeitosa, seguindo o estilo formal das atas eclesiásticas.
Use linguagem formal em português brasileiro.
Estruture a ata com as seções: Abertura, Presentes, Pontos Discutidos, Decisões e Encaminhamentos, e Encerramento.
Não invente informações que não estejam na transcrição.`

    const systemPrompt = customPrompt || defaultSystemPrompt

    const userPrompt = `Gere uma ata formal para a seguinte reunião:

**Título:** ${title}
**Tipo:** ${meetingTypeLabel}
**Data:** ${formattedDate}
**Presentes:** ${attendeesList}

**Transcrição:**
${transcript}

IMPORTANTE: NÃO inclua um bloco de cabeçalho com Título, Tipo, Data ou Presentes na ata — esse bloco já é gerado automaticamente pelo sistema. Comece diretamente pela primeira seção do corpo da ata (ex.: ## Abertura). Siga exatamente o formato e as instruções definidas no sistema.`

    // Azure AI Foundry v1 API: endpoint já inclui /openai/v1, modelo vai no body
    const url = `${endpoint.replace(/\/$/, '')}/chat/completions`

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: deployment,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 4096,
        }),
    })

    if (!response.ok) {
        const details = await response.text()
        throw new Error(`Falha ao gerar ata com Azure OpenAI: ${details}`)
    }

    const data: AzureOpenAIResponse = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
        throw new Error('Azure OpenAI retornou resposta vazia.')
    }

    return content
}

// ---------------------------------------------------------------------------
// Google Docs
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers para Google Docs API
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function fetchDocument(documentId: string, accessToken: string): Promise<any> {
    const res = await fetch(
        `https://docs.googleapis.com/v1/documents/${documentId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!res.ok) throw new Error(`Falha ao ler documento: ${await res.text()}`)
    return res.json()
}

async function docsBatchUpdate(documentId: string, accessToken: string, requests: object[]): Promise<void> {
    if (requests.length === 0) return
    const res = await fetch(
        `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
        {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests }),
        },
    )
    if (!res.ok) {
        console.error('docsBatchUpdate falhou:', await res.text())
    }
}

async function applyMarkdownFormatting(documentId: string, accessToken: string): Promise<void> {
    // ----- Passo 1: Headings (# ##) e Bullets (- ) -----
    // deno-lint-ignore no-explicit-any
    const docData: any = await fetchDocument(documentId, accessToken)

    const styleRequests: object[] = []
    const prefixDeletions: { startIndex: number; endIndex: number }[] = []

    for (const element of docData.body?.content || []) {
        if (!element.paragraph) continue

        const paragraphText: string = (element.paragraph.elements || [])
            // deno-lint-ignore no-explicit-any
            .map((e: any) => e.textRun?.content || '')
            .join('')

        const startIndex: number = element.startIndex
        const endIndex: number = element.endIndex

        if (paragraphText.startsWith('# ')) {
            styleRequests.push({
                updateParagraphStyle: {
                    range: { startIndex, endIndex },
                    paragraphStyle: { namedStyleType: 'HEADING_1' },
                    fields: 'namedStyleType',
                },
            })
            prefixDeletions.push({ startIndex, endIndex: startIndex + 2 })
        } else if (paragraphText.startsWith('## ')) {
            styleRequests.push({
                updateParagraphStyle: {
                    range: { startIndex, endIndex },
                    paragraphStyle: { namedStyleType: 'HEADING_2' },
                    fields: 'namedStyleType',
                },
            })
            prefixDeletions.push({ startIndex, endIndex: startIndex + 3 })
        } else if (paragraphText.startsWith('- ')) {
            styleRequests.push({
                createParagraphBullets: {
                    range: { startIndex, endIndex },
                    bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
                },
            })
            prefixDeletions.push({ startIndex, endIndex: startIndex + 2 })
        }
    }

    await docsBatchUpdate(documentId, accessToken, styleRequests)

    // Deleta prefixos em ordem reversa para não deslocar índices
    const sortedDeletions = [...prefixDeletions].sort((a, b) => b.startIndex - a.startIndex)
    await docsBatchUpdate(documentId, accessToken, sortedDeletions.map(({ startIndex, endIndex }) => ({
        deleteContentRange: { range: { startIndex, endIndex } },
    })))

    // ----- Passo 2: Bold (**texto**) — relê após as deleções anteriores -----
    // deno-lint-ignore no-explicit-any
    const updatedDoc: any = await fetchDocument(documentId, accessToken)

    const boldStyleRequests: object[] = []
    const boldDeletions: { startIndex: number; endIndex: number }[] = []

    for (const element of updatedDoc.body?.content || []) {
        if (!element.paragraph) continue

        for (const el of element.paragraph.elements || []) {
            const text: string = el.textRun?.content || ''
            if (!text.includes('**')) continue

            const boldPattern = /\*\*(.+?)\*\*/g
            let match
            while ((match = boldPattern.exec(text)) !== null) {
                const runStart: number = el.startIndex
                const boldStart = runStart + match.index
                const textStart = boldStart + 2
                const textEnd = textStart + match[1].length
                const boldEnd = textEnd + 2

                boldStyleRequests.push({
                    updateTextStyle: {
                        range: { startIndex: textStart, endIndex: textEnd },
                        textStyle: { bold: true },
                        fields: 'bold',
                    },
                })
                boldDeletions.push({ startIndex: textEnd, endIndex: boldEnd })   // fecha **
                boldDeletions.push({ startIndex: boldStart, endIndex: textStart }) // abre **
            }
        }
    }

    await docsBatchUpdate(documentId, accessToken, boldStyleRequests)

    const sortedBoldDeletions = [...boldDeletions].sort((a, b) => b.startIndex - a.startIndex)
    await docsBatchUpdate(documentId, accessToken, sortedBoldDeletions.map(({ startIndex, endIndex }) => ({
        deleteContentRange: { range: { startIndex, endIndex } },
    })))
}

async function createGoogleDoc(
    title: string,
    content: string,
    accessToken: string,
): Promise<string> {
    // 1. Cria o documento em branco
    const createResponse = await fetch('https://docs.googleapis.com/v1/documents', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
    })

    if (!createResponse.ok) {
        const details = await createResponse.text()
        throw new Error(`Falha ao criar documento no Google Docs: ${details}`)
    }

    const doc: GoogleDocsCreateResponse = await createResponse.json()
    const documentId = doc.documentId

    // 2. Insere o texto bruto (com prefixos # e ##)
    const insertResponse = await fetch(
        `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                requests: [{ insertText: { location: { index: 1 }, text: content } }],
            }),
        },
    )

    if (!insertResponse.ok) {
        const details = await insertResponse.text()
        throw new Error(`Falha ao inserir conteúdo no Google Docs: ${details}`)
    }

    // 3. Lê o documento e aplica formatação com base na estrutura real
    await applyMarkdownFormatting(documentId, accessToken)

    return documentId
}

// ---------------------------------------------------------------------------
// Google Drive
// ---------------------------------------------------------------------------

async function moveFileToFolder(
    fileId: string,
    folderId: string,
    accessToken: string,
): Promise<GoogleDriveFile> {
    // Busca o pai atual para poder removê-lo ao mover
    const metaResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`,
        {
            headers: { Authorization: `Bearer ${accessToken}` },
        },
    )

    if (!metaResponse.ok) {
        const details = await metaResponse.text()
        throw new Error(`Falha ao obter metadados do arquivo no Drive: ${details}`)
    }

    const meta = await metaResponse.json()
    const previousParents = (meta.parents || []).join(',')

    const moveResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${folderId}&removeParents=${previousParents}&fields=id,webViewLink`,
        {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
        },
    )

    if (!moveResponse.ok) {
        const details = await moveResponse.text()
        throw new Error(`Falha ao mover arquivo para a pasta no Google Drive: ${details}`)
    }

    return await moveResponse.json()
}

async function getFileWebLink(fileId: string, accessToken: string): Promise<string> {
    const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`,
        {
            headers: { Authorization: `Bearer ${accessToken}` },
        },
    )

    if (!response.ok) {
        const details = await response.text()
        throw new Error(`Falha ao obter link do arquivo no Drive: ${details}`)
    }

    const data: GoogleDriveFile = await response.json()
    return data.webViewLink
}

/**
 * Torna um arquivo do Drive acessível por qualquer pessoa com o link (somente leitura).
 */
async function setPublicReadPermission(fileId: string, accessToken: string): Promise<void> {
    const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ type: 'anyone', role: 'reader' }),
        },
    )

    if (!response.ok) {
        const details = await response.text()
        // Não lança erro — o documento existe mesmo sem permissão pública
        console.warn(`Aviso: não foi possível tornar o documento público: ${details}`)
    }
}

// ---------------------------------------------------------------------------
// Google Drive — resolução de pastas por nome/caminho
// ---------------------------------------------------------------------------

/**
 * Busca uma pasta por nome dentro de um pai. Se não existir, cria.
 */
async function findOrCreateFolder(
    name: string,
    parentId: string,
    accessToken: string,
): Promise<string> {
    const safeName = name.replace(/'/g, "\\'")
    const q = `name = '${safeName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`

    const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
    )

    if (!searchResponse.ok) {
        const details = await searchResponse.text()
        throw new Error(`Falha ao buscar pasta "${name}" no Drive: ${details}`)
    }

    const searchData = await searchResponse.json()

    if (searchData.files?.length > 0) {
        return searchData.files[0].id as string
    }

    // Pasta não encontrada — cria
    const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        }),
    })

    if (!createResponse.ok) {
        const details = await createResponse.text()
        throw new Error(`Falha ao criar pasta "${name}" no Drive: ${details}`)
    }

    const folder = await createResponse.json()
    return folder.id as string
}

/**
 * Dado um caminho como "Pasta A/Subpasta B/2026", percorre (ou cria)
 * cada segmento a partir da raiz do Drive e retorna o ID da pasta final.
 */
async function resolveFolderByPath(path: string, accessToken: string): Promise<string> {
    const segments = path.split('/').map((s) => s.trim()).filter(Boolean)
    let parentId = 'root'

    for (const segment of segments) {
        parentId = await findOrCreateFolder(segment, parentId, accessToken)
    }

    return parentId
}

/**
 * Resolve o ID da pasta destino para um tipo de reunião.
 * Suporta tanto IDs diretos (sem '/') quanto caminhos completos (com '/').
 */
async function resolveFolderTarget(
    meetingType: string,
    typeFolderMap: Record<string, string>,
    rootFolderId: string | undefined,
    accessToken: string,
): Promise<string | null> {
    const value = typeFolderMap[meetingType] || rootFolderId || null

    if (!value) return null

    if (value.includes('/')) {
        return await resolveFolderByPath(value, accessToken)
    }

    return value
}

function meetingTypeLabel(meetingType: string): string {
    const labels: Record<string, string> = {
        conselho_estaca: 'Reunião de Conselho da Estaca',
        coordenacao_missionaria_estaca: 'Reunião de Coordenação Missionária da Estaca',
        presidencia_estaca: 'Reunião de Presidência da Estaca',
        sumo_conselho_estaca: 'Reunião do Sumo Conselho da Estaca',
        outras: 'Outras Reuniões',
    }
    return labels[meetingType] || meetingType
}

// ---------------------------------------------------------------------------
// Trello
// ---------------------------------------------------------------------------

interface TrelloTask {
    title: string
    description: string
    responsible: string
    dueContext: string
}

interface TrelloCard {
    id: string
    url: string
    name: string
    responsible: string
}

/**
 * Faz uma segunda chamada à OpenAI para extrair tarefas estruturadas da ata.
 * Retorna um array com title, description, responsible e dueContext.
 */
async function extractTasksWithAI(
    minutesContent: string,
    meetingTitle: string,
    meetingDate: string,
    endpoint: string,
    apiKey: string,
    deployment: string,
): Promise<TrelloTask[]> {
    const prompt = `Analise a ata de reunião abaixo e identifique todas as tarefas, encaminhamentos e responsabilidades atribuídas.

Para cada item encontrado, retorne um objeto JSON com os campos:
- "title": título curto e direto (máximo 60 caracteres), começando com um verbo no infinitivo (ex: "Enviar relatório mensal")
- "description": descrição detalhada explicando o que precisa ser feito, o contexto da decisão e o critério de conclusão
- "responsible": nome do responsável (ou "Não definido" se não mencionado)
- "dueContext": prazo ou referência temporal mencionada (ex: "próxima reunião", "até 30 de abril") ou "" se não houver

Se não houver nenhuma tarefa, retorne um array vazio [].
Retorne APENAS um array JSON válido, sem texto adicional, sem markdown, sem explicações.

**Reunião:** ${meetingTitle} — ${meetingDate}

**Ata:**
${minutesContent}`

    const url = `${endpoint.replace(/\/$/, '')}/chat/completions`
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: deployment,
            messages: [
                { role: 'system', content: 'Você é um assistente especializado em extrair tarefas de atas de reunião. Responda sempre com JSON puro e válido.' },
                { role: 'user', content: prompt },
            ],
            temperature: 0.1,
            max_tokens: 2048,
        }),
    })

    if (!response.ok) {
        const details = await response.text()
        console.warn(`Falha ao extrair tarefas com IA: ${details}`)
        return []
    }

    const data: AzureOpenAIResponse = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim() || ''

    try {
        // Remove blocos de código markdown caso a IA os inclua mesmo sendo instruída a não
        const clean = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
        const parsed = JSON.parse(clean)
        return Array.isArray(parsed) ? parsed : []
    } catch {
        console.warn('Resposta de tarefas não é JSON válido:', content)
        return []
    }
}

/**
 * Cria um card no Trello e retorna os dados do card criado.
 */
async function createTrelloCard(
    listId: string,
    task: TrelloTask,
    apiKey: string,
    token: string,
    driveUrl: string,
    meetingTitle: string,
    meetingDate: string,
): Promise<TrelloCard> {
    const descParts = []
    if (task.description) descParts.push(task.description)
    descParts.push('')
    descParts.push(`**Responsável:** ${task.responsible}`)
    if (task.dueContext) descParts.push(`**Prazo:** ${task.dueContext}`)
    descParts.push(`**Reunião:** ${meetingTitle}`)
    descParts.push(`**Data:** ${meetingDate}`)
    descParts.push(`**Ata:** ${driveUrl}`)
    const desc = descParts.join('\n')

    const url = new URL('https://api.trello.com/1/cards')
    url.searchParams.set('idList', listId)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('token', token)
    url.searchParams.set('name', task.title)
    url.searchParams.set('desc', desc)

    const response = await fetch(url.toString(), { method: 'POST' })

    if (!response.ok) {
        const details = await response.text()
        throw new Error(`Falha ao criar card Trello "${task.description}": ${details}`)
    }

    const card = await response.json()
    return {
        id: card.id,
        url: card.shortUrl || card.url,
        name: task.title,
        responsible: task.responsible,
    }
}

/**
 * Cria cards no Trello para todas as tarefas identificadas na ata.
 * Retorna os cards criados com sucesso; erros individuais são logados mas não lançados.
 */
async function createTrelloCards(
    tasks: TrelloTask[],
    listId: string,
    apiKey: string,
    token: string,
    driveUrl: string,
    meetingTitle: string,
    meetingDate: string,
): Promise<TrelloCard[]> {
    const cards: TrelloCard[] = []

    for (const task of tasks) {
        try {
            const card = await createTrelloCard(listId, task, apiKey, token, driveUrl, meetingTitle, meetingDate)
            cards.push(card)
        } catch (err) {
            console.warn(`Aviso: ${err instanceof Error ? err.message : String(err)}`)
        }
    }

    return cards
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

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

    let payload: GenerateMinutesPayload

    try {
        payload = await request.json()
    } catch {
        return jsonResponse({ error: 'Body inválido. Envie um JSON válido.' }, 400)
    }

    const { googleEventId, title, meetingType, meetingAt, transcript, organizationId, attendees = [] } = payload

    if (!googleEventId || !title || !meetingType || !meetingAt || !transcript || !organizationId) {
        return jsonResponse(
            { error: 'Campos obrigatórios: googleEventId, title, meetingType, meetingAt, transcript, organizationId.' },
            400,
        )
    }

    // Marca como "processing" no banco antes de começar o trabalho pesado
    const { error: upsertError } = await supabase.from('meeting_minutes').upsert(
        {
            organization_id: organizationId,
            google_event_id: googleEventId,
            title,
            meeting_type: meetingType,
            meeting_at: meetingAt,
            drive_file_id: 'pending',
            drive_file_url: '',
            attendees,
            generation_status: 'processing',
        },
        { onConflict: 'organization_id,google_event_id' },
    )

    if (upsertError) {
        return jsonResponse({ error: `Falha ao registrar ata no banco: ${upsertError.message}` }, 500)
    }

    try {
        // 1. Busca configurações da organização (pasta do Drive por tipo, prompt e Trello)
        const { data: orgSettings } = await supabase
            .from('organization_settings')
            .select('drive_root_folder_id, type_folder_map, minutes_prompt, trello_api_key, trello_token, trello_list_map')
            .eq('organization_id', organizationId)
            .maybeSingle()

        const typeFolderMap: Record<string, string> = orgSettings?.type_folder_map || {}
        const rootFolderId: string | undefined = orgSettings?.drive_root_folder_id
        const customPrompt: string | undefined = orgSettings?.minutes_prompt || undefined
        const trelloApiKey: string | undefined = orgSettings?.trello_api_key
        const trelloToken: string | undefined = orgSettings?.trello_token
        const trelloListMap: Record<string, string> = orgSettings?.trello_list_map || {}

        // 2. Obtém token Google
        const accessToken = await getGoogleAccessToken()

        // 3. Gera o conteúdo da ata via Azure OpenAI
        const minutesContent = await generateMinutesWithAI(
            title,
            meetingTypeLabel(meetingType),
            meetingAt,
            transcript,
            attendees,
            customPrompt,
        )

        // 4. Monta o bloco de metadados e prepende ao conteúdo da ata
        const formattedDate = new Date(meetingAt).toLocaleDateString('pt-BR', {
            day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo',
        })
        const attendeesList = attendees.length > 0 ? attendees.join(', ') : 'Não informados'
        const metadataBlock = `# Ata da Reunião\n\n**Título:** ${title}\n**Tipo:** ${meetingTypeLabel(meetingType)}\n**Data:** ${formattedDate}\n**Presentes:** ${attendeesList}\n\n`

        // Remove o "# Ata da Reunião" do conteúdo gerado pela IA (se existir) para evitar duplicação
        const contentWithoutTitle = minutesContent.replace(/^#\s+Ata da Reuni[aã]o\s*\n*/i, '')
        const fullContent = metadataBlock + contentWithoutTitle

        // 5. Cria o documento no Google Docs
        const docTitle = `Ata — ${title} — ${new Date(meetingAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
        const documentId = await createGoogleDoc(docTitle, fullContent, accessToken)

        // 6. Resolve e move para a pasta correta
        const folderId = await resolveFolderTarget(meetingType, typeFolderMap, rootFolderId, accessToken)
        let webViewLink: string

        if (folderId) {
            const moved = await moveFileToFolder(documentId, folderId, accessToken)
            webViewLink = moved.webViewLink
        } else {
            webViewLink = await getFileWebLink(documentId, accessToken)
        }

        // 7. Torna o documento publicamente acessível (somente leitura)
        await setPublicReadPermission(documentId, accessToken)

        // 8. Cria cards no Trello para as tarefas identificadas na ata
        let trelloCards: TrelloCard[] = []
        const trelloListId = trelloListMap[meetingType]

        if (trelloApiKey && trelloToken && trelloListId) {
            const endpoint = Deno.env.get('AZURE_OPENAI_ENDPOINT') || ''
            const openAiKey = Deno.env.get('AZURE_OPENAI_API_KEY') || ''
            const deployment = Deno.env.get('AZURE_OPENAI_DEPLOYMENT') || 'gpt-4.1-mini'

            const tasks = await extractTasksWithAI(
                minutesContent,
                title,
                formattedDate,
                endpoint,
                openAiKey,
                deployment,
            )

            if (tasks.length > 0) {
                trelloCards = await createTrelloCards(
                    tasks,
                    trelloListId,
                    trelloApiKey,
                    trelloToken,
                    webViewLink,
                    title,
                    formattedDate,
                )
                console.log(`Trello: ${trelloCards.length}/${tasks.length} cards criados.`)
            } else {
                console.log('Nenhuma tarefa identificada pela IA.')
            }
        } else {
            console.log('Trello não configurado para este tipo de reunião — cards ignorados.')
        }

        // 9. Atualiza o registro no Supabase com status "ready"
        const { error: updateError } = await supabase
            .from('meeting_minutes')
            .update({
                drive_file_id: documentId,
                drive_file_url: webViewLink,
                drive_folder_id: folderId || null,
                summary: minutesContent.slice(0, 500), // resumo sem metadados
                trello_cards: trelloCards,
                generation_status: 'ready',
                updated_at: new Date().toISOString(),
            })
            .eq('organization_id', organizationId)
            .eq('google_event_id', googleEventId)

        if (updateError) {
            throw new Error(`Ata criada no Drive mas falhou ao atualizar o banco: ${updateError.message}`)
        }

        return jsonResponse({
            success: true,
            documentId,
            webViewLink,
            trelloCards,
        })
    } catch (err) {
        // Marca como "failed" para o frontend poder reagir
        await supabase
            .from('meeting_minutes')
            .update({
                generation_status: 'failed',
                updated_at: new Date().toISOString(),
            })
            .eq('organization_id', organizationId)
            .eq('google_event_id', googleEventId)

        const message = err instanceof Error ? err.message : String(err)
        return jsonResponse({ error: message }, 500)
    }
})
