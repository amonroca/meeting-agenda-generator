import { useEffect, useRef, useState } from 'react'
import { generateMeetingMinutes } from '../services/meetingMinutes'

const MIN_TRANSCRIPT_LENGTH = 50

export default function GenerateMinutesModal({ meeting, organizationId, onClose, onSuccess }) {
    const [transcript, setTranscript] = useState('')
    const [attendees, setAttendees] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const textareaRef = useRef(null)

    // Foca no textarea ao abrir
    useEffect(() => {
        textareaRef.current?.focus()
    }, [])

    // Fecha com Escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !loading) onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [loading, onClose])

    async function handleSubmit(e) {
        e.preventDefault()

        if (transcript.trim().length < MIN_TRANSCRIPT_LENGTH) {
            setError(`A transcrição deve ter pelo menos ${MIN_TRANSCRIPT_LENGTH} caracteres.`)
            return
        }

        setError('')
        setLoading(true)

        try {
            const attendeeList = attendees
                .split(',')
                .map((a) => a.trim())
                .filter(Boolean)

            const result = await generateMeetingMinutes({
                googleEventId: meeting.id,
                title: meeting.title,
                meetingType: meeting.meetingType,
                meetingAt: meeting.startAt,
                transcript: transcript.trim(),
                organizationId,
                attendees: attendeeList,
            })

            onSuccess(result)
        } catch (err) {
            setError(err.message || 'Erro ao gerar a ata. Tente novamente.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
            onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}
        >
            <div className="w-full max-w-2xl rounded-3xl bg-white shadow-xl ring-1 ring-slate-200">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Gerar ata</h2>
                        <p className="mt-0.5 text-sm text-slate-500 line-clamp-1">{meeting.title}</p>
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
                <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">
                            Transcrição da reunião <span className="text-red-500">*</span>
                        </span>
                        <textarea
                            ref={textareaRef}
                            value={transcript}
                            onChange={(e) => setTranscript(e.target.value)}
                            rows={10}
                            placeholder="Cole aqui a transcrição completa da reunião..."
                            disabled={loading}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                        />
                        <span className="mt-1 block text-right text-xs text-slate-400">
                            {transcript.length} caracteres
                        </span>
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">
                            Participantes <span className="text-slate-400 font-normal">(opcional, separados por vírgula)</span>
                        </span>
                        <input
                            type="text"
                            value={attendees}
                            onChange={(e) => setAttendees(e.target.value)}
                            placeholder="Ex: João Silva, Maria Santos, Pedro Oliveira"
                            disabled={loading}
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
                            disabled={loading}
                            className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || transcript.trim().length < MIN_TRANSCRIPT_LENGTH}
                            className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading ? 'Gerando ata…' : 'Gerar ata'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
