import { Box, Chip, Stack, Typography } from '@mui/material'
import Card from '../components/Card'

const meetings = [
  { title: 'Kickoff Q2', owner: 'Ana Rocha', date: '18/04/2026', status: 'Finalizada' },
  { title: 'Sprint Review', owner: 'Time Produto', date: '17/04/2026', status: 'Pendente' },
  { title: 'One-on-One', owner: 'Gestão', date: '16/04/2026', status: 'Arquivada' },
]

export default function MeetingsPage() {
  return (
    <Stack spacing={3} sx={{ pt: { xs: 6, md: 0 } }}>
      <Box>
        <Typography variant="h4">Reuniões</Typography>
        <Typography color="text.secondary">
          Visualize as atas geradas e o status de cada reunião.
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gap: 2 }}>
        {meetings.map((meeting) => (
          <Card key={`${meeting.title}-${meeting.date}`}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              spacing={2}
            >
              <Box>
                <Typography variant="h6">{meeting.title}</Typography>
                <Typography color="text.secondary">
                  Responsável: {meeting.owner}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Data: {meeting.date}
                </Typography>
              </Box>
              <Chip label={meeting.status} color="primary" />
            </Stack>
          </Card>
        ))}
      </Box>
    </Stack>
  )
}
