import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { X, Plus, Pencil, ArrowRightLeft, Search, Save } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import {
  loadBuilds,
  loadDecks,
  setDeckSlot,
  clearDeckSlot,
  errorMessage,
  type BuildWithParts,
  type DeckWithBuilds,
} from '@/lib/buildData';
import {
  evaluateDeck,
  type Archetype,
} from '@/lib/deckRules';
import {
  typeColor,
  typeLabel,
  joinSub,
} from '@/components/PartCard';
import { PartThumb } from '@/lib/partImage';

const ARCH_LABELS: { key: Archetype; label: string }[] = [
  { key: 'attack', label: 'Attack' },
  { key: 'defense', label: 'Defense' },
  { key: 'stamina', label: 'Stamina' },
  { key: 'balance', label: 'Balance' },
];

export function DeckEditor() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { deckId } = useParams<{ deckId: string }>();
  const [deck, setDeck] = useState<DeckWithBuilds | null>(null);
  const [allBuilds, setAllBuilds] = useState<BuildWithParts[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [nameSaved, setNameSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [swapSlot, setSwapSlot] = useState<number | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!user || !deckId) return;
    try {
      const builds = await loadBuilds(user.id);
      setAllBuilds(builds);
      const decks = await loadDecks(user.id, builds);
      const found = decks.find((d) => d.id === deckId) ?? null;
      setDeck(found);
      if (found) setNameInput(found.name);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [user, deckId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Close picker on outside click.
  useEffect(() => {
    if (swapSlot === null) return;
    function onDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setSwapSlot(null);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [swapSlot]);

  const usedBuildIds = useMemo(
    () =>
      deck
        ? new Set(
            deck.slots
              .filter((s): s is BuildWithParts => s != null)
              .map((s) => s.buildId),
          )
        : new Set<string>(),
    [deck],
  );

  const status = useMemo(
    () => (deck ? evaluateDeck(deck.slots) : null),
    [deck],
  );

  const pickerResults = useMemo(() => {
    if (swapSlot === null) return [];
    const q = pickerQuery.trim().toLowerCase();
    const list = q
      ? allBuilds.filter((b) => b.name.toLowerCase().includes(q))
      : allBuilds;
    return list;
  }, [swapSlot, allBuilds, pickerQuery]);

  async function handleSaveName() {
    if (!deck || busy) return;
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === deck.name) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('decks')
        .update({ name: trimmed })
        .eq('id', deck.id);
      if (err) throw err;
      setNameSaved('Deck renamed');
      setTimeout(() => setNameSaved(null), 2000);
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(position: number) {
    if (!deck || busy) return;
    setBusy(true);
    setError(null);
    try {
      await clearDeckSlot(deck.id, position);
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSwapIn(buildId: string, position: number) {
    if (!deck || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setDeckSlot(deck.id, buildId, position);
      setSwapSlot(null);
      setPickerQuery('');
      await refresh();
    } catch (e) {
      const msg = errorMessage(e);
      if (/duplicate|unique|violates|already/i.test(msg)) {
        setError('That Bey is already in this deck.');
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  function openSwap(position: number) {
    setSwapSlot(position);
    setPickerQuery('');
  }

  if (deck === null && error) {
    return <div className="note form-error" style={{ margin: '16px 18px' }}>{error}</div>;
  }

  if (deck === null) {
    return (
      <div style={{ padding: '40px 18px', color: 'var(--faint)', fontFamily: 'var(--mono)', fontSize: 12 }}>
        Loading deck…
      </div>
    );
  }

  if (deck && !deck.id) {
    return (
      <div className="empty">
        <div className="empty-eyebrow">Deck editor</div>
        <div className="empty-title">Deck not found</div>
        <div className="empty-body">
          This deck may have been deleted.
        </div>
        <button className="b go" onClick={() => navigate('/decks')}>Back to decks</button>
      </div>
    );
  }

  return (
    <>
      <div className="filters">
        <div className="find build-name-find" style={{ flex: 0, minWidth: 220 }}>
          <input
            value={nameInput}
            placeholder={deck.name}
            onChange={(e) => setNameInput(e.target.value)}
            aria-label="Deck name"
          />
        </div>
        <button className="b" onClick={handleSaveName} disabled={busy || !nameInput.trim() || nameInput.trim() === deck.name}>
          <Save size={12} />
          Save name
        </button>
        <span style={{ flex: 1 }} />
        <button className="b" onClick={() => navigate('/collection')}>
          <Plus size={12} />
          Go to collection
        </button>
      </div>

      {error && (
        <div className="note form-error" style={{ margin: '12px 18px 0' }}>{error}</div>
      )}
      {nameSaved && !error && (
        <div className="note" style={{ margin: '12px 18px 0' }}>{nameSaved}</div>
      )}

      <div className="editor-slots">
        {deck.slots.map((slot, i) => {
          const position = i + 1;
          if (!slot) {
            return (
              <div key={i} className="editor-slot empty">
                <div className="editor-empty-inner">
                  <div className="editor-empty-title">Slot {position}</div>
                  <div className="editor-empty-actions">
                    {allBuilds.length > 0 ? (
                      <button className="b" onClick={() => openSwap(position)}>
                        <ArrowRightLeft size={12} />
                        Choose a build
                      </button>
                    ) : (
                      <div style={{ color: 'var(--faint)', fontSize: 12, textAlign: 'center' }}>
                        No Beys to add yet
                      </div>
                    )}
                    <button className="b accent" onClick={() => navigate('/builder')}>
                      <Plus size={12} />
                      Build new
                    </button>
                  </div>
                </div>
                {swapSlot === position && (
                  <BuildPicker
                    ref={pickerRef}
                    query={pickerQuery}
                    setQuery={setPickerQuery}
                    results={pickerResults}
                    usedBuildIds={usedBuildIds}
                    onChoose={(buildId) => handleSwapIn(buildId, position)}
                    onClose={() => setSwapSlot(null)}
                  />
                )}
              </div>
            );
          }

          const integrated = slot.blade?.ratchet_integrated === true;
          return (
            <div key={i} className="editor-slot">
              <div className="editor-slot-head">
                <span className="editor-slot-pos">Slot {position}</span>
                {slot.blade?.type && (
                  <span className="editor-slot-type" style={{ color: typeColor(slot.blade.type) }}>
                    {typeLabel(slot.blade.type)}
                  </span>
                )}
              </div>
              <div className="editor-slot-body">
                <div className="editor-slot-bey">
                  <div className="editor-slot-name">{slot.name}</div>
                  <div className="bey-parts">
                    <div className="bey-part">
                      <span className="ppart"><PartThumb image={slot.blade?.image ?? null} alt={slot.blade?.display_name ?? ''} partClass="blade" type={slot.blade?.type ?? null} banned={slot.blade?.banned ?? false} /></span>
                      <span className="plabel">Blade</span>
                      <span className="pname-sm">{slot.blade?.display_name ?? '—'}</span>
                    </div>
                    {integrated ? (
                      <div className="bey-part na">
                        <span className="ppart"><PartThumb image={null} partClass="ratchet" /></span>
                        <span className="plabel">Ratchet</span>
                        <span className="pname-sm">Integrated</span>
                      </div>
                    ) : (
                      <div className="bey-part">
                        <span className="ppart"><PartThumb image={slot.ratchet?.image ?? null} alt={slot.ratchet?.display_name ?? ''} partClass="ratchet" type={slot.ratchet?.type ?? null} banned={slot.ratchet?.banned ?? false} /></span>
                        <span className="plabel">Ratchet</span>
                        <span className="pname-sm">{slot.ratchet?.display_name ?? '—'}</span>
                      </div>
                    )}
                    <div className="bey-part">
                      <span className="ppart"><PartThumb image={slot.bit?.image ?? null} alt={slot.bit?.display_name ?? ''} partClass="bit" type={slot.bit?.type ?? null} banned={slot.bit?.banned ?? false} /></span>
                      <span className="plabel">Bit</span>
                      <span className="pname-sm">{slot.bit?.display_name ?? '—'}</span>
                    </div>
                  </div>
                </div>
                <div className="editor-slot-actions">
                  <button className="b sm" onClick={() => navigate(`/builder/${slot.buildId}`)}>
                    <Pencil size={11} />
                    Edit
                  </button>
                  <button className="b sm" onClick={() => openSwap(position)}>
                    <ArrowRightLeft size={11} />
                    Swap
                  </button>
                  <button className="b sm del" onClick={() => handleRemove(position)}>
                    <X size={11} />
                    Remove
                  </button>
                </div>
              </div>
              {swapSlot === position && (
                <BuildPicker
                  ref={pickerRef}
                  query={pickerQuery}
                  setQuery={setPickerQuery}
                  results={pickerResults}
                  usedBuildIds={usedBuildIds}
                  onChoose={(buildId) => handleSwapIn(buildId, position)}
                  onClose={() => setSwapSlot(null)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Legality + coverage panels */}
      <div className="editor-panel">
        <div className="editor-panel-head">
          <span className="editor-panel-title">Legality</span>
          <span className="deck-card-status">
            <span className={`dot ${status?.legal && status?.filledCount === 3 ? 'ok' : 'warn'}`} />
            {status?.legal && status?.filledCount === 3
              ? 'WBO legal'
              : status?.filledCount === 0
                ? 'Empty'
                : 'Not WBO legal'}
          </span>
        </div>
        <div className="editor-panel-body">
          {status && status.issues.length === 0 && status.filledCount === 3 && (
            <div className="editor-issue ok">This deck meets WBO rules.</div>
          )}
          {status && status.issues.length === 0 && status.filledCount < 3 && (
            <div className="editor-issue ok">
              No rule violations. Fill {3 - status.filledCount} more slot{3 - status.filledCount === 1 ? '' : 's'} for a full deck.
            </div>
          )}
          {status?.issues.map((issue, i) => (
            <div key={i} className={`editor-issue ${issue.severity}`}>
              {issue.message}
            </div>
          ))}
        </div>
      </div>

      <div className="editor-panel">
        <div className="editor-panel-head">
          <span className="editor-panel-title">Type coverage</span>
          {status?.coverage.allSameType && status.coverage.types.length === 1 && (
            <span style={{ color: 'var(--warn)', fontFamily: 'var(--mono)', fontSize: 10 }}>
              All Beys share one type
            </span>
          )}
        </div>
        <div className="editor-panel-body">
          <div className="deck-coverage">
            {ARCH_LABELS.map((a) => {
              const active = status?.coverage.types.includes(a.key) ?? false;
              return (
                <span
                  key={a.key}
                  className={`cov-chip${active ? ' active' : ''}`}
                  style={active ? { color: typeColor(a.key) } : undefined}
                >
                  {a.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="editor-panel">
        <div className="editor-panel-head">
          <span className="editor-panel-title">Spin coverage</span>
        </div>
        <div className="editor-panel-body">
          {status && status.coverage.spins.length > 0 ? (
            <div className="deck-coverage">
              {status.coverage.spins.map((s) => (
                <span key={s} className="cov-chip active" style={{ textTransform: 'capitalize' }}>
                  {s}-spin
                </span>
              ))}
              {status.coverage.bothSpins && (
                <span className="cov-chip active" style={{ color: 'var(--ok)' }}>
                  Both directions
                </span>
              )}
              {!status.coverage.bothSpins && status.coverage.spins.length === 1 && (
                <span className="cov-chip">One direction only</span>
              )}
            </div>
          ) : (
            <div className="editor-issue ok">No Beys to assess.</div>
          )}
        </div>
      </div>

      <div className="foot">
        <div className="foot-l">
          <span>{status?.filledCount ?? 0} of 3 slots filled</span>
        </div>
        <div className="foot-r" />
      </div>
    </>
  );
}

type PickerProps = {
  query: string;
  setQuery: (s: string) => void;
  results: BuildWithParts[];
  usedBuildIds: Set<string>;
  onChoose: (buildId: string) => void;
  onClose: () => void;
};

const BuildPicker = forwardRef<HTMLDivElement, PickerProps>(function BuildPicker(
  { query, setQuery, results, usedBuildIds, onChoose, onClose },
  ref,
) {
  return (
    <div className="picker" ref={ref}>
      <div className="pin">
        <Search size={13} />
        <input
          value={query}
          placeholder="Search your Beys"
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <button className="b grey icon" style={{ height: 24, width: 24, minHeight: 24 }} onClick={onClose} aria-label="Close">
          <X size={13} />
        </button>
      </div>
      <ul>
        {results.length === 0 && (
          <li style={{ cursor: 'default' }}>
            <span className="nm" style={{ color: 'var(--faint)' }}>
              No Beys found
            </span>
          </li>
        )}
        {results.map((b) => {
          const used = usedBuildIds.has(b.buildId);
          const integrated = b.blade?.ratchet_integrated === true;
          const sub = joinSub([
            b.blade?.display_name ?? null,
            integrated ? 'integrated' : b.ratchet?.short_name ?? b.ratchet?.display_name ?? null,
            b.bit?.short_name ?? b.bit?.name ?? null,
          ]);
          return (
            <li
              key={b.buildId}
              className={used ? 'used' : ''}
              onClick={used ? undefined : () => onChoose(b.buildId)}
              aria-disabled={used || undefined}
            >
              <span className="ic">
                <PartThumb image={b.blade?.image ?? null} partClass="blade" type={b.blade?.type ?? null} banned={b.blade?.banned ?? false} />
              </span>
              <span className="nm">
                {b.name}
                <em style={{ fontStyle: 'normal', color: 'var(--faint)', fontFamily: 'var(--mono)', fontSize: 10, marginLeft: 6 }}>
                  {used ? 'In this deck' : sub}
                </em>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
});
