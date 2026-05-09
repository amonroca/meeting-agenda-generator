import { useEffect, useRef, useState } from 'react'
import { getTrelloBoardLists, updateTrelloCard } from '../services/meetingMinutes'

export default function EditTaskModal({ task, organizationId, onClose, onSave }) {
    const [name, setName] = useState(task.name || '')
    const [responsible, setResponsible] = useState(task.responsible || '')
    const [desc, setDesc] = useState(task.description || '')
    const [idList, setIdList] = useState(task.statusListId || '')
    const [lists, setLists] = useState([])
    const [listsLoading, setListsLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const nameRef = useRef(null)

    // Foca no título ao abrir
    useEffect(() => {
        nameRef.current?.focus()
    }, [])

    // Fecha com Escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (!saving) onClose()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [saving, onClose])

    // Carrega as listas do board
    useEffect(() => {
        setListsLoading(true)
        getTrelloBoardLists(organizationId, task.id)
            .then(setLists)
            .catch(() => setLists([]))
            .finally(() => setListsLoading(false))
    }, [organizationId, task.id])

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

                    <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !name.trim()}
                            className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving ? 'Salvando…' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
