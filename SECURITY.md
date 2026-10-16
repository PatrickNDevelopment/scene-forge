# Security notes

SceneForge is a static, browser-only app. It has no server, no accounts, no network calls and no
secrets.

| Input                   | Treated as                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| Scene JSON files        | Untrusted. 2 MB cap, strict schema (unknown keys rejected), ranges, id rules, no control characters. |
| Typed labels and titles | Untrusted. Control characters removed; rendered as SVG text nodes; never as HTML.                    |
| `localStorage` contents | Untrusted. Re-validated on load; an unreadable copy is kept aside and can be downloaded.             |

Exported SVG: generated only from the validated model; text and attributes are XML-escaped and
characters XML cannot carry are removed; no `<script>`, event attributes, `href`, `<image>`,
`<foreignObject>` or external references are ever written. The canvas renders the same tree as React
elements, not through `innerHTML`.

Report problems through a private security advisory on the repository once it is published, or by
contacting the owner.
