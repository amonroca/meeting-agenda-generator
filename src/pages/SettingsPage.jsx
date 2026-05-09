import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { isGoogleCalendarConfigured } from '../services/googleCalendar'
import { getOrganizationSettings, saveOrganizationSettings } from '../services/organizationSettings'
import { generateTelegramLinkToken, getTelegramStatus, unlinkTelegram, listTelegramContacts, addTelegramContact, removeTelegramContact, listOrgUsers, updateUserNotificationTypes } from '../services/telegram'
import { listMeetingTypeOptions } from '../services/meetingMinutes'

const TABS = [
  { id: 'perfil', label: 'Perfil', adminOnly: false },
  { id: 'usuarios', label: 'Usuários', adminOnly: true },
  { id: 'contatos', label: 'Contatos Externos', adminOnly: true },
  { id: 'drive', label: 'Google Drive', adminOnly: true },
  { id: 'trello', label: 'Trello', adminOnly: true },
  { id: 'prompt', label: 'Prompt de IA', adminOnly: true },
]

const MEETING_TYPE_LABELS = {
  conselho_estaca: 'Reunião de Conselho da Estaca',
  presidencia_estaca: 'Reunião de Presidência da Estaca',
  sumo_conselho_estaca: 'Reunião do Sumo Conselho da Estaca',
  coordenacao_missionaria_estaca: 'Reunião de Coordenação Missionária da Estaca',
  outras: 'Outras Reuniões',
}

const DEFAULT_FOLDER_PATHS = {
  conselho_estaca: 'Estaca Carapicuiba/Secretaria/Atas_Conselho/2026',
  presidencia_estaca: 'Estaca Carapicuiba/Secretaria/Atas_PresEstaca/2026',
  sumo_conselho_estaca: 'Estaca Carapicuiba/Secretaria/Atas_SumoConselho/2026',
  coordenacao_missionaria_estaca: '',
  outras: '',
}

const DEFAULT_MINUTES_PROMPT = `Você é um assistente especializado em redigir atas de reunião formais em português brasileiro.

A partir da transcrição fornecida, produza uma ata completa e bem estruturada.

Regras importantes:
- Use APENAS as informações presentes na transcrição. Não invente dados.
- Seja objetivo e claro.
- Use linguagem formal.
- Listas de itens devem começar com "- " (hífen e espaço).
- Os títulos de seções devem usar o formato exato abaixo (com # e ##).

Formato obrigatório de saída:

# Ata da Reunião

## Resumo Executivo
- [Síntese em 2 a 4 pontos dos principais resultados e encaminhamentos da reunião]

## Temas
- [Tema 1: descrição objetiva do que foi discutido]
- [Tema 2: descrição objetiva do que foi discutido]

## Decisões
- [Decisão 1]
- [Decisão 2]

## Tarefas
- [Descrição da tarefa] — Responsável: [nome ou "não informado"]

## Pendências
- [Ponto pendente ou "Nenhuma pendência registrada."]`

export default function SettingsPage() {
  const { user, logout, isConfigured } = useAuth()
  const isAdmin = user?.role === 'admin'
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin)
  const [activeTab, setActiveTab] = useState('perfil')
  const [folderPaths, setFolderPaths] = useState(DEFAULT_FOLDER_PATHS)
  const [driveSaving, setDriveSaving] = useState(false)
  const [driveMessage, setDriveMessage] = useState({ type: '', text: '' })
  const [minutesPrompt, setMinutesPrompt] = useState(DEFAULT_MINUTES_PROMPT)
  const [promptSaving, setPromptSaving] = useState(false)
  const [promptMessage, setPromptMessage] = useState({ type: '', text: '' })
  const [trelloApiKey, setTrelloApiKey] = useState('')
  const [trelloToken, setTrelloToken] = useState('')
  const [trelloListMap, setTrelloListMap] = useState({})
  const [trelloSaving, setTrelloSaving] = useState(false)
  const [trelloMessage, setTrelloMessage] = useState({ type: '', text: '' })

  // Telegram
  const [telegramLinked, setTelegramLinked] = useState(false)
  const [telegramLinkToken, setTelegramLinkToken] = useState('')
  const [telegramLoading, setTelegramLoading] = useState(false)
  const [telegramMessage, setTelegramMessage] = useState({ type: '', text: '' })

  // Contatos externos
  const [contacts, setContacts] = useState([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContact, setNewContact] = useState({ fullName: '', role: '', meetingTypes: [], linkCode: '' })
  const [contactSaving, setContactSaving] = useState(false)
  const [contactMessage, setContactMessage] = useState({ type: '', text: '' })
  const [meetingTypeOptions, setMeetingTypeOptions] = useState([])

  // Usuários internos
  const [orgUsers, setOrgUsers] = useState([])
  const [orgUsersLoading, setOrgUsersLoading] = useState(false)
  const [savingUserId, setSavingUserId] = useState(null)

  useEffect(() => {
    listMeetingTypeOptions().then(setMeetingTypeOptions)
  }, [])

  useEffect(() => {
    if (!user?.id) return
    getTelegramStatus(user.id)
      .then((status) => {
        if (status?.telegram_chat_id) setTelegramLinked(true)
        if (status?.telegram_link_token) setTelegramLinkToken(status.telegram_link_token)
      })
      .catch(() => { })
  }, [user?.id])

  // Carrega contatos externos ao entrar na aba
  useEffect(() => {
    if (!isAdmin || !user?.organizationId || activeTab !== 'contatos') return
    setContactsLoading(true)
    listTelegramContacts(user.organizationId)
      .then(setContacts)
      .catch(() => { })
      .finally(() => setContactsLoading(false))
  }, [isAdmin, user?.organizationId, activeTab])

  // Carrega usuários internos ao entrar na aba
  useEffect(() => {
    if (!isAdmin || !user?.organizationId || activeTab !== 'usuarios') return
    setOrgUsersLoading(true)
    listOrgUsers(user.organizationId)
      .then(setOrgUsers)
      .catch(() => { })
      .finally(() => setOrgUsersLoading(false))
  }, [isAdmin, user?.organizationId, activeTab])

  async function handleToggleUserMeetingType(userId, currentTypes, typeValue) {
    const next = currentTypes.includes(typeValue)
      ? currentTypes.filter((t) => t !== typeValue)
      : [...currentTypes, typeValue]
    setSavingUserId(userId)
    try {
      await updateUserNotificationTypes(userId, next)
      setOrgUsers((prev) => prev.map((u) => u.id === userId ? { ...u, notification_meeting_types: next } : u))
    } catch (err) {
      alert(err.message || 'Falha ao salvar.')
    } finally {
      setSavingUserId(null)
    }
  }

  async function handleAddContact(e) {
    e.preventDefault()
    if (!user?.organizationId) return
    setContactSaving(true)
    setContactMessage({ type: '', text: '' })
    try {
      const contact = await addTelegramContact({
        organizationId: user.organizationId,
        fullName: newContact.fullName.trim(),
        role: newContact.role.trim(),
        meetingTypes: newContact.meetingTypes,
        linkCode: newContact.linkCode.trim(),
        createdBy: user.id,
      })
      setContacts((prev) => [...prev, contact].sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setNewContact({ fullName: '', role: '', meetingTypes: [], linkCode: '' })
      setShowAddContact(false)
      setContactMessage({ type: 'success', text: `${contact.full_name} adicionado com sucesso.` })
    } catch (err) {
      setContactMessage({ type: 'error', text: err.message || 'Falha ao adicionar contato.' })
    } finally {
      setContactSaving(false)
      setTimeout(() => setContactMessage({ type: '', text: '' }), 6000)
    }
  }

  async function handleRemoveContact(contactId, name) {
    if (!window.confirm(`Remover "${name}" dos contatos externos? Ele deixará de receber notificações.`)) return
    try {
      await removeTelegramContact(contactId)
      setContacts((prev) => prev.filter((c) => c.id !== contactId))
    } catch (err) {
      alert(err.message || 'Falha ao remover contato.')
    }
  }

  function toggleMeetingType(value) {
    setNewContact((prev) => ({
      ...prev,
      meetingTypes: prev.meetingTypes.includes(value)
        ? prev.meetingTypes.filter((t) => t !== value)
        : [...prev.meetingTypes, value],
    }))
  }

  async function handleGenerateLinkToken() {
    if (!user?.id) return
    setTelegramLoading(true)
    setTelegramMessage({ type: '', text: '' })
    try {
      const token = await generateTelegramLinkToken(user.id)
      setTelegramLinkToken(token)
      setTelegramMessage({ type: 'success', text: 'Código gerado. Envie o comando ao bot para vincular sua conta.' })
    } catch (err) {
      setTelegramMessage({ type: 'error', text: err.message || 'Falha ao gerar código.' })
    } finally {
      setTelegramLoading(false)
      setTimeout(() => setTelegramMessage({ type: '', text: '' }), 5000)
    }
  }

  async function handleUnlinkTelegram() {
    if (!user?.id) return
    setTelegramLoading(true)
    try {
      await unlinkTelegram(user.id)
      setTelegramLinked(false)
      setTelegramLinkToken('')
      setTelegramMessage({ type: 'success', text: 'Telegram desvinculado.' })
    } catch (err) {
      setTelegramMessage({ type: 'error', text: err.message || 'Falha ao desvincular.' })
    } finally {
      setTelegramLoading(false)
      setTimeout(() => setTelegramMessage({ type: '', text: '' }), 5000)
    }
  }

  useEffect(() => {
    if (!user?.organizationId) return

    getOrganizationSettings(user.organizationId)
      .then((settings) => {
        if (settings?.type_folder_map) {
          setFolderPaths((prev) => ({ ...prev, ...settings.type_folder_map }))
        }
        if (settings?.minutes_prompt) {
          setMinutesPrompt(settings.minutes_prompt)
        }
        if (settings?.trello_api_key) setTrelloApiKey(settings.trello_api_key)
        if (settings?.trello_token) setTrelloToken(settings.trello_token)
        if (settings?.trello_list_map) setTrelloListMap(settings.trello_list_map)
      })
      .catch(() => { })
  }, [user?.organizationId])

  async function handleSaveDriveSettings(e) {
    e.preventDefault()
    if (!user?.organizationId) return

    setDriveSaving(true)
    setDriveMessage({ type: '', text: '' })

    try {
      await saveOrganizationSettings(user.organizationId, { typeFolderMap: folderPaths })
      setDriveMessage({ type: 'success', text: 'Configurações de pastas salvas com sucesso.' })
    } catch (err) {
      setDriveMessage({ type: 'error', text: err.message || 'Falha ao salvar configurações.' })
    } finally {
      setDriveSaving(false)
      setTimeout(() => setDriveMessage({ type: '', text: '' }), 5000)
    }
  }

  async function handleSaveTrelloSettings(e) {
    e.preventDefault()
    if (!user?.organizationId) return

    setTrelloSaving(true)
    setTrelloMessage({ type: '', text: '' })

    try {
      await saveOrganizationSettings(user.organizationId, {
        typeFolderMap: folderPaths,
        trelloApiKey,
        trelloToken,
        trelloListMap,
      })
      setTrelloMessage({ type: 'success', text: 'Configurações do Trello salvas com sucesso.' })
    } catch (err) {
      setTrelloMessage({ type: 'error', text: err.message || 'Falha ao salvar configurações do Trello.' })
    } finally {
      setTrelloSaving(false)
      setTimeout(() => setTrelloMessage({ type: '', text: '' }), 5000)
    }
  }

  async function handleSavePromptSettings(e) {
    e.preventDefault()
    if (!user?.organizationId) return

    setPromptSaving(true)
    setPromptMessage({ type: '', text: '' })

    try {
      await saveOrganizationSettings(user.organizationId, {
        typeFolderMap: folderPaths,
        minutesPrompt,
      })
      setPromptMessage({ type: 'success', text: 'Prompt salvo com sucesso.' })
    } catch (err) {
      setPromptMessage({ type: 'error', text: err.message || 'Falha ao salvar prompt.' })
    } finally {
      setPromptSaving(false)
      setTimeout(() => setPromptMessage({ type: '', text: '' }), 5000)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-6 shadow-lg">
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="mt-1 text-sm text-blue-100">{isAdmin ? 'Gerencie seu perfil, o acesso ao banco e as integrações externas.' : 'Gerencie seu perfil e acesso ao sistema.'}</p>
      </div>

      {/* Abas — só exibe quando há mais de uma */}
      {visibleTabs.length > 1 && (
        <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/*{!isAdmin && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          As configurações de integrações são visíveis apenas para administradores.
        </div>
      )}*/}

      {/* Aba: Perfil */}
      {activeTab === 'perfil' && (
        <div className="space-y-4">
          <div className="rounded-lg border-l-4 border-blue-500 bg-white p-4 shadow-sm transition hover:shadow-md">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white">
                {(user?.name || 'U').charAt(0).toUpperCase()}
              </div>

              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900">{user?.name || 'Usuário'}</h2>
                <p className="text-sm text-slate-500">{user?.email}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                    {user?.role === 'admin' ? 'Administrador' : 'Usuário'}
                  </span>
                  <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    {isConfigured ? 'Supabase conectado' : 'Supabase pendente'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={logout}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Telegram */}
          <div className="rounded-lg border-l-4 border-blue-500 bg-white p-4 shadow-sm transition hover:shadow-md">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Telegram</h2>
                <p className="text-sm text-slate-500">Receba lembretes de reuniões e confirme presença pelo Telegram.</p>
              </div>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${telegramLinked ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
                {telegramLinked ? 'Vinculado' : 'Não vinculado'}
              </span>
            </div>

            {telegramLinked ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">Sua conta está vinculada ao Telegram. Você receberá notificações de reuniões diretamente no app.</p>
                <button
                  type="button"
                  onClick={handleUnlinkTelegram}
                  disabled={telegramLoading}
                  className="rounded-2xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                >
                  {telegramLoading ? 'Aguarde...' : 'Desvincular Telegram'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Para vincular, envie o comando abaixo para o bot no Telegram:
                </p>
                {telegramLinkToken ? (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-xl bg-slate-50 px-4 py-3 text-sm font-mono text-slate-800 ring-1 ring-slate-200 select-all">
                      /vincular {telegramLinkToken}
                    </code>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(`/vincular ${telegramLinkToken}`)}
                      className="shrink-0 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-500 transition hover:bg-slate-50"
                      title="Copiar"
                    >
                      📋
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">Nenhum código gerado ainda.</p>
                )}
                <button
                  type="button"
                  onClick={handleGenerateLinkToken}
                  disabled={telegramLoading}
                  className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {telegramLoading ? 'Gerando...' : telegramLinkToken ? 'Gerar novo código' : 'Gerar código de vinculação'}
                </button>
              </div>
            )}

            {telegramMessage.text && (
              <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${telegramMessage.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                {telegramMessage.text}
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="rounded-lg border-l-4 border-blue-500 bg-white p-4 shadow-sm transition hover:shadow-md">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Google Calendar</h2>
                  <p className="text-sm text-slate-500">Sincronização segura via Supabase Edge Function.</p>
                </div>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${isGoogleCalendarConfigured ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}`}>
                  {isGoogleCalendarConfigured ? 'Proxy ativo' : 'Pendente'}
                </span>
              </div>

              <div className="space-y-2 text-sm text-slate-600">
                <p>As credenciais sensíveis do Google ficam no backend da função segura do Supabase, e não no frontend.</p>
                <div className="rounded-2xl bg-slate-50 p-4 text-slate-700 ring-1 ring-slate-200">
                  <p><strong>Secrets do backend:</strong></p>
                  <p>GOOGLE_CLIENT_ID</p>
                  <p>GOOGLE_CLIENT_SECRET</p>
                  <p>GOOGLE_CALENDAR_ID</p>
                  <p>GOOGLE_OAUTH_TOKEN_URL</p>
                </div>
                <p>Você pode usar refresh token ou fluxo OAuth com usuário e senha, ambos protegidos no servidor.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Aba: Google Drive */}
      {activeTab === 'drive' && isAdmin && (
        <div className="rounded-lg border-l-4 border-blue-500 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Pastas do Google Drive</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Configure o caminho de destino das atas por tipo de reunião. Use o formato{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-700">
                Pasta Raiz/Subpasta/2026
              </code>
              . As pastas serão criadas automaticamente se não existirem.
            </p>
          </div>

          <form onSubmit={handleSaveDriveSettings} className="space-y-4">
            <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="w-2/5 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Tipo de reunião
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Caminho no Drive
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(MEETING_TYPE_LABELS).map(([type, label]) => (
                    <tr key={type} className="group">
                      <td className="px-4 py-3 font-medium text-slate-700 align-middle">
                        {label}
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        <input
                          type="text"
                          value={folderPaths[type] || ''}
                          onChange={(e) =>
                            setFolderPaths((prev) => ({ ...prev, [type]: e.target.value }))
                          }
                          placeholder="Ex: Estaca Nome/Secretaria/Atas_Tipo/2026"
                          disabled={!isConfigured || driveSaving}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {driveMessage.text && (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${driveMessage.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
                  }`}
              >
                {driveMessage.text}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={!isConfigured || !user?.organizationId || driveSaving}
                className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {driveSaving ? 'Salvando…' : 'Salvar pastas'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Aba: Trello */}
      {activeTab === 'trello' && isAdmin && (
        <div className="rounded-lg border-l-4 border-blue-500 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Trello</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Tarefas identificadas nas atas serão criadas automaticamente como cards no Trello.
              Gere sua chave e token em{' '}
              <a
                href="https://trello.com/app-key"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-blue-600 hover:underline"
              >
                trello.com/app-key
              </a>.
            </p>
          </div>

          <form onSubmit={handleSaveTrelloSettings} className="space-y-4">
            <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="w-1/3 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Credencial
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-3 font-medium text-slate-700 align-middle">API Key</td>
                    <td className="px-4 py-2.5 align-middle">
                      <input
                        type="text"
                        value={trelloApiKey}
                        onChange={(e) => setTrelloApiKey(e.target.value)}
                        placeholder="Chave da API do Trello"
                        disabled={!isConfigured || trelloSaving}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-slate-700 align-middle">Token</td>
                    <td className="px-4 py-2.5 align-middle">
                      <input
                        type="password"
                        value={trelloToken}
                        onChange={(e) => setTrelloToken(e.target.value)}
                        placeholder="Token de acesso do Trello"
                        disabled={!isConfigured || trelloSaving}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="w-1/3 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Tipo de reunião
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      ID da lista Trello
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(MEETING_TYPE_LABELS).map(([type, label]) => (
                    <tr key={type}>
                      <td className="px-4 py-3 font-medium text-slate-700 align-middle">{label}</td>
                      <td className="px-4 py-2.5 align-middle">
                        <input
                          type="text"
                          value={trelloListMap[type] || ''}
                          onChange={(e) =>
                            setTrelloListMap((prev) => ({ ...prev, [type]: e.target.value }))
                          }
                          placeholder="ex: 664abc123def456..."
                          disabled={!isConfigured || trelloSaving}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {trelloMessage.text && (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${trelloMessage.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
                  }`}
              >
                {trelloMessage.text}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={!isConfigured || !user?.organizationId || trelloSaving}
                className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {trelloSaving ? 'Salvando…' : 'Salvar configurações Trello'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Aba: Usuários */}
      {activeTab === 'usuarios' && isAdmin && (
        <div className="rounded-lg border-l-4 border-blue-500 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Usuários</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Defina quais tipos de reunião cada usuário deve receber notificações. Sem seleção = recebe todos os tipos.
            </p>
          </div>

          {orgUsersLoading ? (
            <p className="py-6 text-center text-sm text-slate-400">Carregando…</p>
          ) : orgUsers.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Nenhum usuário encontrado.</p>
          ) : (
            <ul className="space-y-3">
              {orgUsers.map((u) => {
                const types = u.notification_meeting_types || []
                const isSaving = savingUserId === u.id
                return (
                  <li key={u.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-slate-900">{u.full_name}</span>
                      <span className="text-xs text-slate-400">{u.email}</span>
                      {u.telegram_chat_id ? (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">✓ Telegram</span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-500">Sem Telegram</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {meetingTypeOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleToggleUserMeetingType(u.id, types, opt.value)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${types.includes(opt.value) ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                      {types.length === 0 && (
                        <span className="text-xs text-slate-400 italic self-center">Todos os tipos (padrão)</span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* Aba: Contatos Externos */}
      {activeTab === 'contatos' && isAdmin && (
        <div className="rounded-lg border-l-4 border-blue-500 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Contatos Externos</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Líderes sem login na aplicação que receberão lembretes via Telegram.
              </p>
            </div>
            {!showAddContact && (
              <button
                onClick={() => setShowAddContact(true)}
                className="shrink-0 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                + Adicionar
              </button>
            )}
          </div>

          {contactMessage.text && (
            <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${contactMessage.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {contactMessage.text}
            </div>
          )}

          {/* Formulário de adição */}
          {showAddContact && (
            <form onSubmit={handleAddContact} className="mb-5 space-y-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <h3 className="font-semibold text-slate-800">Novo contato</h3>
              <p className="text-xs text-slate-500">
                Peça à pessoa para enviar <code className="rounded bg-slate-200 px-1">/start</code> para o bot e informe o código de 8 letras gerado.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Nome completo *</label>
                  <input
                    type="text"
                    required
                    value={newContact.fullName}
                    onChange={(e) => setNewContact((p) => ({ ...p, fullName: e.target.value }))}
                    placeholder="Ex: João da Silva"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Cargo</label>
                  <input
                    type="text"
                    value={newContact.role}
                    onChange={(e) => setNewContact((p) => ({ ...p, role: e.target.value }))}
                    placeholder="Ex: Bispo, Presidente de Rama"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Tipos de reunião que deve receber *</label>
                <div className="flex flex-wrap gap-2">
                  {meetingTypeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleMeetingType(opt.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${newContact.meetingTypes.includes(opt.value) ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Código do Telegram *</label>
                <input
                  type="text"
                  required
                  value={newContact.linkCode}
                  onChange={(e) => setNewContact((p) => ({ ...p, linkCode: e.target.value.toUpperCase() }))}
                  placeholder="Ex: AB3C5D7E"
                  maxLength={8}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <p className="mt-1 text-xs text-slate-400">Código gerado quando a pessoa envia /start ao bot.</p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={contactSaving || !newContact.fullName || !newContact.linkCode || newContact.meetingTypes.length === 0}
                  className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {contactSaving ? 'Salvando…' : 'Salvar contato'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddContact(false); setNewContact({ fullName: '', role: '', meetingTypes: [], linkCode: '' }) }}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Lista de contatos */}
          {contactsLoading ? (
            <p className="py-6 text-center text-sm text-slate-400">Carregando…</p>
          ) : contacts.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Nenhum contato externo cadastrado.</p>
          ) : (
            <ul className="space-y-2">
              {contacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 truncate">{c.full_name}</span>
                      {c.telegram_chat_id ? (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">✓ Vinculado</span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Aguardando /start</span>
                      )}
                    </div>
                    {c.role && <p className="mt-0.5 text-xs text-slate-500">{c.role}</p>}
                    {c.meeting_types?.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {c.meeting_types.map((mt) => (
                          <span key={mt} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                            {meetingTypeOptions.find((o) => o.value === mt)?.label || mt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveContact(c.id, c.full_name)}
                    className="shrink-0 rounded-xl border border-red-100 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Aba: Prompt de IA */}
      {activeTab === 'prompt' && isAdmin && (
        <div className="rounded-lg border-l-4 border-blue-500 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Prompt de Geração de Atas</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Instruções enviadas ao modelo de IA ao gerar cada ata. Defina o formato, as seções e o estilo esperados.
            </p>
          </div>

          <form onSubmit={handleSavePromptSettings} className="space-y-4">
            <textarea
              value={minutesPrompt}
              onChange={(e) => setMinutesPrompt(e.target.value)}
              rows={14}
              disabled={!isConfigured || promptSaving}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
            />

            {promptMessage.text && (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${promptMessage.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
                  }`}
              >
                {promptMessage.text}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setMinutesPrompt(DEFAULT_MINUTES_PROMPT)}
                disabled={!isConfigured || promptSaving}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Restaurar padrão
              </button>
              <button
                type="submit"
                disabled={!isConfigured || !user?.organizationId || promptSaving || !minutesPrompt.trim()}
                className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {promptSaving ? 'Salvando…' : 'Salvar prompt'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}