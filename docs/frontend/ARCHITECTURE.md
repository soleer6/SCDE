# Frontend architecture (v2)

```
src/
  main.jsx              providers: Router → Auth → Toast → AppRouter
  app/                  shell, router, registry, i18n, common locales     [shared, frozen]
  ui/                   design-system primitives (index.jsx, ui.css)       [shared, frozen]
  styles/               tokens.css, base.css                               [shared, frozen]
  lib/
    api/                client.js (fetch + JWT refresh + mock switch), errors.js, tokens.js
    auth/               AuthProvider (session = login user + JWT claims)
    mock/               router.js (handler registry), db.js (seed), auth.js (mock JWT)
    hooks.js            useApi / useAction
    permissions.js      mirror of backend DEFAULT_PERMISSIONS (UI hints only)
    format.js           score/date helpers
  features/<id>/        one folder per functional area, auto-discovered
    index.jsx           { id, order, routes, nav, mocks, i18n, slots }
    api.js              endpoint functions (backend shapes)
    mocks.js            mock handlers for the endpoints the feature owns
    *.jsx / *.css       pages & components (CSS prefixed with the feature id)
```

## Feature contract
See `src/app/registry.js`. Route guards: `public`, `auth` (default), `staff`
(`is_staff`/`is_superadmin` from the JWT). Nav sections: `work`, `manage`, `account`.
Slots rendered by the shell: `topbar.end` (e.g. notifications bell).

## Domain facts the UI is built on (verified in backend code)
- Login returns `{access_token, refresh_token, user{id,email,first_name,last_name,organization_id}}`.
  `is_staff`/`is_superadmin` come only from JWT claims. Refresh rotates both tokens.
- **Roles are per subject** (`MySubject.role` ∈ COORDINATOR | TEACHER | STUDENT); there
  is no global professor/student role. `is_staff` = organization manager.
- Permissions per membership (DEFAULT_PERMISSIONS + overrides). Staff bypasses.
- Instance lifecycle: ASSEMBLING → RECEIVED → QUEUED → PENDING_GRADING → GRADED →
  PUBLISHED → IN_REVIEW → (PENDING_REVIEW → GRADED) | FINALIZED → ARCHIVED.
- Grades per problem with optimistic concurrency (`old_score`, 409 VERSION_CONFLICT).
- Errors are symbolic codes → translated in `common:errors.*`.

## Mock mode
`VITE_MOCK_API=true` routes every request to `lib/mock`. Handlers must return the
exact OpenAPI shapes so switching to the real backend needs no UI changes.
Reset demo data: open any URL with `?resetMock`.
