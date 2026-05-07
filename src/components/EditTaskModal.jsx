import { useEffect, useMemo, useRef, useState } from 'react'
import { getTrelloBoardLists, updateTrelloCard, deleteTrelloCard, sendTaskNotification, getTelegramUsers } from '../services/meetingMinutes'

export default function EditTaskModal({ task, organizationId, onClose, onSave, onDelete, onNotify }) {
    const [name, setName] = useState(task.name || '')
    const [responsible, setResponsible] = useState(task.responsible || '')
    const [desc, setDesc] = useState(task.description || '')
    const [idList, setIdList] = useState(task.statusListId || '')
    const [lists, setLists] = useState([])
    const [listsLoading, setListsLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [notifying, setNotifying] = useState(false)
    const [notificationsCount, setNotificationsCount] = useState(task.notificationsCount ?? 0)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [error, setError] = useState('')
    // Picker de destinatário Telegram
    const [showNotifyPicker, setShowNotifyPicker] = useState(false)
    const [telegramUsers, setTelegramUsers] = useState([])
    const [loadingTelegramUsers, setLoadingTelegramUsers] = useState(false)
    const [pickerSearch, setPickerSearch] = useState('')
    const [selectedUser, setSelectedUser] = useState(null)
    const nameRef = useRef(null)
    const pickerSearchRef = useRef(null)

    const filteredUsers = useMemo(() => {
        const q = pickerSearch.toLowerCase().trim()
        if (!q) return telegramUsers
        return telegramUsers.filter((u) => u.name.toLowerCase().includes(q))
    }, [telegramUsers, pickerSearch])

    // Foca no título ao abrir
    useEffect(() => {
        nameRef.current?.focus()
    }, [])

    // Fecha com Escape (fecha picker primeiro, depois o modal)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (showNotifyPicker) { setShowNotifyPicker(false); return }
                if (!saving && !deleting) onClose()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [saving, deleting, onClose, showNotifyPicker])

    // Carrega as listas do board
    useEffect(() => {
        setListsLoading(true)
        getTrelloBoardLists(organizationId, task.id)
            .then(setLists)
            .catch(() => setLists([]))
            .finally(() => setListsLoading(false))
    }, [organizationId, task.id])

    async function handleOpenNotifyPicker() {
        setShowNotifyPicker(true)
        setPickerSearch('')
        setSelectedUser(null)
        setLoadingTelegramUsers(true)
        try {
            const users = await getTelegramUsers(organizationId)
            setTelegramUsers(users)
        } catch {
            setTelegramUsers([])
        } finally {
            setLoadingTelegramUsers(false)
            setTimeout(() => pickerSearchRef.current?.focus(), 50)
        }
    }

    async function handleSendNotification() {
        if (!selectedUser) return
        setNotifying(true)
        setError('')
        try {
            const result = await sendTaskNotification({
                organizationId,
                cardId: task.id,
                minuteId: task.minuteId,
                cardName: name.trim() || task.name,
                meetingTitle: task.meetingTitle || task.meetingTypeLabel || '',
                description: desc.trim() || undefined,
                recipientChatId: selectedUser.chatId,
                recipientName: selectedUser.name,
            })
            const newCount = result.notificationsCount ?? notificationsCount + 1
            setNotificationsCount(newCount)
            onNotify?.(task.id, newCount)
            setShowNotifyPicker(false)
        } catch (err) {
            setError(err.message || 'Falha ao enviar notificação.')
            setShowNotifyPicker(false)
        } finally {
            setNotifying(false)
        }
    }

    async function handleDelete() {
        setDeleting(true)
        setConfirmDelete(false)
        setError('')
        try {
            await deleteTrelloCard({
                organizationId,
                cardId: task.id,
                minuteId: task.minuteId,
            })
            onDelete(task.id)
        } catch (err) {
            setError(err.message || 'Falha ao remover. Tente novamente.')
        } finally {
            setDeleting(false)
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!name.trim()) { setError('O título é obrigatório.'); return }
        setError('')
        setSaving(true)
        try {
            const updated = await updateTrelloCard({
                organizationId,
                cardId: task.id,
                minuteId: task.minuteId,
                name: name.trim(),
                responsible: responsible.trim(),
                desc,
                idList: idList || undefined,
            })
            const updatedList = lists.find((l) => l.id === updated.idList)
            onSave({
                ...task,
                name: updated.name,
                responsible: responsible.trim(),
                description: updated.desc,
                idList: updated.idList,
                statusListId: updated.idList,
                status: updatedList?.name ?? task.status,
                url: updated.url || task.url,
            })
        } catch (err) {
            setError(err.message || 'Falha ao salvar. Tente novamente.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
            onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}
        >
            <div className="w-full max-w-2xl rounded-3xl bg-white shadow-xl ring-1 ring-slate-200">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Editar tarefa</h2>
                        <a
                            href={task.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-0.5 block text-xs text-blue-600 hover:underline"
                        >
                            Ver no Trello
                        </a>
                    </div>
                    <div className="flex items-center gap-3">
                        {notificationsCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200" title="Notificações enviadas">
                                📨 {notificationsCount}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="mt-0.5 rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:pointer-events-none"
                            aria-label="Fechar"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
                    {/* Título */}
                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">
                            Título <span className="text-red-500">*</span>
                        </span>
                        <input
                            ref={nameRef}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={saving}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                        />
                    </label>

                    {/* Responsável */}
                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Responsável</span>
                        <input
                            type="text"
                            value={responsible}
                            onChange={(e) => setResponsible(e.target.value)}
                            disabled={saving}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                        />
                    </label>

                    {/* Status / Lista */}
                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Status (lista)</span>
                        {listsLoading ? (
                            <div className="h-10 animate-pulse rounded-2xl bg-slate-100" />
                        ) : lists.length === 0 ? (
                            <p className="text-xs text-slate-400">Listas indisponíveis — verifique as credenciais do Trello.</p>
                        ) : (
                            <select
                                value={idList}
                                onChange={(e) => setIdList(e.target.value)}
                                disabled={saving}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                            >
                                {lists.map((l) => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                            </select>
                        )}
                    </label>

                    {/* Descrição */}
                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Descrição</span>
                        <textarea
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                            rows={8}
                            disabled={saving}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                        />
                    </label>

                    {error && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-between gap-3 border-t border-slate-100 pt-4">
                        <button
                            type="button"
                            onClick={() => setConfirmDelete(true)}
                            disabled={saving || deleting || notifying}
                            className="rounded-2xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {deleting ? 'Removendo…' : 'Remover'}
                        </button>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleOpenNotifyPicker}
                                disabled={notifying || saving || deleting}
                                title="Enviar notificação pelo Telegram"
                                className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {notifying ? 'Enviando…' : '📨 Notificar'}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={saving || deleting}
                                className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={saving || deleting || !name.trim()}
                                className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {saving ? 'Salvando…' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Picker de destinatário Telegram */}
            {showNotifyPicker && (
                <div
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowNotifyPicker(false) }}
                >
                    <div className="flex w-full max-w-sm flex-col rounded-3xl bg-white shadow-xl ring-1 ring-slate-200">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                            <h3 className="text-base font-semibold text-slate-900">Notificar via Telegram</h3>
                            <button
                                type="button"
                                onClick={() => setShowNotifyPicker(false)}
                                className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                aria-label="Fechar"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                                </svg>
                            </button>
                        </div>
                        {/* Busca */}
                        <div className="px-4 pt-4">
                            <input
                                ref={pickerSearchRef}
                                type="text"
                                placeholder="Buscar pessoa…"
                                value={pickerSearch}
                                onChange={(e) => setPickerSearch(e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                        </div>
                        {/* Lista */}
                        <div className="max-h-56 overflow-y-auto px-4 py-3">
                            {loadingTelegramUsers ? (
                                <div className="space-y-2">
                                    {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-2xl bg-slate-100" />)}
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <p className="py-4 text-center text-sm text-slate-400">
                                    {telegramUsers.length === 0 ? 'Nenhum usuário com Telegram vinculado.' : 'Nenhum resultado.'}
                                </p>
                            ) : (
                                <div className="space-y-1">
                                    {filteredUsers.map((u) => (
                                        <button
                                            key={u.chatId}
                                            type="button"
                                            onClick={() => setSelectedUser(u)}
                                            className={`flex w-full items-center justify-between rounded-2xl px-4 py-2.5 text-left text-sm transition ${selectedUser?.chatId === u.chatId
                                                    ? 'bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200'
                                                    : 'hover:bg-slate-50 text-slate-700'
                                                }`}
                                        >
                                            <span className="font-medium">{u.name}</span>
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.type === 'member' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                                {u.type === 'member' ? 'Membro' : 'Externo'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Footer */}
                        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                            <button
                                type="button"
                                onClick={() => setShowNotifyPicker(false)}
                                className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSendNotification}
                                disabled={!selectedUser || notifying}
                                className="rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {notifying ? 'Enviando…' : 'Enviar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmação de remoção */}
            {confirmDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="w-full max-w-sm rounded-3xl bg-white shadow-xl ring-1 ring-slate-200">
                        <div className="px-6 py-5">
                            <h3 className="text-base font-semibold text-slate-900">Remover tarefa</h3>
                            <p className="mt-2 text-sm text-slate-600">
                                Esta ação removerá o card do Trello e da ata. Não pode ser desfeita.
                            </p>
                        </div>
                        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                            <button
                                type="button"
                                onClick={() => setConfirmDelete(false)}
                                className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="rounded-2xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                            >
                                Sim, remover
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
