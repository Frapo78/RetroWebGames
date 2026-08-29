# Solitario — variant architecture and Klondike contract

Solitario is RetroWebGames' extensible card-game shell. The current playable variant is classic Klondike draw-one with a standard 52-card poker deck.

## Runtime files

- `games/solitaire/index.html`
- `games/solitaire/variants.js` — authoritative variant registry/configuration
- `games/solitaire/card-art.js` — cached original classic French-suited SVG artwork
- `games/solitaire/input-guard.js` — browser gesture/zoom suppression for the game surface
- `games/solitaire/auto-move.js` — pure cyclic destination resolver for double-tap moves
- `games/solitaire/game.js` — authoritative gameplay runtime and logical resume adapter
- `games/solitaire/session-adapter.js` — persistence compatibility/version wrapper
- `games/solitaire/style.css`
- root `rwg-session.js` / `rwg-session.css` — centralized autosave/resume infrastructure loaded by `game-hud.js`

Load order is `variants.js` → `card-art.js` → `input-guard.js` → `auto-move.js` → `game.js` → `session-adapter.js` → shared `game-hud.js` → `orientation.js`.

## Variant model

Do not hard-code future variants into unrelated UI code. New variants belong in `variants.js` and should reuse the common engine where possible or add a clearly isolated rules adapter.

Current registry:

- `klondike` — playable

Reserved roadmap directions include Klondike draw-3, Spider, FreeCell and Pyramid. They are not claims of current playability.

## Current classic variant: Klondike draw-one

Rules that MUST remain true unless the variant is intentionally changed:

- one 52-card deck;
- four suits: spades, hearts, diamonds and clubs;
- seven tableau columns containing 1..7 cards;
- only the exposed bottom card of each initial column is face-up;
- remaining 24 cards enter the stock;
- stock draws one card at a time to waste;
- when stock is exhausted, waste may be recycled into stock;
- tableau builds downward by rank while alternating red/black;
- only a King may enter an empty tableau column;
- face-up valid sequences may move together;
- foundations build A → K in the same suit;
- newly exposed tableau cards flip face-up automatically;
- all 52 cards in foundations is the win condition.

## Interaction

The engine is mobile-first and also supports mouse/desktop input:

- tap a movable card/sequence to select it, then tap a valid destination;
- drag a card or valid tableau sequence directly to its destination;
- double-tap an eligible card or exposed valid sequence to move it automatically: foundation is considered first, followed by legal tableau columns from left to right;
- repeated double taps on the same card continue from the next destination and wrap cyclically, so ambiguous legal placements remain under player control;
- `ANNULLA` restores card state, moves and score but does not rewind elapsed play time;
- `AIUTO` highlights one legal immediate move without changing state;
- `NUOVA` starts a fresh shuffled hand;
- `pauseBtn` is mandatory because shared `orientation.js` uses it during smartphone rotation.

### Draw pile ergonomics — CRITICAL

Stock and waste are deliberately separated from the upper foundation row.

- `#drawPileDock` is visually anchored in the **lower-right** portion of the game, immediately above the bottom controls.
- The dock contains exactly two horizontal slots.
- **Stock / draw pile is on the left.**
- **Waste / currently turned card is on the right.**
- The dock remains a DOM descendant of `#board` even though it is viewport-positioned. This preserves the existing delegated pointer/tap/drag/double-tap logic without adding duplicate card handlers.
- The upper row retains two empty spacer columns, the live card-style selector and the four foundations so their established alignment does not shift unexpectedly.
- The board reserves vertical space for the dock so the lower cards are not hidden behind it.

Do not move stock/waste back to the upper row unless the interaction design is intentionally changed.

### Browser zoom suppression — CRITICAL

During Solitario gameplay, browser page zoom must not compete with card gestures, especially double tap.

The page uses layered protection because no single browser mechanism is sufficient across mobile engines:

1. viewport metadata fixes `initial-scale`, `minimum-scale` and `maximum-scale` to `1` and sets `user-scalable=no`;
2. the game surface uses `touch-action:none` / `-ms-touch-action:none` and disables browser callout/selection behavior that interferes with gestures;
3. `input-guard.js` prevents WebKit `gesturestart`, `gesturechange` and `gestureend`;
4. native `dblclick` default behavior is prevented;
5. multi-touch `touchstart`/`touchmove` pinch gestures are prevented;
6. a same-area rapid `touchend` pair suppresses legacy double-tap zoom while leaving the game's Pointer Events double-tap logic intact;
7. Ctrl/Meta + wheel zoom gestures are prevented while the game page is active.

The game-level double tap is still handled by `game.js` and must continue to resolve all legal automatic destinations. Browser zoom suppression MUST NOT replace or remove that game gesture.

### Automatic-move transaction and animation

`auto-move.js` owns only deterministic destination ordering/cycling. `game.js` remains authoritative for legality and always commits the selected action through `performMove()`, preserving Undo, scoring, reveal, win detection and session dirty marking.

The leading card ID owns the cycle cursor. A different card or a manual state mutation resets it. Automatic placement uses a 210 ms FLIP/Web Animations transition from the old card rectangles to the freshly rendered legal destination; the logical move is atomic and immediate. Valid tableau sequences animate as a stack. Reduced-motion preference skips the transition without changing behavior.

## Resumable unfinished hand — CRITICAL

An unfinished hand must survive accidental browser/app termination, reload, tab closure and deliberate return to the RetroWebGames menu.

Solitario exposes a logical `RWGResumeAdapter`; `session-adapter.js` wraps it with persistence version `2` and compatibility token `solitaire-klondike-state-v2-52cards-draw1`.

Persisted authoritative state includes:

- variant id;
- stock and waste order/visibility;
- all four foundations;
- all seven tableau columns and face-up state;
- moves;
- score;
- elapsed play time.

Undo history is intentionally not persisted. After restore, Undo starts accumulating again from the resumed hand.

### Autosave cadence

Storage orchestration is centralized in root `rwg-session.js`.

Current platform behavior:

- meaningful card mutations call `RWGSession.markDirty()`;
- dirty saves are debounced by **750 ms**;
- an idle-friendly heartbeat checkpoints about every **5 seconds**;
- unchanged logical snapshots are not redundantly rewritten during normal heartbeat saves;
- synchronous checkpoints protect progress on hidden/background, `pagehide`, `beforeunload`, Page Lifecycle `freeze` and same-tab navigation;
- no session write occurs per animation frame.

### Resume prompt

When a compatible unfinished snapshot exists, shared `rwg-session.js` shows:

**“Vuoi continuare la partita precedente?”**

- `No` — red, left: discards the snapshot and starts a new shuffled hand;
- `Sì` — green, right: restores the hand without incrementing the deals counter.

This resume is free and unrelated to the one-credit arcade Game Over Continue mechanism.

### Snapshot validation

Restore requires, at minimum:

- platform/session compatibility checks;
- matching Solitaire adapter version and compatibility token;
- exactly 52 canonical card objects;
- 52 unique ids;
- valid suit/rank/id combinations;
- stock cards face-down and waste cards face-up;
- foundations ordered A→K in their own suit;
- seven valid tableau columns;
- no face-down card below an exposed face-up sequence;
- valid descending alternating-color exposed runs;
- finite non-negative moves, score and elapsed time.

Corrupt or incompatible snapshots are removed rather than partially repaired.

The unfinished snapshot is cleared on victory. Starting a deliberate new hand also replaces the previous unfinished state with the new deal.

## Scoring and local statistics

Klondike awards small positive values for reveals, foundation moves and useful tableau moves, while moving a foundation card back to tableau carries a penalty. Score is clamped to zero.

Local convenience statistics include deals, wins, best completion time and best score. They are not server-authoritative identity or anti-cheat state.

## Victory lifecycle

Solitario has no forced terminal loss state: an unwinnable or unwanted hand is abandoned by starting a new deal.

A completed hand uses its dedicated victory presentation and MUST NOT emit `rwg:game-ended`, because that event opens the shared loss/Game Over flow. Victory clears the unfinished-hand snapshot.

## Performance

The game intentionally uses DOM/CSS rather than Canvas:

- at most 52 card nodes plus small UI elements are rendered;
- the board rerenders only after discrete card-state changes;
- the animation-frame loop updates elapsed time only;
- card interaction uses event delegation rather than listeners on every card;
- drag stacks use one temporary ghost;
- resumable snapshots are small, throttled and centrally deduplicated;
- no external card image dependency is required.

## Card artwork

`card-art.js` generates and caches original inline SVG artwork:

- warm ivory stock and traditional card proportions;
- conventional black spades/clubs and red hearts/diamonds;
- mirrored corner indices and standard Ace–10 pip layouts;
- mirrored Jack/Queen/King portraits;
- ornamental Ace of Spades;
- symmetric traditional card back.

The live card-style selector remains in the third upper slot. `Essential` is the default; an explicitly persisted `Classic` selection remains respected. Changing style does not restart or mutate the hand. Essential faces keep only the upper-left suit and upper-right canonical rank (`A`, `2`–`10`, `J`, `Q`, `K`), both at size `43.125` (25% below their former `57.5`) and in the suit colour. The second large rank is recentered at `y=90` below the reduced upper band. A large matching suit sits behind and slightly below it at `y=118`, with low opacity and a light blur. No lower-right suit is rendered. The two `10` labels retain the same typeface and proportional horizontal fitting at their respective sizes.

## Validation

After Solitario changes run:

```bash
node --check games/solitaire/input-guard.js
node --check games/solitaire/auto-move.js
node --check games/solitaire/game.js
node --check games/solitaire/session-adapter.js
node scripts/validate-solitaire.mjs
node scripts/validate-contracts.mjs
```

Browser smoke tests should include:

- rapid double taps on cards without page zoom;
- pinch attempts without page zoom;
- double tap on waste/tableau/foundation cards chooses a legal destination;
- repeated double taps on one ambiguous card cycle through at least two legal tableau destinations and wrap;
- the 210 ms move animation is smooth and the reduced-motion path remains instantaneous;
- stock tap/recycle in the lower-right dock;
- drag/tap of the waste card from the lower-right dock;
- dock placement on narrow and short portrait phones;
- resume Yes/No after deliberate menu exit/reload.
