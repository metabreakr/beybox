import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Search, Shuffle, Save } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import type { Part, Inventory as InventoryRow } from '@/types/database';
import {
  statsFor,
  typeColor,
  typeLabel,
  productCode,
  joinSub,
} from '@/components/PartCard';
import { PartThumb } from '@/lib/partImage';

const MM_TO_PX = 8;
const STAT_MAX = 100;

type SlotKind = 'blade' | 'ratchet' | 'bit';

type OwnedEntry = { part: Part; quantity: number };

function slotSub(part: Part): React.ReactNode {
  if (part.banned && part.ban_reason) {
    return <span style={{ color: 'var(--warn)' }}>{part.ban_reason}</span>;
  }
  if (part.part_class === 'blade') {
    if (part.ratchet_integrated) return joinSub([productCode(part), 'integrated ratchet']);
    return joinSub([
      productCode(part),
      part.spin,
      part.weight_g != null ? `${part.weight_g} g` : null,
    ]);
  }
  if (part.part_class === 'ratchet') {
    return joinSub([
      part.sides != null ? `${part.sides} sides` : null,
      part.height_mm != null ? `${part.height_mm.toFixed(1)} mm` : null,
      part.weight_g != null ? `${part.weight_g} g` : null,
    ]);
  }
  return joinSub([
    part.short_name ?? part.name,
    part.gear != null ? `gear ${part.gear}` : null,
    part.weight_g != null ? `${part.weight_g} g` : null,
  ]);
}

function emptyStateText(kind: SlotKind): { role: string; prompt: string } {
  if (kind === 'blade') return { role: 'Blade', prompt: 'Choose a blade' };
  if (kind === 'ratchet') return { role: 'Ratchet', prompt: 'Choose a ratchet' };
  return { role: 'Bit', prompt: 'Choose a bit' };
}

// Mockup format: "Impact Drake 9-60LR" — blade name + ratchet name + bit code.
// Ratchet and bit code join with no space; an integrated blade omits the ratchet.
function deriveName(b: Part | null, r: Part | null, rNa: boolean, bit: Part | null): string {
  const bits = [b?.display_name, rNa || !r ? null : r.display_name, bit?.short_name ?? bit?.name];
  return bits.filter((s): s is string => !!s && s.trim() !== '').join(' ');
}

export function Builder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { buildId } = useParams<{ buildId: string }>();
  const isEdit = !!buildId;

  const [loading, setLoading] = useState(true);
  const [owned, setOwned] = useState<OwnedEntry[] | null>(null);
  const [blade, setBlade] = useState<Part | null>(null);
  const [ratchet, setRatchet] = useState<Part | null>(null);
  const [bit, setBit] = useState<Part | null>(null);
  const [openSlot, setOpenSlot] = useState<SlotKind | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Load owned parts (parts + inventory quantities) once.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: invRows, error: invErr } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', user.id);
      if (cancelled) return;
      if (invErr) {
        setError(invErr.message);
        setLoading(false);
        return;
      }
      const ids = (invRows as InventoryRow[]).map((r) => r.part_id);
      if (ids.length === 0) {
        setOwned([]);
        setLoading(false);
        return;
      }
      const { data: parts, error: partErr } = await supabase
        .from('parts')
        .select('*')
        .in('id', ids)
        .order('display_name');
      if (cancelled) return;
      if (partErr) {
        setError(partErr.message);
        setLoading(false);
        return;
      }
      const qtyMap = new Map<string, number>();
      for (const r of invRows as InventoryRow[]) {
        qtyMap.set(r.part_id, r.quantity);
      }
      const list = (parts as Part[]).map((p) => ({
        part: p,
        quantity: qtyMap.get(p.id) ?? 1,
      }));
      setOwned(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // When editing, load the existing build and resolve its part ids.
  useEffect(() => {
    if (!buildId || !owned) return;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from('builds')
        .select('*')
        .eq('id', buildId)
        .maybeSingle();
      if (cancelled) return;
      if (err || !data) {
        setError('Could not load that build.');
        return;
      }
      const b = data as {
        name: string;
        blade_id: string | null;
        ratchet_id: string | null;
        bit_id: string | null;
      };
      const byId = new Map(owned.map((o) => [o.part.id, o.part]));
      setBlade(b.blade_id ? (byId.get(b.blade_id) ?? null) : null);
      setRatchet(b.ratchet_id ? (byId.get(b.ratchet_id) ?? null) : null);
      setBit(b.bit_id ? (byId.get(b.bit_id) ?? null) : null);
      // Seed the name field with the saved name; placeholder will show the derived name.
      setNameInput(b.name ?? '');
    })();
    return () => {
      cancelled = true;
    };
  }, [buildId, owned]);

  // If the selected blade is ratchet-integrated, the ratchet slot is N/A.
  const ratchetNa = blade?.ratchet_integrated === true;

  // When switching to an integrated blade, clear any ratchet selection.
  useEffect(() => {
    if (ratchetNa && ratchet) setRatchet(null);
  }, [ratchetNa, ratchet]);

  // Close picker on outside click.
  useEffect(() => {
    if (!openSlot) return;
    function onDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpenSlot(null);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openSlot]);

  const byClass = useMemo(() => {
    const m: Record<SlotKind, OwnedEntry[]> = { blade: [], ratchet: [], bit: [] };
    if (owned) {
      for (const o of owned) {
        m[o.part.part_class].push(o);
      }
    }
    return m;
  }, [owned]);

  const pickerResults = useMemo(() => {
    if (!openSlot) return [];
    const list = byClass[openSlot];
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) => {
      const p = o.part;
      const terms = [p.display_name, p.name, p.short_name, productCode(p)]
        .filter((s): s is string => !!s)
        .join(' ')
        .toLowerCase();
      return terms.includes(q);
    });
  }, [openSlot, byClass, pickerQuery]);

  const gapPx = ratchet?.height_mm != null ? Math.round(ratchet.height_mm * MM_TO_PX) : 0;

  // Combined stats from filled slots.
  const combined = useMemo(() => {
    const parts = [blade, ratchetNa ? null : ratchet, bit].filter(
      (p): p is Part => p != null,
    );
    const sum = (key: 'atk' | 'def' | 'sta' | 'dsh') =>
      parts.reduce((acc, p) => acc + (p[key] ?? 0), 0);
    const weight = parts.reduce((acc, p) => acc + (p.weight_g ?? 0), 0);
    return {
      atk: sum('atk'),
      def: sum('def'),
      sta: sum('sta'),
      dsh: sum('dsh'),
      weight,
      spin: blade?.spin ?? null,
      gear: bit?.gear ?? null,
      height: ratchetNa ? null : ratchet?.height_mm ?? null,
    };
  }, [blade, ratchet, bit, ratchetNa]);

  const complete = !!blade && (ratchetNa || !!ratchet) && !!bit;

  // Auto-derived name from the parts; shown as the placeholder so the user
  // sees the default forming as they pick. If they typed something, keep it.
  const derivedName = useMemo(
    () => deriveName(blade, ratchet, ratchetNa, bit),
    [blade, ratchet, ratchetNa, bit],
  );
  const finalName = nameInput.trim() || derivedName;

  function openPicker(kind: SlotKind) {
    setOpenSlot(kind);
    setPickerQuery('');
  }

  function choosePart(part: Part) {
    if (part.part_class === 'blade') {
      setBlade(part);
    } else if (part.part_class === 'ratchet') {
      setRatchet(part);
    } else {
      setBit(part);
    }
    setOpenSlot(null);
  }

  const doRandomize = useCallback(() => {
    if (!owned) return;
    const blades = byClass.blade;
    const ratchets = byClass.ratchet;
    const bits = byClass.bit;
    if (blades.length === 0 || bits.length === 0) return;
    const rb = blades[Math.floor(Math.random() * blades.length)].part;
    setBlade(rb);
    const integrated = rb.ratchet_integrated === true;
    if (integrated || ratchets.length === 0) {
      setRatchet(null);
    } else {
      setRatchet(ratchets[Math.floor(Math.random() * ratchets.length)].part);
    }
    setBit(bits[Math.floor(Math.random() * bits.length)].part);
  }, [owned, byClass]);

  async function doSave() {
    if (!user || !complete) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    const payload = {
      user_id: user.id,
      name: finalName,
      blade_id: blade!.id,
      ratchet_id: ratchetNa ? null : ratchet?.id ?? null,
      bit_id: bit!.id,
    };
    if (isEdit && buildId) {
      const { error: err } = await supabase
        .from('builds')
        .update(payload)
        .eq('id', buildId);
      setBusy(false);
      if (err) {
        setError(err.message);
        return;
      }
      setSaved('Build updated');
    } else {
      const { data, error: err } = await supabase
        .from('builds')
        .insert(payload)
        .select('id')
        .single();
      setBusy(false);
      if (err) {
        setError(err.message);
        return;
      }
      setSaved('Build saved');
      navigate(`/builder/${(data as { id: string }).id}`, { replace: true });
    }
  }

  if (loading) {
    return (
      <div className="builder-loading">
        <div className="eyebrow">Builder</div>
        <div style={{ color: 'var(--faint)', fontFamily: 'var(--mono)', fontSize: 12 }}>
          Loading your parts…
        </div>
      </div>
    );
  }

  if (owned && owned.length === 0) {
    return (
      <div className="empty">
        <div className="empty-eyebrow">Builder</div>
        <div className="empty-title">No parts to build with</div>
        <div className="empty-body">
          Add parts to your inventory first, then assemble them here.
        </div>
        <button className="b go" onClick={() => navigate('/inventory')}>
          Go to inventory
        </button>
      </div>
    );
  }

  return (
    <div className="builder">
      <div className="filters">
        <div className="find build-name-find">
          <input
            value={nameInput}
            placeholder={derivedName || 'Build name'}
            onChange={(e) => setNameInput(e.target.value)}
            aria-label="Build name"
          />
        </div>
        <span style={{ flex: 1 }} />
        {!isEdit && (
          <button className="b" onClick={() => navigate('/builder')}>
            <Plus size={12} strokeWidth={2.4} />
            New build
          </button>
        )}
      </div>

      <div className="deckgrid builder-grid">
        {/* — left: assembly stack — */}
        <div className="col builder-stage-col">
          <div className="eyebrow">Assembly</div>
          <div className="stage">
            <div className="ruler">
              <div className="tick" style={{ top: 0 }}>
                <span>mm</span>
                <i />
              </div>
              {combined.height != null && (
                <div
                  className="tick"
                  style={{ top: `${Math.round(combined.height * MM_TO_PX)}px` }}
                >
                  <span>{combined.height.toFixed(1)}</span>
                  <i />
                </div>
              )}
            </div>

            <div className="stack">
              <SlotView
                kind="blade"
                part={blade}
                picking={openSlot === 'blade'}
                onOpen={() => openPicker('blade')}
              >
                {openSlot === 'blade' && (
                  <Picker
                    ref={pickerRef}
                    kind="blade"
                    query={pickerQuery}
                    setQuery={setPickerQuery}
                    results={pickerResults}
                    onChoose={choosePart}
                  />
                )}
              </SlotView>

              <div className="gap-wrap">
                <div className="gap gap-variable"
                  style={{ height: `${gapPx}px`, transition: 'height 240ms ease-out' }}
                  aria-hidden={ratchetNa || !ratchet}
                >
                  <div className="gapline"><i /></div>
                </div>
                <div className="gapnote">
                  {!ratchetNa && ratchet
                    ? 'ratchet height sets this gap'
                    : ''}
                </div>
              </div>

              {ratchetNa ? (
                <div className="slot na">
                  <div className="sthumb rt empty">
                    <PartThumb image={null} partClass="ratchet" />
                  </div>
                  <div>
                    <div className="role">Ratchet</div>
                    <div className="pname ghost">Integrated — not applicable</div>
                    <div className="psub">This blade has its ratchet moulded in</div>
                  </div>
                </div>
              ) : (
                <SlotView
                  kind="ratchet"
                  part={ratchet}
                  picking={openSlot === 'ratchet'}
                  onOpen={() => openPicker('ratchet')}
                >
                  {openSlot === 'ratchet' && (
                    <Picker
                      ref={pickerRef}
                      kind="ratchet"
                      query={pickerQuery}
                      setQuery={setPickerQuery}
                      results={pickerResults}
                      onChoose={choosePart}
                    />
                  )}
                </SlotView>
              )}

              <div className="gap-wrap">
                <div className="gap gap-fixed"
                  style={{ height: '14px' }}
                  aria-hidden
                >
                  <div className="gapline"><i /></div>
                </div>
              </div>

              <SlotView
                kind="bit"
                part={bit}
                picking={openSlot === 'bit'}
                onOpen={() => openPicker('bit')}
              >
                {openSlot === 'bit' && (
                  <Picker
                    ref={pickerRef}
                    kind="bit"
                    query={pickerQuery}
                    setQuery={setPickerQuery}
                    results={pickerResults}
                    onChoose={choosePart}
                  />
                )}
              </SlotView>
            </div>
          </div>
        </div>

        {/* — right: combined stats + suggestions + actions — */}
        <div className="col builder-side-col">
          <div className="eyebrow">Combined</div>
          <StatRow label="ATK" value={combined.atk} color="var(--atk)" />
          <StatRow label="DEF" value={combined.def} color="var(--def)" />
          <StatRow label="STA" value={combined.sta} color="var(--sta)" />
          <StatRow label="DSH" value={combined.dsh} color="var(--bal)" />

          <div className="spec">
            <div>
              <div className="k">Height</div>
              <div className="v">
                {combined.height != null ? `${combined.height.toFixed(1)} mm` : '—'}
              </div>
            </div>
            <div>
              <div className="k">Weight</div>
              <div className="v">
                {combined.weight > 0 ? `${combined.weight.toFixed(1)} g` : '—'}
              </div>
            </div>
            <div>
              <div className="k">Spin</div>
              <div className="v">{combined.spin ?? '—'}</div>
            </div>
            <div>
              <div className="k">Gear</div>
              <div className="v">{combined.gear ?? '—'}</div>
            </div>
          </div>

          <div className="eyebrow">Suggested from your parts</div>
          <div id="s-builder" className="rec-placeholder">
            <div className="rec-empty">
              Suggestions appear here once you pick a blade.
            </div>
          </div>

          {error && (
            <div className="note form-error" style={{ marginTop: 14 }}>
              {error}
            </div>
          )}
          {saved && !error && (
            <div className="note" style={{ marginTop: 14 }}>{saved}</div>
          )}

          <div className="btnrow" style={{ marginTop: 14 }}>
            <button
              className="b hot"
              onClick={doRandomize}
              disabled={!owned || byClass.blade.length === 0 || byClass.bit.length === 0}
            >
              <Shuffle size={13} />
              Randomize
            </button>
            <button
              className="b go"
              onClick={doSave}
              disabled={!complete || busy}
            >
              <Save size={13} />
              {busy ? 'Saving…' : 'Save build'}
            </button>
          </div>
        </div>
      </div>

      <div className="foot">
        <div className="foot-l">
          <span>
            {complete ? 'Complete' : 'Incomplete'}
            {ratchetNa ? ' · integrated ratchet' : ''}
          </span>
        </div>
        <div className="foot-r">
          <span>{owned?.length ?? 0} parts owned</span>
        </div>
      </div>
    </div>
  );
}

type SlotProps = {
  kind: SlotKind;
  part: Part | null;
  picking: boolean;
  onOpen: () => void;
  children?: React.ReactNode;
};

function SlotView({ kind, part, picking, onOpen, children }: SlotProps) {
  const thumbClass = kind === 'blade' ? 'sthumb' : kind === 'ratchet' ? 'sthumb rt' : 'sthumb bit';
  const empty = !part;
  const { role, prompt } = emptyStateText(kind);

  return (
    <div className="slotwrap">
      <div
        className={`slot${picking ? ' picking' : ''}`}
        onClick={() => onOpen()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        <div className={`${thumbClass}${empty ? ' empty' : ''}`}>
          {part ? (
            <PartThumb
              image={part.image}
              alt={part.display_name}
              partClass={part.part_class}
              type={part.type}
              banned={part.banned}
            />
          ) : (
            <PartThumb image={null} partClass={kind} />
          )}
        </div>
        <div>
          <div className="role">{role}</div>
          {empty ? (
            <>
              <div className="pname ghost">{prompt}</div>
              <div className="psub">tap to search your parts</div>
            </>
          ) : (
            <>
              <div className="pname">{part.display_name}</div>
              <div className="psub">{slotSub(part)}</div>
              {part.type && (
                <span className="tb" style={{ color: typeColor(part.type) }}>
                  {typeLabel(part.type)}
                </span>
              )}
            </>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.max(2, Math.min(100, (value / STAT_MAX) * 100));
  return (
    <div className="stat">
      <div className="stat-h">
        <span className="stat-l">{label}</span>
        <b>{value}</b>
      </div>
      <div className="track">
        <div className="fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

type PickerProps = {
  kind: SlotKind;
  query: string;
  setQuery: (s: string) => void;
  results: OwnedEntry[];
  onChoose: (p: Part) => void;
};

const Picker = forwardRef<HTMLDivElement, PickerProps>(function Picker(
  { kind, query, setQuery, results, onChoose },
  ref,
) {
  const navigate = useNavigate();
  const placeholder = `Search ${kind}s you own`;
  return (
    <div className="picker" ref={ref}>
      <div className="pin">
        <Search size={13} />
        <input
          value={query}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>
      <ul>
        {results.length === 0 && (
          <li style={{ cursor: 'default' }}>
            <span className="nm" style={{ color: 'var(--faint)' }}>
              No matches
            </span>
          </li>
        )}
        {results.map((o) => (
          <li key={o.part.id} onClick={() => onChoose(o.part)}>
            <span className="ic">
              <PartThumb
                image={o.part.image}
                partClass={o.part.part_class}
                type={o.part.type}
                banned={o.part.banned}
              />
            </span>
            <span className="nm">
              {o.part.display_name}
              {o.part.short_name && (
                <em
                  style={{
                    fontStyle: 'normal',
                    color: 'var(--faint)',
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    marginLeft: 6,
                  }}
                >
                  {o.part.short_name}
                </em>
              )}
            </span>
            <span className="qt">×{o.quantity}</span>
          </li>
        ))}
      </ul>
      <div className="miss">
        <span>Can't find it?</span>
        <button className="b sm" onClick={() => navigate('/inventory/add')}>
          Add a custom part
        </button>
      </div>
    </div>
  );
});
