import { ArrowLeft, Pause, Play, StopCircle, RefreshCw } from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';

interface Props {
  onBack: () => void;
}

interface Session {
  id: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  plannedSeconds: number;
  wasAbandoned: boolean;
  tags: string[];
  rating: 1 | 2 | 3 | 4 | 5 | null;
}

interface DayState {
  date: string;
  startedAt: number;
  endedAt: number | null;
}

type TimerPhase = 'idle' | 'running' | 'paused' | 'feedback' | 'break';

const DURATIONS = [25, 15, 5] as const;

const SEED_TAGS = [
  'standup', 'admin', 'face to face', 'review', 'coding', 'email',
  'meeting', 'planning', 'writing', '1:1', 'design', 'research', 'documentation',
];

const COPY = [
  "You're doing it.",
  'One thing at a time.',
  'Ignore everything else.',
  "You showed up. That's the work.",
  'Stay here a little longer.',
  'Progress, not perfection.',
  "You're already ahead.",
  'This is enough.',
  'Just this. Just now.',
  'Keep going.',
];

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function stars(r: number | null) {
  if (!r) return '';
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}

function isToday(ts: number) {
  return new Date(ts).toDateString() === new Date().toDateString();
}

function timeStr(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function bracket(hour: number) {
  if (hour < 10) return 0;
  if (hour < 13) return 1;
  if (hour < 17) return 2;
  return 3;
}

function toggleTag(prev: Set<string>, t: string): Set<string> {
  const s = new Set(prev);
  s.has(t) ? s.delete(t) : s.add(t);
  return s;
}

function sortedTags(sessions: Session[]): string[] {
  const now = bracket(new Date().getHours());
  const known = new Set<string>(SEED_TAGS);
  sessions.forEach(s => s.tags.forEach(t => known.add(t)));
  const score: Record<string, number> = {};
  for (const tag of known) {
    let sc = 0;
    for (const sess of sessions) {
      if (sess.tags.includes(tag)) {
        sc += 1;
        if (bracket(new Date(sess.startedAt).getHours()) === now) sc += 3;
      }
    }
    score[tag] = sc;
  }
  return [...known].sort((a, b) => (score[b] ?? 0) - (score[a] ?? 0));
}

const api = {
  getSessions: (): Promise<Session[]> => fetch('/api/sessions').then(r => r.json()),
  addSession: (s: Session) => fetch('/api/sessions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s),
  }),
  getDay: (): Promise<DayState | null> => fetch('/api/day').then(r => r.json()),
  startDay: (): Promise<DayState> => fetch('/api/day/start', { method: 'POST' }).then(r => r.json()),
  endDay: () => fetch('/api/day/end', { method: 'POST' }),
  resetDay: () => fetch('/api/day/reset', { method: 'POST' }),
};

// ── Tag picker (shared between feedback and retro) ────────────────────────────

function TagPicker({ sessions, selected, onToggle, customInput, onCustomInput, onAddCustom }: {
  sessions: Session[];
  selected: Set<string>;
  onToggle: (tag: string) => void;
  customInput: string;
  onCustomInput: (v: string) => void;
  onAddCustom: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {sortedTags(sessions).map(tag => {
          const on = selected.has(tag);
          return (
            <button
              key={tag}
              onClick={() => onToggle(tag)}
              className={`px-3 py-1.5 border-2 border-black font-black text-sm uppercase tracking-wide transition-all ${on ? 'bg-black text-[#FF90E8] shadow-none translate-x-0.5 translate-y-0.5' : 'bg-white hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}
            >
              {tag}
            </button>
          );
        })}
      </div>
      <form onSubmit={e => { e.preventDefault(); onAddCustom(); }} className="flex gap-2 mt-1">
        <input
          value={customInput}
          onChange={e => onCustomInput(e.target.value)}
          placeholder="custom tag…"
          className="flex-1 border-2 border-black px-3 py-2 text-sm font-mono bg-white focus:outline-none placeholder:text-black/30"
        />
        <button type="submit" className="border-2 border-black bg-black text-[#FFE135] px-4 py-2 font-black text-sm">+</button>
      </form>
    </>
  );
}

// ── Ticket styles (no oklch — plain hex only for html2canvas) ─────────────────

const ticketBase: React.CSSProperties = {
  backgroundColor: '#ffffff',
  color: '#000000',
  fontFamily: '"Space Mono", monospace',
  width: 320,
  padding: '16px 20px',
  boxSizing: 'border-box',
  WebkitFontSmoothing: 'none',
};

const T = {
  row: { display: 'flex', justifyContent: 'space-between' } as React.CSSProperties,
  bold: { fontWeight: 900 } as React.CSSProperties,
  sm: { fontSize: 11 } as React.CSSProperties,
  xs: { fontSize: 10 } as React.CSSProperties,
  muted: { color: '#555555' } as React.CSSProperties,
  center: { textAlign: 'center' as const },
  upper: { textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
};

// ─────────────────────────────────────────────────────────────────────────────

export default function Todo({ onBack }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [day, setDay] = useState<DayState | null | 'loading'>('loading');
  const [timerPhase, setTimerPhase] = useState<TimerPhase>('idle');
  const [durationMin, setDurationMin] = useState<typeof DURATIONS[number]>(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [breakSeconds, setBreakSeconds] = useState(5 * 60);
  const [copyIdx, setCopyIdx] = useState(0);

  // feedback state
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [tagInput, setTagInput] = useState('');
  const [rating, setRating] = useState<1|2|3|4|5|null>(null);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState('');

  // retro entry state
  const [showRetro, setShowRetro] = useState(false);
  const [retroMin, setRetroMin] = useState(15);
  const [retroTags, setRetroTags] = useState<Set<string>>(new Set());
  const [retroTagInput, setRetroTagInput] = useState('');
  const [retroRating, setRetroRating] = useState<1|2|3|4|5|null>(null);

  // start day state
  const [startDayBusy, setStartDayBusy] = useState(false);
  const [startDayError, setStartDayError] = useState('');
  const printDayHeaderPending = useRef(false);

  // timer refs
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breakIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const copyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const abandonedRef = useRef(false);
  const sessionIdRef = useRef('');
  const sessionStartedAtRef = useRef(0);

  // print refs
  const dayHeaderRef = useRef<HTMLDivElement>(null);
  const sessionTicketRef = useRef<HTMLDivElement>(null);
  const reprintRef = useRef<HTMLDivElement>(null);
  const eodRef = useRef<HTMLDivElement>(null);
  const [pendingSession, setPendingSession] = useState<Session | null>(null);

  // load on mount
  useEffect(() => {
    Promise.all([api.getSessions(), api.getDay()]).then(([s, d]) => {
      setSessions(s);
      setDay(d);
    });
  }, []);

  useEffect(() => () => {
    [intervalRef, breakIntervalRef, copyIntervalRef].forEach(r => { if (r.current) clearInterval(r.current); });
  }, []);

  // ── derived ───────────────────────────────────────────────────────────────

  const todaySessions = sessions.filter(s => isToday(s.startedAt))
    .sort((a, b) => a.startedAt - b.startedAt);
  const totalMin = Math.round(todaySessions.reduce((a, s) => a + s.durationSeconds, 0) / 60);
  const dayActive = day !== 'loading' && day !== null && day.endedAt === null;
  const dayEnded = day !== 'loading' && day !== null && day.endedAt !== null;

  // ── print helper ──────────────────────────────────────────────────────────

  const capture = async (ref: React.RefObject<HTMLDivElement | null>, cut: boolean): Promise<string | null> => {
    const el = ref.current;
    if (!el) { console.error('[capture] ref is null'); return 'element not found'; }
    console.log('[capture] el dimensions:', el.offsetWidth, 'x', el.offsetHeight, 'cut:', cut);
    try {
      const canvas = await html2canvas(el, { scale: 4, backgroundColor: '#FFFFFF', logging: false });
      console.log('[capture] canvas:', canvas.width, 'x', canvas.height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < img.data.length; i += 4) {
          const b = 0.299 * img.data[i] + 0.587 * img.data[i+1] + 0.114 * img.data[i+2];
          const v = b > 128 ? 255 : 0;
          img.data[i] = v; img.data[i+1] = v; img.data[i+2] = v;
        }
        ctx.putImageData(img, 0, 0);
      }
      const imageData = canvas.toDataURL('image/png');
      console.log('[capture] imageData length:', imageData.length, 'sending to /api/print');
      const res = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData, cut }),
      });
      const json = await res.json();
      console.log('[capture] print response:', res.status, json);
      if (!res.ok || json.error) return json.error || `HTTP ${res.status}`;
      return null;
    } catch (e) {
      console.error('[capture] error:', e);
      return e instanceof Error ? e.message : String(e);
    }
  };

  const raf2 = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  // ── start day ─────────────────────────────────────────────────────────────

  // fires after React commits the day-active render — then captures the header
  useEffect(() => {
    if (!printDayHeaderPending.current) return;
    printDayHeaderPending.current = false;
    (async () => {
      const err = await capture(dayHeaderRef, false);
      if (err) setPrintError(err);
      setStartDayBusy(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  // fires after React commits the session into the sessionTicketRef DOM
  useEffect(() => {
    if (!pendingSession) return;
    (async () => {
      const err = await capture(sessionTicketRef, false);
      setPrinting(false);
      if (err) setPrintError(err);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSession]);

  const startDay = async () => {
    setStartDayBusy(true);
    setStartDayError('');
    try {
      const newDay = await api.startDay();
      printDayHeaderPending.current = true; // signal the effect
      setDay(newDay); // triggers re-render → useEffect fires
    } catch (e) {
      setStartDayError(e instanceof Error ? e.message : String(e));
      setStartDayBusy(false);
    }
  };

  // ── timer ─────────────────────────────────────────────────────────────────

  const tick = useCallback(() => {
    setSecondsLeft(prev => {
      if (prev <= 1) {
        clearInterval(intervalRef.current!);
        clearInterval(copyIntervalRef.current!);
        elapsedRef.current += (Date.now() - startRef.current) / 1000;
        abandonedRef.current = false;
        setTimerPhase('feedback');
        return 0;
      }
      return prev - 1;
    });
  }, []);

  // ── interval helpers ─────────────────────────────────────────────────────

  const startIntervals = useCallback(() => {
    intervalRef.current = setInterval(tick, 1000);
    copyIntervalRef.current = setInterval(() => setCopyIdx(i => (i + 1) % COPY.length), 30_000);
  }, [tick]);

  const stopIntervals = () => {
    clearInterval(intervalRef.current!);
    clearInterval(copyIntervalRef.current!);
  };

  const startSession = () => {
    const planned = durationMin * 60;
    elapsedRef.current = 0;
    startRef.current = Date.now();
    abandonedRef.current = false;
    sessionIdRef.current = crypto.randomUUID();
    sessionStartedAtRef.current = Date.now();
    setSecondsLeft(planned);
    setSelectedTags(new Set());
    setTagInput('');
    setRating(null);
    setCopyIdx(0);
    startIntervals();
    setTimerPhase('running');
  };

  const pauseSession = () => {
    stopIntervals();
    elapsedRef.current += (Date.now() - startRef.current) / 1000;
    setTimerPhase('paused');
  };

  const resumeSession = () => {
    startRef.current = Date.now();
    startIntervals();
    setTimerPhase('running');
  };

  const endEarly = () => {
    stopIntervals();
    elapsedRef.current += (Date.now() - startRef.current) / 1000;
    abandonedRef.current = true;
    setTimerPhase('feedback');
  };

  // ── feedback submit ───────────────────────────────────────────────────────

  const submitFeedback = useCallback(() => {
    const session: Session = {
      id: sessionIdRef.current,
      startedAt: sessionStartedAtRef.current,
      endedAt: Date.now(),
      durationSeconds: Math.round(elapsedRef.current),
      plannedSeconds: durationMin * 60,
      wasAbandoned: abandonedRef.current,
      tags: [...selectedTags],
      rating,
    };

    setSessions(prev => [...prev, session]);
    api.addSession(session);
    setPrinting(true);
    setPrintError('');
    setPendingSession(session); // triggers useEffect after DOM commits

    if (!session.wasAbandoned) {
      setBreakSeconds(5 * 60);
      setTimerPhase('break');
      breakIntervalRef.current = setInterval(() => {
        setBreakSeconds(prev => {
          if (prev <= 1) { clearInterval(breakIntervalRef.current!); setTimerPhase('idle'); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      setTimerPhase('idle');
    }
  }, [selectedTags, rating, durationMin]);

  // ── retro entry ───────────────────────────────────────────────────────────

  const submitRetro = () => {
    if (retroMin <= 0) return;
    const now = Date.now();
    const session: Session = {
      id: crypto.randomUUID(),
      startedAt: now - retroMin * 60 * 1000,
      endedAt: now,
      durationSeconds: retroMin * 60,
      plannedSeconds: retroMin * 60,
      wasAbandoned: false,
      tags: [...retroTags],
      rating: retroRating,
    };
    setSessions(prev => [...prev, session]);
    api.addSession(session);
    setShowRetro(false);
    setRetroMin(15);
    setRetroTags(new Set());
    setRetroTagInput('');
    setRetroRating(null);
  };

  // ── end of day ────────────────────────────────────────────────────────────

  const endOfDay = async () => {
    setPrinting(true);
    setPrintError('');
    await raf2();
    const err = await capture(eodRef, true); // CUT — end of day
    setPrinting(false);
    if (err) { setPrintError(err); return; }
    api.endDay();
    setDay(prev => prev && prev !== 'loading' ? { ...prev, endedAt: Date.now() } : prev);
  };

  // ── reprint day ───────────────────────────────────────────────────────────

  const reprintDay = async () => {
    setPrinting(true);
    setPrintError('');
    await raf2();
    const err = await capture(reprintRef, false); // no cut — continuing the day
    setPrinting(false);
    if (err) setPrintError(err);
  };

  // ── reset ─────────────────────────────────────────────────────────────────

  const resetDay = async () => {
    if (!confirm('Reset the whole day? This clears all sessions and day state.')) return;
    await api.resetDay();
    setSessions([]);
    setDay(null);
    setTimerPhase('idle');
  };

  // ── render ────────────────────────────────────────────────────────────────

  if (day === 'loading') {
    return <div className="min-h-screen bg-[#FFE135] flex items-center justify-center font-mono text-2xl font-black animate-pulse">…</div>;
  }

  const sessionNumInDay = (s: Session) => todaySessions.indexOf(s) + 1;

  return (
    <div className="min-h-screen bg-[#FFE135] font-mono flex flex-col">

      {/* ══ NOT STARTED ═══════════════════════════════════════════════════════ */}
      {!dayActive && !dayEnded && timerPhase === 'idle' && (
        <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
          <div className="text-center">
            <div className="text-xs font-black uppercase tracking-[0.3em] text-black/40 mb-3">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <h1 className="text-5xl font-black uppercase tracking-tighter">Ready?</h1>
          </div>
          <button
            onClick={startDay}
            disabled={startDayBusy}
            className="bg-black text-[#FFE135] border-4 border-black px-12 py-6 font-black text-2xl uppercase tracking-widest shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)] hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,0.2)] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
          >
            {startDayBusy ? 'Printing…' : 'Start the day →'}
          </button>
          {startDayError && (
            <div className="border-2 border-black bg-white px-4 py-2 text-xs font-bold break-all text-red-700 max-w-sm text-center">
              ⚠ {startDayError}
            </div>
          )}
          <button onClick={onBack} className="text-sm font-bold text-black/40 hover:text-black underline transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> back
          </button>
        </div>
      )}

      {/* ══ DAY ENDED ════════════════════════════════════════════════════════ */}
      {dayEnded && timerPhase === 'idle' && (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
          <div className="text-center">
            <div className="text-3xl mb-2">✓</div>
            <h2 className="text-3xl font-black uppercase tracking-tighter">Day complete.</h2>
            <p className="text-sm font-bold text-black/50 mt-1">{todaySessions.length} sessions · {totalMin} min</p>
          </div>
          <button onClick={resetDay} className="text-sm font-bold text-black/40 hover:text-black underline transition-colors">
            Reset & start fresh
          </button>
          <button onClick={onBack} className="text-sm font-bold text-black/40 hover:text-black underline transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> back
          </button>
        </div>
      )}

      {/* ══ IDLE (day active) ═════════════════════════════════════════════════ */}
      {dayActive && timerPhase === 'idle' && (
        <div className="flex flex-col min-h-screen p-6 max-w-lg mx-auto w-full">

          {/* header */}
          <div className="flex items-center gap-3 mb-8">
            <button onClick={onBack} className="bg-white border-2 border-black font-bold px-3 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] active:shadow-none transition-all flex items-center gap-1 text-sm">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <span className="text-sm font-bold text-black/50">
              {todaySessions.length > 0 ? `${todaySessions.length} sessions · ${totalMin} min` : 'Day started'}
            </span>
            <button
              onClick={reprintDay}
              disabled={printing}
              title="Reprint today's ticket from the start"
              className="ml-auto text-black/30 hover:text-black transition-colors disabled:opacity-30"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={resetDay} className="text-xs font-black uppercase tracking-wide text-black/30 hover:text-black border border-black/20 px-2 py-1 hover:border-black transition-colors">
              Reset
            </button>
          </div>

          {/* start focus */}
          <div className="flex-1 flex flex-col gap-4 justify-center">
            <button
              onClick={startSession}
              className="w-full bg-black text-[#FFE135] border-4 border-black py-10 font-black text-3xl uppercase tracking-widest shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)] hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,0.2)] active:translate-y-1 active:shadow-none transition-all"
            >
              ▶ Start focus
            </button>

            {/* duration */}
            <div className="flex gap-3">
              {DURATIONS.map(d => (
                <button key={d} onClick={() => setDurationMin(d)}
                  className={`flex-1 border-2 border-black py-3 font-black text-sm uppercase transition-all ${durationMin === d ? 'bg-black text-[#FFE135]' : 'bg-white hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}>
                  {d} min
                </button>
              ))}
            </div>

            {/* retro toggle */}
            {!showRetro ? (
              <button onClick={() => setShowRetro(true)} className="text-sm font-bold text-black/40 hover:text-black transition-colors underline underline-offset-2 self-center">
                + log a past session
              </button>
            ) : (
              <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black uppercase tracking-wide">Log past session</span>
                  <button onClick={() => setShowRetro(false)} className="text-xs font-bold text-black/40 hover:text-black uppercase">cancel</button>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-black uppercase tracking-widest text-black/50 shrink-0">Duration</label>
                  <input type="number" min={1} max={480} value={retroMin}
                    onChange={e => setRetroMin(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 border-2 border-black px-3 py-1.5 text-sm font-black text-center focus:outline-none bg-[#FFE135]" />
                  <span className="text-sm font-bold text-black/50">min</span>
                </div>
                <label className="text-xs font-black uppercase tracking-widest text-black/50">What was it?</label>
                <TagPicker
                  sessions={sessions}
                  selected={retroTags}
                  onToggle={t => setRetroTags(prev => toggleTag(prev, t))}
                  customInput={retroTagInput}
                  onCustomInput={setRetroTagInput}
                  onAddCustom={() => { const t = retroTagInput.trim().toLowerCase(); if (t) { setRetroTags(prev => new Set([...prev, t])); setRetroTagInput(''); } }}
                />
                <div className="flex items-center gap-3">
                  <label className="text-xs font-black uppercase tracking-widest text-black/50 shrink-0">Feel?</label>
                  <div className="flex gap-2">
                    {([1,2,3,4,5] as const).map(n => (
                      <button key={n} onClick={() => setRetroRating(prev => prev === n ? null : n)}
                        className={`text-xl transition-all hover:scale-125 ${retroRating !== null && n <= retroRating ? 'opacity-100' : 'opacity-20'}`}>★</button>
                    ))}
                  </div>
                </div>
                <button onClick={submitRetro}
                  className="w-full bg-black text-[#FFE135] border-2 border-black py-3 font-black uppercase tracking-widest hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] active:translate-y-0.5 active:shadow-none transition-all">
                  Log it
                </button>
              </div>
            )}
          </div>

          {/* session log */}
          {todaySessions.length > 0 && (
            <div className="mt-8 border-t-2 border-black pt-4 flex flex-col gap-2">
              {todaySessions.map((s, i) => (
                <div key={s.id} className="flex items-baseline gap-3 text-sm">
                  <span className="text-black/30 font-bold shrink-0 text-xs w-4 text-right">{i + 1}</span>
                  <span className="text-black/40 font-bold shrink-0 text-xs">{timeStr(s.startedAt)}</span>
                  <span className="font-bold shrink-0">{fmt(s.durationSeconds)}</span>
                  <span className="flex-1 flex flex-wrap gap-1 min-w-0">
                    {s.tags.length > 0
                      ? s.tags.map(tag => <span key={tag} className="text-[10px] font-black uppercase bg-black text-[#FFE135] px-1.5 py-0.5">{tag}</span>)
                      : <span className="text-black/30 text-xs">—</span>}
                  </span>
                  {s.rating && <span className="text-xs shrink-0">{stars(s.rating)}</span>}
                  {s.wasAbandoned && <span className="text-[9px] font-black text-black/30 shrink-0">PART.</span>}
                </div>
              ))}
            </div>
          )}

          {/* end of day */}
          <div className="mt-8 flex flex-col gap-2">
            {printError && (
              <div className="border-2 border-black bg-red-100 px-3 py-2 text-xs font-bold break-all text-red-700 flex items-start gap-2">
                <span className="shrink-0">⚠ Print error:</span>
                <span>{printError}</span>
                <button onClick={() => setPrintError('')} className="ml-auto shrink-0 font-black hover:text-black">✕</button>
              </div>
            )}
            <button
              onClick={endOfDay}
              disabled={printing || todaySessions.length === 0}
              className="w-full border-2 border-black bg-white py-3 font-black text-sm uppercase tracking-widest hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none transition-all text-black/60 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {printing ? 'Printing…' : 'End of day ↓'}
            </button>
          </div>
        </div>
      )}

      {/* ══ RUNNING / PAUSED ═════════════════════════════════════════════════ */}
      {(timerPhase === 'running' || timerPhase === 'paused') && (
        <div className="min-h-screen flex flex-col items-center justify-center gap-10 p-8 select-none">
          <div className="text-xs font-black uppercase tracking-[0.3em] text-black/40">
            {timerPhase === 'paused' ? '⏸ paused' : `session ${todaySessions.length + 1}`}
          </div>
          <div className={`text-[clamp(6rem,20vw,10rem)] font-black leading-none tabular-nums transition-opacity ${timerPhase === 'paused' ? 'opacity-20' : ''}`}>
            {fmt(secondsLeft)}
          </div>
          <div className="text-sm font-bold text-black/50 h-5">
            {timerPhase === 'running' ? COPY[copyIdx] : ''}
          </div>
          <div className="flex gap-4">
            {timerPhase === 'running' ? (
              <button onClick={pauseSession} className="bg-white border-4 border-black font-black px-8 py-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2 uppercase">
                <Pause className="w-5 h-5" /> Pause
              </button>
            ) : (
              <button onClick={resumeSession} className="bg-black text-[#FFE135] border-4 border-black font-black px-8 py-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2 uppercase">
                <Play className="w-5 h-5" /> Resume
              </button>
            )}
            <button onClick={endEarly} className="border-2 border-black/30 bg-white font-bold px-5 py-4 text-sm uppercase text-black/40 hover:text-black hover:border-black transition-all flex items-center gap-2">
              <StopCircle className="w-4 h-4" /> End early
            </button>
          </div>
        </div>
      )}

      {/* ══ BREAK ════════════════════════════════════════════════════════════ */}
      {timerPhase === 'break' && (
        <div className="min-h-screen bg-[#E0FF4F] flex flex-col items-center justify-center gap-6 p-8">
          <div className="text-3xl">☕</div>
          <h2 className="text-2xl font-black uppercase tracking-tighter">Break time</h2>
          <p className="text-sm font-bold text-black/50">You earned it.</p>
          <div className="text-5xl font-black tabular-nums">{fmt(breakSeconds)}</div>
          <button onClick={() => { clearInterval(breakIntervalRef.current!); setTimerPhase('idle'); }}
            className="border-2 border-black bg-white font-black px-6 py-2 text-sm uppercase hover:-translate-y-0.5 transition-all">Skip</button>
        </div>
      )}

      {/* ══ FEEDBACK ═════════════════════════════════════════════════════════ */}
      {timerPhase === 'feedback' && (
        <div className="fixed inset-0 bg-[#FF90E8] flex flex-col overflow-y-auto z-50">
          <div className="max-w-md mx-auto w-full p-6 flex flex-col gap-6 py-10">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.3em] text-black/50 mb-1">
                {abandonedRef.current ? 'ended early' : 'session done'}
              </div>
              <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">
                {abandonedRef.current ? 'Partial win.' : 'Good work.'}
              </h2>
              <p className="text-sm font-bold text-black/50 mt-1">
                {fmt(Math.round(elapsedRef.current))} of {fmt(durationMin * 60)}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-xs font-black uppercase tracking-widest text-black/60">What were you on?</label>
              <TagPicker
                sessions={sessions}
                selected={selectedTags}
                onToggle={t => setSelectedTags(prev => toggleTag(prev, t))}
                customInput={tagInput}
                onCustomInput={setTagInput}
                onAddCustom={() => { const t = tagInput.trim().toLowerCase(); if (t) { setSelectedTags(prev => new Set([...prev, t])); setTagInput(''); } }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-black uppercase tracking-widest text-black/60">How did it feel? <span className="font-normal normal-case">(optional)</span></label>
              <div className="flex gap-3">
                {([1,2,3,4,5] as const).map(n => (
                  <button key={n} onClick={() => setRating(prev => prev === n ? null : n)}
                    className={`text-3xl transition-all hover:scale-125 ${rating !== null && n <= rating ? 'opacity-100' : 'opacity-20'}`}>★</button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-1">
              <button onClick={submitFeedback} disabled={printing}
                className="w-full bg-black text-[#FF90E8] border-4 border-black py-5 font-black text-xl uppercase tracking-widest shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-40">
                {printing ? 'Printing…' : 'Done →'}
              </button>
              {printError && <div className="bg-white border-2 border-black px-3 py-2 text-xs font-bold break-all text-red-700">⚠ {printError}</div>}
            </div>
          </div>
        </div>
      )}

      {/* ══ HIDDEN PRINT ELEMENTS ════════════════════════════════════════════ */}

      {/* Day header — printed once at start of day */}
      <div style={{ position: 'fixed', top: 0, left: -9999, pointerEvents: 'none' }} aria-hidden="true">
        <div ref={dayHeaderRef} style={ticketBase}>
          <DayHeader day={day !== 'loading' ? day : null} />
        </div>
      </div>

      {/* Session ticket — printed after each session (no cut) */}
      <div style={{ position: 'fixed', top: 0, left: -9999, pointerEvents: 'none' }} aria-hidden="true">
        <div ref={sessionTicketRef} style={ticketBase}>
          {pendingSession && (
            <SessionLine session={pendingSession} num={sessionNumInDay(pendingSession)} />
          )}
        </div>
      </div>

      {/* Reprint — full day so far, no cut */}
      <div style={{ position: 'fixed', top: 0, left: -9999, pointerEvents: 'none' }} aria-hidden="true">
        <div ref={reprintRef} style={ticketBase}>
          <DayHeader day={day !== 'loading' ? day : null} />
          {todaySessions.map((s, i) => (
            <SessionLine key={s.id} session={s} num={i + 1} />
          ))}
        </div>
      </div>

      {/* End-of-day summary — WITH cut */}
      <div style={{ position: 'fixed', top: 0, left: -9999, pointerEvents: 'none' }} aria-hidden="true">
        <div ref={eodRef} style={ticketBase}>
          <EodSummary sessions={todaySessions} />
        </div>
      </div>
    </div>
  );
}

// ── Ticket sub-components (inline hex styles only — no oklch) ─────────────────

function DayHeader({ day }: { day: DayState | null }) {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const time = day ? timeStr(day.startedAt) : timeStr(Date.now());
  return (
    <div style={{ paddingBottom: 12 }}>
      <div style={{ ...T.center, ...T.xs, ...T.bold, letterSpacing: '0.3em', marginBottom: 6 }}>✦ ✦ ✦</div>
      <div style={{ ...T.center, fontSize: 16, ...T.bold, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>FOCUS TERMINAL</div>
      <div style={{ ...T.center, ...T.sm, ...T.muted, marginBottom: 6 }}>{date}</div>
      <div style={{ borderTop: '2px solid #000', paddingTop: 8, ...T.center }}>
        <div style={{ ...T.xs, ...T.bold, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Day started at {time}</div>
      </div>
    </div>
  );
}

function SessionLine({ session, num, ..._ }: { session: Session; num: number; [k: string]: unknown }) {
  return (
    <div style={{ borderTop: '1px dashed #cccccc', paddingTop: 8, paddingBottom: 8, fontSize: 11 }}>
      <div style={{ ...T.row, ...T.bold, marginBottom: 3 }}>
        <span>#{num}  {timeStr(session.startedAt)}</span>
        <span>{fmt(session.durationSeconds)}{session.wasAbandoned ? ' part.' : ''}</span>
      </div>
      {session.tags.length > 0 && (
        <div style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10, marginBottom: 2 }}>
          {session.tags.join(' · ')}
        </div>
      )}
      {session.rating && <div style={{ ...T.xs, ...T.muted }}>{stars(session.rating)}</div>}
    </div>
  );
}

function EodSummary({ sessions }: { sessions: Session[] }) {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const totalMin = Math.round(sessions.reduce((a, s) => a + s.durationSeconds, 0) / 60);

  return (
    <>
      <div style={{ borderTop: '3px solid #000', paddingTop: 12, marginTop: 4 }}>
        <div style={{ ...T.center, ...T.bold, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
          — End of Day —
        </div>
        <div style={{ ...T.center, ...T.sm, ...T.muted, marginBottom: 12 }}>{date}</div>

        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '8px 0', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{sessions.length}</div>
            <div style={{ ...T.xs, ...T.bold, textTransform: 'uppercase' }}>sessions</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{totalMin}</div>
            <div style={{ ...T.xs, ...T.bold, textTransform: 'uppercase' }}>minutes</div>
          </div>
        </div>

        {sessions.map((s, i) => (
          <div key={s.id} style={{ marginBottom: 8, fontSize: 11 }}>
            <div style={T.row}>
              <span style={T.bold}>#{i+1}  {timeStr(s.startedAt)}</span>
              <span>{fmt(s.durationSeconds)}{s.rating ? `  ${stars(s.rating)}` : ''}</span>
            </div>
            {s.tags.length > 0 && (
              <div style={{ ...T.xs, ...T.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.tags.join(' · ')}</div>
            )}
          </div>
        ))}

        <div style={{ borderTop: '2px solid #000', paddingTop: 10, ...T.center, marginTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.5 }}>
            You showed up today.
          </div>
          <div style={{ ...T.sm, ...T.muted, marginTop: 2 }}>That's the whole game.</div>
        </div>
      </div>
      <div style={{ height: 48 }} />
    </>
  );
}
