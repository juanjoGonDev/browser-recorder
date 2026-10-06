# Exploration: replay-settles-after-actions

## Report (owner, 2026-10-06)

Replaying a real recording ("bizneo"): the last action clicks the
"Confirmar" button of a modal, but the effect never happens on the site.

## Evidence (generated script, values redacted)

```
16  click       getByRole("button", { name: "Confirmar", exact: true })
17  wait-for-url (isFollowUp) .../time-attendance/my-logs/17109916
    rt.done() -> finally close()
```

- During recording, confirming made the site navigate to the SAME URL the page
  was already on, so capture classified it as an action-triggered
  `wait-for-url`.
- Replay renders it as `page.waitForURL(predicate)`. Patchright's `waitForURL`
  resolves immediately when the current URL already matches, so step 17 is a
  no-op, `rt.done()` runs and `close()` shuts the browser while the request
  started by the click is still in flight. The confirmation is lost.
- Same class as the CI race fixed in the test fixtures (a fire-and-forget
  request from the last step was dropped because the script closed first).
- Not reproduced against the real site on purpose (it acts on the owner's real
  account). Must be reproduced with a local fixture.

## Decisions

1. An action-caused navigation must wait for a NEW main-frame navigation, not
   for a URL: arm the waiter BEFORE the triggering action (e.g. a
   `framenavigated` on the main frame whose URL matches origin+pathname, or the
   engine's navigation event), then perform the action, then await it. A
   same-URL navigation must still be awaited. Timeouts keep the existing
   default and report the step as failed with a clear message.
2. Before closing (after the last step, on success), the script waits until
   the page network is quiet: no in-flight requests for a short quiet window,
   capped by a maximum wait. Tracked in Node from Patchright `request`,
   `requestfinished` and `requestfailed` events — no page code, no
   Runtime.enable/Console.enable. Applies in recorded and human timing.
3. Optional: the same quiet wait after a navigation follow-up is not needed;
   only before close.
4. Reproduce with a fixture: a modal whose "Confirmar" sends a delayed POST to
   the fixture server and then reloads the same URL; RED = the server never
   records the POST before the fix.
5. Old scripts are regenerated before every replay, so no migration.
