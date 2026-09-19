import { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, LoaderCircle, TriangleAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { api } from '../api.js';
import { PageHeader } from '../components/page-header.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Card } from '../components/ui/card.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table.jsx';

const RENDER_CAP = 200;

function actionText(action) {
  return typeof action === 'string' ? action.replace(/_/g, ' ') : '—';
}

function detailText(e) {
  if (e.detail != null) return String(e.detail);
  if (e.notes != null) return String(e.notes);
  return '';
}

function referenceText(e) {
  const ref = e.runId ?? e.caseId ?? e.id;
  if (ref != null && String(ref).trim() !== '') return String(ref);
  return '—';
}

export default function AuditLog() {
  const [events, setEvents] = useState(null);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [chain, setChain] = useState(null);
  const [verifyBusy, setVerifyBusy] = useState(false);

  async function load() {
    try {
      const data = await api('/audit?limit=500');
      const list = Array.isArray(data) ? data : data?.events || [];
      setEvents(list);
      setErr(null);
    } catch (e) {
      if (events === null) setErr(e.message);
    } finally {
      setUpdatedAt(new Date());
    }
  }

  async function verifyChain() {
    setVerifyBusy(true);
    try {
      setChain(await api('/audit/verify'));
    } catch (e) {
      setChain({ valid: false, error: e.message });
    } finally {
      setVerifyBusy(false);
    }
  }

  useEffect(() => { load(); verifyChain(); }, []);

  const filtered = useMemo(() => {
    const list = events || [];
    if (!q) return list;
    const lq = q.toLowerCase();
    return list.filter((e) => {
      const res = actionText(e.action).toLowerCase();
      const actor = String(e.actor ?? '').toLowerCase();
      const det = detailText(e).toLowerCase();
      const ref = referenceText(e).toLowerCase();
      const hash = String(e.hash ?? '').toLowerCase();
      const notes = String(e.notes ?? '').toLowerCase();
      return res.includes(lq) || actor.includes(lq) || det.includes(lq) || ref.includes(lq) || hash.includes(lq) || notes.includes(lq);
    });
  }, [events, q]);

  const visible = filtered.slice(0, RENDER_CAP);
  const more = filtered.length > RENDER_CAP;

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Hash-chained operational trail — every ingestion, case action and reseed is recorded."
        actions={
          <div className="flex items-center gap-2">
            {chain && (
              <span
                className={
                  chain.valid
                    ? 'flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[12px] text-emerald-300'
                    : 'flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[12px] text-red-300'
                }
              >
                {chain.valid ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldX className="h-3.5 w-3.5" />}
                {chain.valid ? `SHA-256 chain valid · ${chain.count} events` : 'Chain integrity FAILED'}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={verifyChain} disabled={verifyBusy} className="gap-2">
              <ShieldCheck size={14} className={verifyBusy ? 'animate-pulse' : ''} />
              Verify chain
            </Button>
            <Button variant="outline" size="sm" onClick={load} className="gap-2">
              <RefreshCw size={14} className={events !== null ? '' : 'animate-spin'} />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between gap-4">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search action, actor, detail, hash…"
            className="h-8 w-64 pl-8 text-[13px]"
          />
        </div>
        <div className="num font-mono text-[12px] text-zinc-500">
          {filtered.length} events
          {more && ` (showing ${RENDER_CAP})`}
          {updatedAt && (
            <span className="text-zinc-600">
              {' '}· updated {updatedAt.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {err && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-300">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          {err}
        </div>
      )}

      {events === null && !err && (
        <div className="flex h-[50vh] items-center justify-center text-zinc-500">
          <LoaderCircle size={20} className="animate-spin" />
          <span className="ml-2 text-[13px]">Loading audit trail…</span>
        </div>
      )}

      {events !== null && (
        <Card className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[190px]">Time</TableHead>
                <TableHead className="w-[140px]">Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="w-[140px]">Reference</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead className="w-[110px]">Hash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-[13px] text-zinc-600">
                    No audit events match.
                  </TableCell>
                </TableRow>
              )}
              {visible.map((e, i) => (
                <TableRow key={e.id ?? `${e.hash ?? ''}-${e.at ?? ''}-${i}`}>
                  <TableCell className="num font-mono text-[12px] text-zinc-400">
                    {e.at ? new Date(e.at).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="text-zinc-300">{e.actor || 'system'}</TableCell>
                  <TableCell>
                    <span className="font-medium uppercase tracking-wide text-[12px] text-zinc-200">
                      {actionText(e.action)}
                    </span>
                  </TableCell>
                  <TableCell className="num font-mono text-[12px] text-zinc-500">
                    {referenceText(e)}
                  </TableCell>
                  <TableCell className="max-w-[420px] truncate text-[13px] text-zinc-500" title={detailText(e) || undefined}>
                    {detailText(e) || '—'}
                  </TableCell>
                  <TableCell className="num font-mono text-[10.5px] text-zinc-600" title="event hash">
                    {e.hash || ''}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {more && (
            <div className="border-t border-border px-4 py-2.5">
              <span className="num font-mono text-[12px] text-zinc-500">
                showing {RENDER_CAP} of {filtered.length.toLocaleString()} events
              </span>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
