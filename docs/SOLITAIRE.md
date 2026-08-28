# Solitario — variant architecture and Klondike contract

Solitario is RetroWebGames' extensible card-game shell. The current playable variant is classic Klondike with a standard 52-card poker deck.

## Runtime files

- `games/solitaire/index.html`
- `games/solitaire/variants.js` — authoritative variant registry/configuration
- `games/solitaire/card-art.js` — cached original classic French-suited SVG artwork
- `games/solitaire/game.js` — current shared Solitaire runtime and resume-state adapter
- `games/solitaire/style.css`
- root `rwg-session.js` / `rwg-session.css` — shared autosave/resume infrastructure

`variants.js` and `card-art.js` MUST load before `game.js`. For Solitario, the shared `rwg-session.js` is explicitly loaded immediately after the game runtime so a previous unfinished hand can be detected before ordinary shared HUD bootstrap completes. `game-hud.js` also owns a fallback session-service bootstrap for future resumable games.

## Variant model

Do not hard-code future variants into unrelated UI code. New variants should be registered in `variants.js` and either reuse the common engine rules or add a clearly isolated rules adapter.

Current registry:

- `klondike` — playable

Reserved future directions currently documented by the registry:

- Klondike draw-3
- Spider
- FreeCell
- Pyramid

These are roadmap entries, not claims of current playability.

## Current classic variant: Klondike draw-one

Rules that MUST remain true unless the variant itself is intentionally changed:

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

The engine is mobile-first but also works with mouse/desktop input:

- tap a movable card/sequence to select it, then tap a valid destination;
- drag a card or valid tableau sequence directly to its destination;
- double-tap a single eligible card to send it to its foundation;
- `ANNULLA` restores card state, moves and score but deliberately does not rewind elapsed real play time;
- `AIUTO` highlights one legal immediate move without changing state;
- `NUOVA` starts a fresh shuffled hand;
- `pauseBtn` is mandatory because shared `orientation.js` uses it to pause/resume on smartphone rotation.

## Resumable unfinished hand — CRITICAL

An unfinished Solitario hand must survive accidental browser/app termination, reload, tab closure and deliberate return to the RetroWebGames menu.

Solitario exposes `window.RWGResumeAdapter` with a versioned state schema. The adapter serializes only the minimum authoritative hand state:

- variant id;
- stock and waste card order/visibility;
- all four foundations;
- all seven tableau columns and face-up state;
- moves;
- score;
- elapsed play time.

Undo history is intentionally not persisted. This keeps snapshots small and avoids multiplying the 52-card state dozens of times. After a restored hand, Undo begins accumulating again from the resumed state.

### Autosave cadence

Storage orchestration is centralized in root `rwg-session.js`, not duplicated inside Solitario.

Current behavior:

- discrete moves (`move`, stock draw/recycle, Undo, new deal) mark the session dirty;
- dirty state is debounced by roughly **900 ms**, avoiding a localStorage write for every rapid interaction;
- a lightweight checkpoint runs about every **7 seconds** while the game is active so elapsed time is also captured;
- unchanged snapshots are not redundantly rewritten during ordinary autosave heartbeats;
- a final synchronous checkpoint is forced on hidden/background, `pagehide`, `beforeunload`, Page Lifecycle `freeze`, and same-tab navigation such as returning to the menu;
- no storage serialization/write occurs per animation frame.

### Resume prompt

When a compatible unfinished snapshot exists at the next Solitario launch, shared `rwg-session.js` shows a modal before normal play:

**“Vuoi continuare la partita precedente?”**

Buttons are side by side:

- `No` — red, on the left: permanently discards the old snapshot and immediately starts a new shuffled hand;
- `Sì` — green, on the right: restores the saved hand exactly and resumes play without incrementing the deals counter.

This resume is free and is completely unrelated to the one-credit Game Over Continue mechanism used by arcade games.

### Snapshot validation

A persisted hand is restored only if it passes structural validation. At minimum the runtime requires:

- exactly 52 card objects;
- 52 unique canonical card ids;
- valid suit/rank/id combinations;
- stock cards face-down and waste cards face-up;
- foundations ordered A→K in their own suit;
- tableau has the correct number of columns;
- no face-down card may appear below an exposed face-up sequence;
- exposed tableau sequences remain valid descending alternating-color runs;
- non-negative finite moves, score and elapsed time;
- matching adapter/schema version.

Corrupt or incompatible snapshots are removed and a clean new deal is started rather than attempting a partial restore.

The resumable snapshot is cleared on successful victory. Starting a deliberate new hand also replaces the previous snapshot with the fresh deal.

## Scoring and local statistics

Klondike currently awards small positive values for reveals, foundation moves and useful tableau moves, while moving a foundation card back to tableau carries a penalty. Score is clamped to zero.

The client locally stores:

- deals;
- wins;
- best completion time;
- best score.

This is local convenience data, not server-authoritative identity or competitive anti-cheat state.

## Victory lifecycle

Solitario currently has no forced terminal loss state: an unwinnable/undesired hand is abandoned by starting a new deal.

A completed Klondike hand uses a dedicated **victory** presentation rather than the shared `GAME OVER` component. Therefore victory MUST NOT emit `rwg:game-ended`, because that event semantically opens the terminal loss/Game Over flow.

Victory also clears `RWGSession`'s unfinished-hand snapshot so a completed deal is never offered as resumable on the next launch.

If RetroWebGames later gains a shared victory/results component, migrate this behavior intentionally rather than abusing `RWGGameOver`.

## Performance

The game intentionally uses DOM/CSS rather than Canvas:

- at most 52 card nodes plus small UI elements are rendered;
- whole-board rerender occurs only after discrete card-state changes, not every animation frame;
- the animation frame loop updates only elapsed time;
- event delegation is used for card interaction rather than attaching listeners to every card;
- drag stacks use a temporary lightweight ghost;
- resumable snapshots are small, throttled and centrally deduplicated;
- no external dependency or card image asset is required.

## Classic card artwork

The playable deck uses original inline SVG generated by `card-art.js`, with no external raster image or branded deck asset:

- warm ivory card stock, fine border and restrained shadow;
- conventional black spades/clubs and red hearts/diamonds;
- mirrored corner indices and standard pip counts/layouts for Ace through 10;
- dedicated mirrored court portraits for Jack, Queen and King;
- an enlarged ornamental Ace of Spades;
- a symmetric red, blue and gold traditional card back.

Face and back SVG strings are cached and reused by stock, waste, foundations, tableau and drag ghosts. Card geometry and interactive hitboxes remain owned by the existing DOM/CSS layout.

### Selectable card sets

The third upper-pile slot contains the live deck-style selector. It can be changed at any point during a hand without changing cards, move count, score, history or elapsed time, and the preference persists locally.
Essential is the default for new users; an explicitly persisted Classic choice continues to be respected.

- **Classic** retains standard pip layouts, ornamental Ace of Spades and mirrored J/Q/K portraits.
- **Essential** retains the same French-suited symbols, serif typography, red/black palette, ivory stock and classic back, but intentionally has no pip field or court illustration. It shows only a large centered rank (`A, 2..10, J, Q, K`) and a large suit in the upper-left/lower-right corners.

WASM is not useful for this game.

## Validation

After Solitario/resume changes run:

```bash
node --check rwg-session.js
node --check games/solitaire/variants.js
node --check games/solitaire/card-art.js
node --check games/solitaire/game.js
node scripts/validate-solitaire.mjs
node scripts/validate-contracts.mjs
```

Browser smoke tests must cover both decisions of the resume modal and at least one deliberate menu exit/reload path.
