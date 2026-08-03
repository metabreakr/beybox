import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, FolderPlus } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import {
  loadBuilds,
  type BuildWithParts,
  combinedStats,
  errorMessage,
} from '@/lib/buildData';
import { isBeyComplete } from '@/lib/deckRules';
import { AddToDeckSheet } from '@/components/AddToDeckSheet';
import { typeColor, typeLabel } from '@/components/PartCard';
import { PartThumb } from '@/lib/partImage';

const STAT_MAX = 100;

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.max(2, Math.min(100, (value / STAT_MAX) * 100));
  return (
    <div className="bar">
      <span>{label}</span>
      <div className="track">
        <div className="fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

type BuildCardProps = {
  build: BuildWithParts;
  onEdit: () => void;
  onDelete: () => void;
  onAddToDeck: () => void;
};

function BuildCard({ build, onEdit, onDelete, onAddToDeck }: BuildCardProps) {
  const stats = combinedStats(build);
  const complete = isBeyComplete(build);
  const integrated = build.blade?.ratchet_integrated === true;
  const bladeType = build.blade?.type ?? null;

  return (
    <div className={`card${complete ? ' active' : ' marked'}`}>
      <div className="thumb bey-thumb">
        <PartThumb image={build.blade?.image ?? null} alt={build.blade?.display_name ?? ''} partClass="blade" type={build.blade?.type ?? null} banned={build.blade?.banned ?? false} />
      </div>
      <div className="cbody">
        <div className="cname">{build.name}</div>
        <div className="csub">
          {complete ? 'Complete' : 'Incomplete'}
          {integrated ? ' · integrated ratchet' : ''}
          {bladeType ? ` · ${typeLabel(bladeType)}` : ''}
        </div>

        <div className="bey-parts">
          <div className="bey-part">
            <span className="ppart"><PartThumb image={build.blade?.image ?? null} alt={build.blade?.display_name ?? ''} partClass="blade" type={build.blade?.type ?? null} banned={build.blade?.banned ?? false} /></span>
            <span className="plabel">Blade</span>
            <span className="pname-sm">{build.blade?.display_name ?? '—'}</span>
          </div>
          {integrated ? (
            <div className="bey-part na">
              <span className="ppart"><PartThumb image={null} partClass="ratchet" /></span>
              <span className="plabel">Ratchet</span>
              <span className="pname-sm">Integrated</span>
            </div>
          ) : (
            <div className="bey-part">
              <span className="ppart"><PartThumb image={build.ratchet?.image ?? null} alt={build.ratchet?.display_name ?? ''} partClass="ratchet" type={build.ratchet?.type ?? null} banned={build.ratchet?.banned ?? false} /></span>
              <span className="plabel">Ratchet</span>
              <span className="pname-sm">{build.ratchet?.display_name ?? '—'}</span>
            </div>
          )}
          <div className="bey-part">
            <span className="ppart"><PartThumb image={build.bit?.image ?? null} alt={build.bit?.display_name ?? ''} partClass="bit" type={build.bit?.type ?? null} banned={build.bit?.banned ?? false} /></span>
            <span className="plabel">Bit</span>
            <span className="pname-sm">{build.bit?.display_name ?? '—'}</span>
          </div>
        </div>

        <div className="bars">
          <StatBar label="ATK" value={stats.atk} color="var(--atk)" />
          <StatBar label="DEF" value={stats.def} color="var(--def)" />
          <StatBar label="STA" value={stats.sta} color="var(--sta)" />
          <StatBar label="DSH" value={stats.dsh} color="var(--bal)" />
        </div>

        <div className="spec-mini">
          <span>{stats.height != null ? `${stats.height.toFixed(1)} mm` : '—'}</span>
          <span>{stats.weight > 0 ? `${stats.weight.toFixed(1)} g` : '—'}</span>
          <span>{stats.spin ?? '—'}</span>
        </div>

        <div className="actions">
          <button className="b sm" onClick={onEdit} title="Edit build" aria-label="Edit build">
            <Pencil size={12} strokeWidth={2.5} />
          </button>
          <button className="b sm" onClick={onAddToDeck} title="Add to deck" aria-label="Add to deck">
            <FolderPlus size={12} strokeWidth={2.5} />
            Add to deck
          </button>
          <button className="b sm del" onClick={onDelete} title="Delete build" aria-label="Delete build">
            <Trash2 size={12} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Collection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [builds, setBuilds] = useState<BuildWithParts[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetFor, setSheetFor] = useState<BuildWithParts | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await loadBuilds(user.id);
        if (!cancelled) setBuilds(list);
      } catch (e) {
        if (!cancelled) setError(errorMessage(e));
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const sorted = useMemo(() => {
    if (!builds) return null;
    return [...builds].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [builds]);

  async function handleDelete(build: BuildWithParts) {
    if (!user) return;
    const ok = window.confirm(`Delete ${build.name}? This removes it from any deck it's in.`);
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await supabase.from('deck_builds').delete().eq('build_id', build.buildId);
      const { error: err } = await supabase.from('builds').delete().eq('id', build.buildId);
      if (err) throw err;
      setBuilds((prev) => prev ? prev.filter((b) => b.buildId !== build.buildId) : prev);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="note form-error" style={{ margin: '16px 18px' }}>{error}</div>
    );
  }

  if (sorted && sorted.length === 0) {
    return (
      <div className="empty">
        <div className="empty-eyebrow">Collection</div>
        <div className="empty-title">No assembled Beys yet</div>
        <div className="empty-body">
          Head to the Builder to assemble your parts into a Bey, then it'll show up here.
        </div>
        <button className="b go" onClick={() => navigate('/builder')}>
          <Plus size={13} />
          Build a Bey
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="filters">
        <div className="find" style={{ flex: 0 }}>
          <span style={{ fontFamily: 'var(--cond)', fontWeight: 700, fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text)', paddingLeft: 4 }}>
            Collection
          </span>
        </div>
        <span style={{ flex: 1 }} />
        <button className="b go" onClick={() => navigate('/builder')}>
          <Plus size={13} />
          Build a Bey
        </button>
      </div>

      {error && (
        <div className="note form-error" style={{ margin: '12px 18px 0' }}>{error}</div>
      )}

      <div className="grid three">
        {sorted?.map((build) => (
          <BuildCard
            key={build.buildId}
            build={build}
            onEdit={() => navigate(`/builder/${build.buildId}`)}
            onDelete={() => handleDelete(build)}
            onAddToDeck={() => setSheetFor(build)}
          />
        ))}
      </div>

      {sheetFor && (
        <AddToDeckSheet
          build={sheetFor}
          onClose={() => setSheetFor(null)}
          onDeckChanged={() => { /* decks read fresh when opened */ }}
        />
      )}

      <div className="foot">
        <div className="foot-l">
          <span>{sorted?.length ?? 0} Beys</span>
        </div>
        <div className="foot-r" />
      </div>
    </>
  );
}
