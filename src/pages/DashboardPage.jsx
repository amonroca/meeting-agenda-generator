import { Box, Chip, Stack, Typography } from '@mui/material'
import Card from '../components/Card'

const stats = [
  { label: 'Reuniões hoje', value: '08', color: 'primary.main' },
  { label: 'Tarefas abertas', value: '14', color: 'secondary.main' },
  { label: 'Atas geradas', value: '32', color: 'success.main' },
]

const upcomingMeetings = [
  { title: 'Planejamento semanal', time: '09:00', status: 'Confirmada' },
  { title: 'Review de produto', time: '11:30', status: 'Em preparação' },
  { title: 'Alinhamento com marketing', time: '15:00', status: 'Nova ata' },
]

export default function DashboardPage() {
  return (
    <Stack spacing={3} sx={{ pt: { xs: 6, md: 0 } }}>
      <Box>
        <Typography variant="h4">Dashboard</Typography>
        <Typography color="text.secondary">
          Acompanhe o panorama das suas reuniões e entregas.
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 2,
        }}
      >
        {stats.map((item) => (
          <Card key={item.label}>
            <Typography color="text.secondary" gutterBottom>
              {item.label}
            </Typography>
            <Typography variant="h4" sx={{ color: item.color }}>
              {item.value}
            </Typography>
          </Card>
        ))}
      </Box>

      <Card>
        <Stack spacing={2}>
          <Typography variant="h6">Próximas reuniões</Typography>
          {upcomingMeetings.map((meeting) => (
            <Box
              key={meeting.title}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', sm: 'center' },
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 1,
                p: 1.5,
                borderRadius: 3,
                bgcolor: '#f8fafc',
              }}
            >
              <Box>
                <Typography fontWeight={600}>{meeting.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {meeting.time}
                </Typography>
              </Box>
              <Chip label={meeting.status} color="primary" variant="outlined" />
            </Box>
          ))}
        </Stack>
      </Card>
    </Stack>
  )
}
