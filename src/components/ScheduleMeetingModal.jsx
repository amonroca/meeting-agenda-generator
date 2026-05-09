import { useEffect, useState } from 'react'

export default function ScheduleMeetingModal({ meetingTypeOptions = [], onClose, onSuccess }) {
    const [title, setTitle] = useState('')
    const [meetingType, setMeetingType] = useState('')
    const [startAt, setStartAt] = useState('')
    const [endAt, setEndAt] = useState('')
    const [location, setLocation] = useState('')
    const [description, setDescription] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Fecha com Escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !loading) onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [loading, onClose])

    // Quando o início muda, ajusta o fim para +1h se estiver vazio ou anterior ao início
    function handleStartAtChange(value) {
        setStartAt(value)
        if (value) {
            const start = new Date(value)
            const end = endAt ? new Date(endAt) : null
            if (!end || end <= start) {
                const suggested = new Date(start.getTime() + 60 * 60 * 1000)
                const pad = (n) => String(n).padStart(2, '0')
                setEndAt(
                    `${suggested.getFullYear()}-${pad(suggested.getMonth() + 1)}-${pad(suggested.getDate())}T${pad(suggested.getHours())}:${pad(suggested.getMinutes())}`
                )
            }
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')

        if (!title.trim()) { setError('Informe o título da reunião.'); return }
        if (!startAt) { setError('Informe a data e hora de início.'); return }
        if (!endAt) { setError('Informe a data e hora de término.'); return }
        if (new Date(endAt) <= new Date(startAt)) {
            setError('O término deve ser depois do início.')
            return
        }

        setLoading(true)
        try {
            await onSuccess({
                summary: title.trim(),
                startAt: new Date(startAt).toISOString(),
                endAt: new Date(endAt).toISOString(),
                location: location.trim() || undefined,
                description: description.trim() || undefined,
            })
        } catch (err) {
            setError(err.message || 'Erro ao agendar a reunião.')
            setLoading(false)
        }
    }

    const typeOptions = meetingTypeOptions.filter((o) => o.value)

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
            onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}
        >
            <div className="w-full max-w-lg rounded-3xl bg-white shadow-xl ring-1 ring-slate-200">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Agendar reunião</h2>
                        <p className="mt-0.5 text-sm text-slate-500">O evento será criado no Google Calendar.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
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
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Título <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ex: Reunião de Presidência da Estaca"
                            disabled={loading}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                        />
                    </div>

                    {/* Tipo de reunião (informativo) */}
                    {typeOptions.length > 0 && (
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-700">Tipo de reunião</label>
                            <select
                                value={meetingType}
                                onChange={(e) => setMeetingType(e.target.value)}
                                disabled={loading}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                            >
                                <option value="">Selecione (opcional)</option>
                                {typeOptions.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Início / Fim */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                Início <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="datetime-local"
                                value={startAt}
                                onChange={(e) => handleStartAtChange(e.target.value)}
                                disabled={loading}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                Término <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="datetime-local"
                                value={endAt}
                                onChange={(e) => setEndAt(e.target.value)}
                                disabled={loading}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                            />
                        </div>
                    </div>

                    {/* Local */}
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Local</label>
                        <input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="Ex: Sede da Estaca"
                            disabled={loading}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                        />
                    </div>

                    {/* Descrição */}
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Descrição</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            placeholder="Pauta, informações adicionais…"
                            disabled={loading}
                            className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                        />
                    </div>

                    {error && (
                        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>
                    )}

                    {/* Ações */}
                    <div className="flex justify-end gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                        >
                            {loading ? 'Agendando…' : 'Agendar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
