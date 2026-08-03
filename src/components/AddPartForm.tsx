import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import type { Part, PartClass } from '@/types/database';

type FormState = {
  display_name: string;
  part_class: PartClass;
  type: string;
  spin: string;
  line: string;
  atk: string;
  def: string;
  sta: string;
  dsh: string;
  brs: string;
  height_mm: string;
  weight_g: string;
  sides: string;
  gear: string;
};

const EMPTY: FormState = {
  display_name: '',
  part_class: 'blade',
  type: '',
  spin: '',
  line: '',
  atk: '',
  def: '',
  sta: '',
  dsh: '',
  brs: '',
  height_mm: '',
  weight_g: '',
  sides: '',
  gear: '',
};

const PART_CLASSES: { label: string; value: PartClass }[] = [
  { label: 'Blade', value: 'blade' },
  { label: 'Ratchet', value: 'ratchet' },
  { label: 'Bit', value: 'bit' },
];

const TYPES = ['', 'attack', 'defense', 'stamina', 'balance'];
const SPINS = ['', 'Right', 'Left', 'Dual'];
const LINES = ['', 'BX', 'UX'];

function squashName(display: string): string {
  return display.toUpperCase().replace(/[\s-]/g, '');
}

function toIntOrNull(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function toFloatOrNull(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function val(n: number | null): string {
  return n == null ? '' : String(n);
}

export function AddPartForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { partId } = useParams<{ partId: string }>();
  const isEdit = !!partId;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!isEdit);

  // When editing, load the existing custom part to pre-fill the form.
  useEffect(() => {
    if (!partId) return;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from('parts')
        .select('*')
        .eq('id', partId)
        .maybeSingle();
      if (cancelled) return;
      if (err || !data) {
        setError('Could not load that part.');
        setLoaded(true);
        return;
      }
      const part = data as Part;
      if (part.owner_id == null || (user && part.owner_id !== user.id)) {
        setError('You can only edit custom parts you own.');
        setLoaded(true);
        return;
      }
      setForm({
        display_name: part.display_name,
        part_class: part.part_class,
        type: part.type ?? '',
        spin: part.spin ?? '',
        line: part.line ?? '',
        atk: val(part.atk),
        def: val(part.def),
        sta: val(part.sta),
        dsh: val(part.dsh),
        brs: val(part.brs),
        height_mm: val(part.height_mm),
        weight_g: val(part.weight_g),
        sides: val(part.sides),
        gear: val(part.gear),
      });
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [partId, user]);

  const showStats = useMemo(() => {
    if (form.part_class === 'bit') {
      return ['atk', 'dsh', 'sta', 'brs'];
    }
    return ['atk', 'def', 'sta'];
  }, [form.part_class]);

  const showHeight = form.part_class === 'ratchet';
  const showSides = form.part_class === 'ratchet';
  const showGear = form.part_class === 'bit';

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const name = form.display_name.trim();
    if (!name) {
      setError('Enter a part name.');
      return;
    }
    setBusy(true);
    setError(null);

    const search_terms = [squashName(name).toLowerCase()];

    const payload = {
      part_class: form.part_class,
      name: squashName(name),
      display_name: name,
      type: form.type || null,
      spin: form.spin || null,
      line: form.line || null,
      atk: toIntOrNull(form.atk),
      def: toIntOrNull(form.def),
      sta: toIntOrNull(form.sta),
      dsh: toIntOrNull(form.dsh),
      brs: toIntOrNull(form.brs),
      height_mm: showHeight ? toFloatOrNull(form.height_mm) : null,
      weight_g: toFloatOrNull(form.weight_g),
      gear: showGear ? toIntOrNull(form.gear) : null,
      sides: showSides ? toIntOrNull(form.sides) : null,
      search_terms,
    };

    if (isEdit && partId) {
      const { error: updateErr } = await supabase
        .from('parts')
        .update(payload)
        .eq('id', partId)
        .eq('owner_id', user.id);
      setBusy(false);
      if (updateErr) {
        setError(updateErr.message);
        return;
      }
      navigate('/inventory');
      return;
    }

    // Create mode: new custom part + add one to inventory.
    const id = crypto.randomUUID();
    const insertPayload = {
      ...payload,
      id,
      variant_name: null,
      short_name: null,
      canonical_id: null,
      spin_origin: null,
      product_line: null,
      hgt_stat: null,
      diameter_mm: null,
      total_height_mm: null,
      exposed_height_mm: null,
      is_metal_lock_chip: false,
      banned: false,
      simple_type: null,
      fixed_burst: null,
      ratchet_integrated: null,
      description: null,
      description_left: null,
      source: null,
      image: null,
      full_name: null,
      bit_note: null,
      ban_reason: null,
      product_codes: null,
      source_ids: null,
      in_products: null,
      variants: null,
      modes: null,
      release_at: null,
    };

    const { error: insertErr } = await supabase.from('parts').insert(insertPayload);
    if (insertErr) {
      setBusy(false);
      setError(insertErr.message);
      return;
    }

    const { error: invErr } = await supabase
      .from('inventory')
      .insert({ user_id: user.id, part_id: id, quantity: 1 });
    setBusy(false);
    if (invErr) {
      setError(
        'Part saved but could not add to inventory. Add it from the Inventory screen.',
      );
      return;
    }
    navigate('/inventory');
  }

  if (!loaded) {
    return (
      <div className="form">
        <div style={{ color: 'var(--faint)', fontFamily: 'var(--mono)', fontSize: 12 }}>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="form">
      <button
        className="b grey"
        style={{ marginBottom: 16 }}
        onClick={() => navigate('/inventory')}
      >
        <ArrowLeft size={13} />
        Back to inventory
      </button>

      <div className="eyebrow">Custom part</div>
      <h1
        style={{
          fontFamily: 'var(--cond)',
          fontWeight: 700,
          fontSize: 24,
          letterSpacing: '-.005em',
          margin: '0 0 6px',
        }}
      >
        {isEdit ? 'Edit part' : 'Add a part'}
      </h1>
      <p
        style={{
          fontSize: 13,
          color: 'var(--dim)',
          lineHeight: 1.6,
          margin: '0 0 18px',
        }}
      >
        {isEdit
          ? 'Change the name, class, and stats for this custom part. It stays yours alone and works in builds and decks like any other part.'
          : 'For a part the catalogue doesn\'t have. Custom parts are yours alone — they never join the shared catalogue, and they work in builds and decks like any other part. A custom part\'s picture is the placeholder for its class.'}
      </p>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="ap-name">Name</label>
          <input
            id="ap-name"
            type="text"
            value={form.display_name}
            onChange={(e) => set('display_name', e.target.value)}
            placeholder="e.g. Cobalt Dragoon"
            maxLength={80}
            required
          />
          <div className="hint">
            What you'll see on the card. Shown exactly as you type it.
          </div>
        </div>

        <div className="field">
          <label htmlFor="ap-class">Part class</label>
          <select
            id="ap-class"
            value={form.part_class}
            onChange={(e) => set('part_class', e.target.value as PartClass)}
          >
            {PART_CLASSES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="ap-type">Type</label>
          <select
            id="ap-type"
            value={form.type}
            onChange={(e) => set('type', e.target.value)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t === '' ? 'Unknown' : t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="ap-spin">Spin direction</label>
          <select
            id="ap-spin"
            value={form.spin}
            onChange={(e) => set('spin', e.target.value)}
          >
            {SPINS.map((s) => (
              <option key={s} value={s}>
                {s === '' ? 'Unknown' : s}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="ap-line">Line</label>
          <select
            id="ap-line"
            value={form.line}
            onChange={(e) => set('line', e.target.value)}
          >
            {LINES.map((l) => (
              <option key={l} value={l}>
                {l === '' ? 'Unknown' : l}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            borderTop: '1px solid var(--line)',
            margin: '18px 0 14px',
            paddingTop: 14,
          }}
        >
          <div className="eyebrow" style={{ margin: '0 0 10px' }}>
            Stats — enter what you know
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            {showStats.map((key) => (
              <div className="field" key={key} style={{ margin: 0 }}>
                <label htmlFor={`ap-${key}`}>{key.toUpperCase()}</label>
                <input
                  id={`ap-${key}`}
                  type="number"
                  min={0}
                  max={100}
                  value={form[key as keyof FormState]}
                  onChange={(e) =>
                    set(key as keyof FormState, e.target.value)
                  }
                  placeholder="0–100"
                />
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            borderTop: '1px solid var(--line)',
            margin: '4px 0 14px',
            paddingTop: 14,
          }}
        >
          <div className="eyebrow" style={{ margin: '0 0 10px' }}>
            Measurements
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            {showHeight && (
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="ap-height">Height (mm)</label>
                <input
                  id="ap-height"
                  type="number"
                  step="0.1"
                  min={0}
                  value={form.height_mm}
                  onChange={(e) => set('height_mm', e.target.value)}
                  placeholder="e.g. 6.0"
                />
              </div>
            )}
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="ap-weight">Weight (g)</label>
              <input
                id="ap-weight"
                type="number"
                step="0.1"
                min={0}
                value={form.weight_g}
                onChange={(e) => set('weight_g', e.target.value)}
                placeholder="e.g. 38.2"
              />
            </div>
            {showSides && (
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="ap-sides">Sides</label>
                <input
                  id="ap-sides"
                  type="number"
                  min={0}
                  max={12}
                  value={form.sides}
                  onChange={(e) => set('sides', e.target.value)}
                  placeholder="e.g. 3"
                />
              </div>
            )}
            {showGear && (
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="ap-gear">Gear</label>
                <input
                  id="ap-gear"
                  type="number"
                  min={0}
                  value={form.gear}
                  onChange={(e) => set('gear', e.target.value)}
                  placeholder="e.g. 16"
                />
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="note form-error" style={{ marginTop: 14 }}>
            {error}
          </div>
        )}

        <div className="btnrow">
          <button
            type="button"
            className="b grey"
            onClick={() => navigate('/inventory')}
          >
            Cancel
          </button>
          <button type="submit" className="b go" disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add part'}
          </button>
        </div>
      </form>
    </div>
  );
}
