import { Avatar, Box, Stack, Typography } from '@mui/material'
import Button from '../components/Button'
import Card from '../components/Card'
import { useAuth } from '../hooks/useAuth'

export default function SettingsPage() {
  const { user, logout } = useAuth()

  return (
    <Stack spacing={3} sx={{ pt: { xs: 6, md: 0 } }}>
      <Box>
        <Typography variant="h4">Configurações</Typography>
        <Typography color="text.secondary">
          Gerencie seu perfil e finalize a sessão com segurança.
        </Typography>
      </Box>

      <Card>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
            {(user?.name || 'U').charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">{user?.name || 'Usuário'}</Typography>
            <Typography color="text.secondary">{user?.email}</Typography>
          </Box>
          <Button color="inherit" onClick={logout} sx={{ bgcolor: '#eef2ff' }}>
            Logout
          </Button>
        </Stack>
      </Card>
    </Stack>
  )
}
