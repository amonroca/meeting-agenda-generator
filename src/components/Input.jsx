import TextField from '@mui/material/TextField'

export default function Input(props) {
  return (
    <TextField
      fullWidth
      size="medium"
      variant="outlined"
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: 3,
          backgroundColor: '#fff',
        },
      }}
      {...props}
    />
  )
}
