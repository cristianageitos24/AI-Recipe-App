# Mobile dashboard styles (≤700px only)

Phone-only overrides for the web dashboard.

- Edit files here for mobile visuals.
- Edit `../Nav.css`, `../TabHome.css`, etc. for desktop/tablet (≥701px).
- Do not copy these rules back into parent CSS files.
- Breakpoint must stay in sync: `max-width: 700px`.
- Never set modal/fixed widths larger than the viewport inside a max-width query.
- If you add a new `mobile/*.css` file, import it from the owning page/component (see the mobile web UX plan import map).
