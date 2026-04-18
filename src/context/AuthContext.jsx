import { createContext, useEffect, useMemo, useState } from 'react'

const AuthContext = createContext(undefined)
const TOKEN_KEY = 'meeting_agenda_token'
const USER_KEY = 'meeting_agenda_user'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem(USER_KEY)
    return saved ? JSON.parse(saved) : null
  })

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  }, [token])

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(USER_KEY)
    }
  }, [user])

  const login = async (email, password) => {
    if (!email || !password) {
      throw new Error('Informe email e senha.')
    }

    const fakeToken = `session-${Date.now()}`
    const profile = {
      name: email.split('@')[0],
      email,
    }

    setToken(fakeToken)
    setUser(profile)
    return profile
  }

  const logout = () => {
    setToken(null)
    setUser(null)
  }

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext
