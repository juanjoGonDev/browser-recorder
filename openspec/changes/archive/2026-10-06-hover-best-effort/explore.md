# Exploration: hover-best-effort

## Report (owner, 2026-10-06)

Replaying a real recording fails: the page scrolls up and down and the replay
times out. Owner's first guess was the "Confirmar" button selector.

## Evidence (CLI output, values redacted)

```
[14/18] click menuitem "Registrar horario" (10.2s)
[15/18] hover columnheader "Fecha" (10.6s)
✖ failed at step 15 (hover): locator.hover: Timeout 30000ms exceeded.
  - locator resolved to <th class="text-left">Fecha</th>
  - element is visible and stable / scrolling into view if needed
  - <p>…</p> from <div class="modal active">…</div> subtree intercepts pointer events
  - <div role="presentation" class="modal-viewport">…</div> from <div class="modal active"> subtree intercepts pointer events
  (14 retries, alternating scroll positions = the up/down scrolling the owner saw)
```

- The replay never reaches the "Confirmar" click; it dies on a hover.
- The hover on the table header was recorded 9 ms after the click that opens
  the modal: the pointer was resting over the header while the modal opened.
  Capture hover rule 2 ("last element entered that is not an ancestor of the
  next target, if the DOM changed while the pointer was on it") attributed the
  click-caused DOM change (modal opening) to that hover.
- On replay the modal is already open and covers the header, so the hover is
  not actionable; Patchright retries for 30 s and fails the whole replay.
- The earlier diagnosis (same-URL reload after "Confirmar") was wrong for this
  report; that change stays as a genuine fix of a different race.

## Decisions

1. Replay: hover steps are best effort. Render them through a runtime helper
   (`rt.hover(locator)`) that tries the hover with a short timeout (e.g. 2 s);
   on failure (not visible, obscured, detached, timeout) it prints a
   `::warn` naming the step and continues. Clicks, fills, checks, etc. keep
   strict behavior. Recorded/human timing unaffected; no page code.
2. Capture: DOM mutations that happen within a short window after a pointer
   click/keyboard activation (e.g. 300–500 ms) are attributed to that action,
   not to the element under the pointer, so hover rule 2 does not fire for
   them. Rule 1 (outermost ancestor of the next target entered since the
   previous action) is unchanged.
3. Coalescing: drop a hover that is recorded within a short window after a
   click when its target is not an ancestor of the next action target (same
   noise class), unless rule 2 legitimately applies outside the window.
4. Reproduce with fixtures: (a) replay — a page where a click opens a modal
   that covers an element with a recorded hover; RED = replay fails today;
   (b) capture — pointer resting over an element while a click opens a modal;
   RED = a hover is recorded today.
5. Release-impacting fix: bump version (patch).
