import { useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function RegisterPage() {
  const { register, isConfigured } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const passwordsDoNotMatch = useMemo(() => {
    return confirmPassword.length > 0 && password !== confirmPassword
  }, [password, confirmPassword])

  const isFormInvalid =
    !fullName.trim() || !email.trim() || !password || !confirmPassword || passwordsDoNotMatch

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!fullName.trim()) {
      setError('Informe o nome completo.')
      return
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas informadas devem ser iguais.')
      return
    }

    setLoading(true)

    try {
      const result = await register(fullName.trim(), email.trim(), password)

      if (result?.session) {
        navigate('/dashboard', { replace: true })
        return
      }

      navigate('/email-confirmation', {
        replace: true,
        state: {
          email: email.trim(),
          fullName: fullName.trim(),
        },
      })
    } catch (err) {
      setError(err.message || 'Falha ao criar conta.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 px-4 py-10">
      <div className="mx-auto w-full max-w-xl rounded-3xl bg-white p-8 shadow-xl ring-1 ring-slate-200">
        <div>
          <div className="mb-3 inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
            Novo cadastro
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Criar conta</h1>
          <p className="mt-2 text-sm text-slate-500">
            Cadastre-se para acessar a plataforma e acompanhar reuniões, atas e tarefas.
          </p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!isConfigured && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              O Supabase ainda não está disponível no ambiente desta aplicação.
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Nome completo</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Seu nome completo"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@exemplo.com"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Senha</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo de 6 caracteres"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Confirmar senha
              </span>
              <input
                className={`w-full rounded-2xl border bg-white px-4 py-3 text-slate-900 outline-none transition focus:ring-4 ${
                  passwordsDoNotMatch
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'
                }`}
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repita a senha"
              />
            </label>
          </div>

          {passwordsDoNotMatch && (
            <p className="text-sm font-medium text-red-600">As senhas precisam ser iguais.</p>
          )}

          <button
            type="submit"
            disabled={loading || !isConfigured || isFormInvalid}
            className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Já possui uma conta?{' '}
          <RouterLink to="/login" className="font-semibold text-blue-700 hover:text-blue-600">
            Voltar para o login
          </RouterLink>
        </p>
      </div>
    </div>
  )
}
