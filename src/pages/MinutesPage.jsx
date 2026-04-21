import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { formatCalendarDate } from '../services/googleCalendar'
import { listMeetingMinutes, listMeetingTypeOptions } from '../services/meetingMinutes'

const defaultMeetingTypeOptions = [
    { value: '', label: 'Todos os tipos' },
]

function statusLabel(status) {
    switch (status) {
        case 'ready': return 'Pronta'
        case 'processing': return 'Gerando...'
        case 'failed': return 'Falhou'
        case 'archived': return 'Arquivada'
        default: return status ?? 'Pronta'
    }
}

function statusClasses(status) {
    switch (status) {
        case 'ready': return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
        case 'processing': return 'bg-amber-50 text-amber-700 ring-amber-200'
        case 'failed': return 'bg-red-50 text-red-700 ring-red-200'
        default: return 'bg-slate-100 text-slate-600 ring-slate-200'
    }
}

function formatAttendees(attendees) {
    if (!attendees) return null
    const list = Array.isArray(attendees) ? attendees : []
    return list.length > 0 ? list.join(', ') : null
}

export default function MinutesPage() {
    const { isConfigured } = useAuth()
    const [minutes, setMinutes] = useState([])
    const [meetingTypeOptions, setMeetingTypeOptions] = useState(defaultMeetingTypeOptions)
    const [filterType, setFilterType] = useState('')
    const [filterStartDate, setFilterStartDate] = useState('')
    const [filterEndDate, setFilterEndDate] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        listMeetingTypeOptions()
            .then((options) => {
                setMeetingTypeOptions([
                    { value: '', label: 'Todos os tipos' },
                    ...options,
                ])
            })
            .catch(() => { })
    }, [])

    const loadMinutes = useCallback(async () => {
        if (!isConfigured) {
            setMinutes([])
            setLoading(false)
            return
        }

        setLoading(true)
        setError('')

        try {
            const data = await listMeetingMinutes({
                meetingType: filterType || undefined,
                startDate: filterStartDate || undefined,
                endDate: filterEndDate || undefined,
            })
            setMinutes(data)
        } catch (err) {
            setError(err.message || 'Não foi possível carregar as atas.')
        } finally {
            setLoading(false)
        }
    }, [isConfigured, filterType, filterStartDate, filterEndDate])

    useEffect(() => {
        void loadMinutes()
    }, [loadMinutes])

    const handleClearFilters = () => {
        setFilterType('')
        setFilterStartDate('')
        setFilterEndDate('')
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Atas</h1>
                <p className="mt-2 text-slate-600">
                    Atas de reuniões geradas e salvas no Google Drive.
                </p>
            </div>

            {!isConfigured && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    Configure o Supabase para visualizar as atas geradas.
                </div>
            )}

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Filtros */}
            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,160px)_minmax(0,160px)_auto] lg:items-end">
                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Tipo de reunião</span>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        >
                            {meetingTypeOptions.map((opt) => (
                                <option key={opt.value || 'all'} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Data inicial</span>
                        <input
                            type="date"
                            value={filterStartDate}
                            onChange={(e) => setFilterStartDate(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Data final</span>
                        <input
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                    </label>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => void loadMinutes()}
                            disabled={loading}
                            className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Atualizar
                        </button>
                        <button
                            type="button"
                            onClick={handleClearFilters}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                            Limpar
                        </button>
                    </div>
                </div>
            </div>

            {/* Lista de atas */}
            {loading ? (
                <div className="rounded-3xl bg-white px-4 py-12 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
                    Carregando atas...
                </div>
            ) : minutes.length === 0 ? (
                <div className="rounded-3xl bg-white px-4 py-12 text-center text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
                    Nenhuma ata encontrada para os filtros selecionados.
                </div>
            ) : (
                <div className="space-y-3">
                    {minutes.map((minute) => {
                        const attendees = formatAttendees(minute.attendees)
                        return (
                            <div key={minute.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="truncate text-lg font-semibold text-slate-900">{minute.title}</h3>
                                        <p className="mt-1 text-sm text-slate-500">{minute.meeting_type_label}</p>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Data: {formatCalendarDate(minute.meeting_at)}
                                        </p>
                                        {attendees && (
                                            <p className="mt-1 text-sm text-slate-500">
                                                Presentes: {attendees}
                                            </p>
                                        )}
                                        {minute.drive_file_url && (
                                            <a
                                                href={minute.drive_file_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                                            >
                                                Abrir no Google Drive
                                            </a>
                                        )}
                                    </div>

                                    <div className="shrink-0">
                                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClasses(minute.generation_status)}`}>
                                            {statusLabel(minute.generation_status)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
