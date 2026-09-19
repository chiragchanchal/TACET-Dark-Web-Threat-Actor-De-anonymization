import {
  ShieldCheck, LockKeyhole, DatabaseBackup, Scale, Fingerprint, FileCheck,
} from 'lucide-react';
import { Card } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { PageHeader } from '../components/page-header.jsx';

const MICRO = 'text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500';

const BOUNDARIES = [
  {
    icon: LockKeyhole,
    title: 'No Tor interaction',
    body: 'TACET never attacks, probes or deanonymizes the Tor routing layer. No relay exploitation, no circuit correlation, no live network operations.',
  },
  {
    icon: DatabaseBackup,
    title: 'Air-gapped ingestion',
    body: 'Dumps are parsed from local files. The pipeline runs without outbound network access, so ingestion can occur on an isolated machine.',
  },
  {
    icon: ShieldCheck,
    title: 'Public data only',
    body: 'Analysis input is limited to already-dumped, publicly available forum data and public OSINT sources. No intrusion, no credential use, no covert collection.',
  },
];

const SIGNALS = [
  { label: 'Artifact reuse', pct: 42, note: 'wallets, PGP keys, handles, emails' },
  { label: 'Stylometry', pct: 36, note: 'lexical + character n-gram fingerprints' },
  { label: 'Timezone rhythm', pct: 12, note: 'UTC posting-hour histograms' },
  { label: 'Forum proximity', pct: 10, note: 'shared threads and reply chains' },
];

const TIERS = [
  { label: 'Likely same actor', threshold: '≥ 75%', cls: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' },
  { label: 'Probable link', threshold: '≥ 55%', cls: 'border-sky-500/35 bg-sky-500/10 text-sky-300' },
  { label: 'Weak link', threshold: '≥ 35%', cls: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300' },
  { label: 'Insufficient', threshold: '< 35%', cls: 'border-white/10 bg-white/[0.04] text-zinc-500' },
];

function SectionCard({ icon: Icon, title, children, className }) {
  return (
    <Card className={className}>
      <div className="flex items-center gap-2 px-5 pt-4 pb-1">
        <Icon className="h-4 w-4 text-zinc-500" />
        <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
      </div>
      <div className="px-5 pb-5 pt-2">{children}</div>
    </Card>
  );
}

function Row({ title, body }) {
  return (
    <div className="border-b border-border/50 py-2.5 last:border-0 last:pb-0">
      <div className="text-[12.5px] font-medium text-zinc-200">{title}</div>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-zinc-500">{body}</p>
    </div>
  );
}

export default function Compliance() {
  return (
    <div className="max-w-[1100px]">
      <PageHeader
        title="Legal & evidence framework"
        description="How TACET handles data, preserves evidence, and stays within lawful OSINT operations."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard icon={ShieldCheck} title="Operational boundaries">
          {BOUNDARIES.map((b) => (
            <div key={b.title} className="flex gap-2.5 border-b border-border/50 py-2.5 last:border-0 last:pb-0">
              <b.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" />
              <div>
                <div className="text-[12.5px] font-medium text-zinc-200">{b.title}</div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-zinc-500">{b.body}</p>
              </div>
            </div>
          ))}
        </SectionCard>

        <SectionCard icon={Fingerprint} title="Attribution model & limits">
          <div className={MICRO}>Weighted signals</div>
          <div className="mb-3 mt-1.5 space-y-1.5">
            {SIGNALS.map((s) => (
              <div key={s.label} className="grid grid-cols-[110px_1fr_40px] items-center gap-2.5">
                <span className="text-[12px] text-zinc-300">{s.label}</span>
                <div className="h-[5px] overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-zinc-400" style={{ width: `${s.pct}%` }} />
                </div>
                <span className="num text-right font-mono text-[11px] text-zinc-500">{s.pct}%</span>
              </div>
            ))}
          </div>
          <div className={MICRO}>Verdict tiers</div>
          <div className="mt-1.5 space-y-1.5">
            {TIERS.map((t) => (
              <div key={t.label} className="flex items-center justify-between gap-3">
                <Badge className={t.cls}>{t.label}</Badge>
                <span className="num font-mono text-[11px] text-zinc-500">{t.threshold}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 border-t border-border/50 pt-2.5 text-[12.5px] leading-relaxed text-zinc-500">
            Scores are probabilistic evidence, not proof of identity. No verdict in this system should be
            treated as a positive identification without corroborating investigative work.
          </p>
        </SectionCard>

        <SectionCard icon={DatabaseBackup} title="Evidence preservation">
          <Row
            title="Hash-chained audit trail"
            body="Every ingestion run, case action and reseed is recorded with a timestamp, acting user and event hash, giving a reviewable operational history."
          />
          <Row
            title="Case evidence-chain export"
            body="Case reports export the attached identities, their reusable artifacts and the cross-identity links, so findings can be preserved with the underlying work product."
          />
          <Row
            title="Original media retention"
            body="Analysts are directed to retain the original dump image alongside the derived output; TACET's results are a derivative, not a replacement for the source."
          />
          <Row
            title="Workflow alignment"
            body="Handling follows the preservation and documentation sequence described in NIST SP 800-86 for integrating forensic techniques into incident response."
          />
        </SectionCard>

        <SectionCard icon={Scale} title="Indian legal basis">
          <Row
            title="Information Technology Act, 2000 — Section 65B"
            body="Electronic records intended for evidentiary use require certification. Reports produced here are structured to accompany that certificate, not substitute for it."
          />
          <Row
            title="Bharatiya Sakshya Adhiniyam, 2023"
            body="Admissibility of electronic records is governed by the current evidence statute; analysts must follow their agency's certification process for the jurisdiction of filing."
          />
          <Row
            title="Supplements certified examination"
            body="Tool output supports an investigation. It does not replace certified forensic examination, judicial process, or the legal authority required for action against a person."
          />
        </SectionCard>

        <SectionCard icon={FileCheck} title="Operator responsibilities" className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
            <div>
              <Row title="Authorised use only" body="Deploy for lawful cyber-crime investigation under an appropriate agency mandate." />
              <Row title="Human in the loop" body="An analyst reviews and validates every attribution before it informs an operational decision." />
              <Row title="Verify before action" body="Corroborate graph links with independent evidence before any enforcement or attribution claim." />
            </div>
            <div>
              <Row title="Documented provenance" body="Record the acquisition channel and handling history for each dump before analysis begins." />
              <Row title="Chain-of-custody metadata" body="Exports carry generation time and operator identity so custody can be reconstructed." />
              <Row title="Synthetic demo corpus" body="Every bundled identity, wallet, key and post in this build is generated. No real persons or dark web data ship with the repository." />
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="mt-5 border-t border-border pt-3">
        <span className="font-mono text-[10.5px] text-zinc-600">TACET · SIH2026 · PS SIH26151 · KRMU159</span>
      </div>
    </div>
  );
}
