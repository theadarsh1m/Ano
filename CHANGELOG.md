# Changelog

All notable changes to the ANO turn-based multiplayer framework will be documented in this file.

## [1.1.0] - 2026-07-18

### Added
- **Ink & Deception Game**: A turn-based Authoritative multiplayer social deduction drawing game for 3 to 10 players.
  - Auth State Machine: authorative transitions, timers, scores, and stroke registrations.
  - Interactive Canvas: Smooth, antialiased, responsive HTML5 canvas rendering with velocity-simulated brush thickness.
  - Replay System: Linear frame-by-frame redrawing sequence player.
  - Sound Synth: Web Audio API synthesizers for card flips, clicks, drawing sounds, and game cues.
  - Simplified Word Packs: Added simple, easy-to-draw defaults for 18 categories.
  - One-click Accusations: Streamlined single-tap suspect lock-in.

### Fixed
- Fixed canvas segment blinking by eliminating redundant redraws on stroke completion.
- Resolved server crashes inside play-again lobby recreation by instantiating the player list as a Map.
- Fixed stale closures in the role reveal modal by binding parameters inside useEffect to useRef state.
