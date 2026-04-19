import { useEffect, useState } from 'react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function EmailConfirmationPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, loading, user } = useAuth()
  const [countdown, setCountdown] = useState(10)

  const email = location.state?.email || user?.email
  const fullName = location.state?.fullName || user?.name

  useEffect(() => {
    if (!isAuthenticated) {
      setCountdown(10)
      return undefined
    }

    setCountdown(10)

    const intervalId = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId)
          return 0
        }

        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated && countdown === 0) {
      navigate('/dashboard', { replace: true })
    }
  }, [countdown, isAuthenticated, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 px-4 py-10">
      <div className="mx-auto w-full max-w-xl rounded-3xl bg-white p-8 shadow-xl ring-1 ring-slate-200">
        <div className="mb-3 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
          Validação de e-mail
        </div>

        <h1 className="text-3xl font-bold text-slate-900">
          {isAuthenticated ? 'E-mail confirmado com sucesso' : 'Confirme seu e-mail'}
        </h1>

        <p className="mt-2 text-slate-600">
          {fullName ? `Quase lá, ${fullName}.` : 'Sua conta foi criada com sucesso.'}
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          {loading ? (
            <span>Validando o link de confirmação...</span>
          ) : isAuthenticated ? (
            <span>
              O e-mail <span className="font-semibold">{email || 'informado'}</span> foi validado.
            </span>
          ) : (
            <span>
              Enviamos um link de confirmação para <span className="font-semibold">{email || 'o e-mail informado'}</span>.
            </span>
          )}
        </div>

        {isAuthenticated ? (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-800">
            Você será redirecionado automaticamente para a aplicação em{' '}
            <span className="font-bold">{countdown}</span> segundo(s).
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            Acesse sua caixa de entrada, clique no link enviado pelo Supabase e depois volte para entrar na plataforma.
          </p>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <RouterLink
            to="/login"
            className="rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Ir para o login
          </RouterLink>
          <RouterLink
            to="/register"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cadastrar outro e-mail
          </RouterLink>
        </div>
      </div>
    </div>
  )
}
