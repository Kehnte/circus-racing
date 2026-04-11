// LoginPage — Auth form with display name and password.

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined';
import { useAuth } from '../context/AuthContext.tsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNotFound(false);
    setLoading(true);
    try {
      await login(displayName, password);
      void navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (msg === 'Account not found') {
        setNotFound(true);
      } else {
        setError(msg);
        setTimeout(() => setError(''), 3000);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Paper
        component="form"
        onSubmit={(e: FormEvent) => void handleSubmit(e)}
        elevation={4}
        sx={{ width: '100%', maxWidth: 400, p: 4, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Box sx={{ textAlign: 'center', mb: 1 }}>
          <Typography variant="h5" fontWeight={700} fontStyle="italic">
            Circus Racing
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Admin / Moderator access only
          </Typography>
        </Box>

        <TextField
          label="Display name"
          value={displayName}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
          autoComplete="username"
          required
          fullWidth
        />

        <TextField
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          fullWidth
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword((v) => !v)}
                    edge="end"
                    size="small"
                  >
                    {showPassword ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />

        <Collapse in={!!error}>
          <Alert severity="error">{error}</Alert>
        </Collapse>

        <Collapse in={notFound}>
          <Alert severity="info">
            Account not found.{' '}
            <Link component={RouterLink} to="/register">Sign up?</Link>
          </Alert>
        </Collapse>

        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={loading}
        >
          Sign in
        </Button>
        <Typography variant="body2" textAlign="center">
          Don't have an account?{' '}
          <Link component={RouterLink} to="/register">Sign up</Link>
        </Typography>
      </Paper>
    </Box>
  );
}
