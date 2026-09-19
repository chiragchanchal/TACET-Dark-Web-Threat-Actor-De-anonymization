import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, TriangleAlert, LoaderCircle } from 'lucide-react';
import { login } from '../api.js';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Card } from '../components/ui/card.jsx';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('analyst');
  const [password, setPassword] = useState('tac3t-demo');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const data = await login(username, password);
      onLogin(data.user);
      nav('/');
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-500/35 bg-cyan-500/[0.07]">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <div className="font-mono text-lg font-bold tracking-[0.3em] text-zinc-100">TACET</div>
            <div className="mt-1.5 text-[13px] text-muted-foreground">
              Dark web threat actor de-anonymization
            </div>
          </div>
        </div>

        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-xs font-medium text-zinc-300">
                Username
              </label>
              <Input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-medium text-zinc-300">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {err && (
              <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
                {err}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <LoaderCircle className="animate-spin" />}
              Sign in to workspace
            </Button>
          </form>
        </Card>

        <div className="mt-6 rounded-md border border-border bg-card px-4 py-3">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Demo accounts
          </div>
          <div className="space-y-1 font-mono text-[12px] text-zinc-400">
            <div><span className="text-zinc-200">analyst</span> · tac3t-demo</div>
            <div><span className="text-zinc-200">admin</span> · tac3t-admin</div>
          </div>
        </div>
      </div>
    </div>
  );
}
