# WebMindClub — Create. Develop. Launch.

WebMindClub is a platform for a digital product studio. Teams create projects, design websites in a visual builder, plan tasks, preview the result on desktop, tablet and mobile, and publish versioned sites. The first product built inside it is **SmartStock AI**, an inventory system for retail stores that explains every recommendation it makes.

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS 4, shadcn-style components (built on Radix UI), Lucide, React Router 7, Zustand, TanStack Query, React Hook Form, Zod 4, Recharts, dnd-kit
- **Backend:** Python 3.13, Django 5.2 LTS, Django REST Framework, PostgreSQL 16, drf-spectacular (OpenAPI), django-filter
- **Auth:** Django session cookies (HttpOnly, SameSite=Lax) with CSRF protection. No tokens are stored in the browser.
- **Infra:** Docker Compose (PostgreSQL + gunicorn + nginx). All configuration comes from `.env`.

---

## 1. File structure

```
webmindclub/
├── docker-compose.yml          # db + backend (gunicorn) + frontend (nginx, :8080)
├── .env.example                # all settings, documented
├── backend/
│   ├── config/                 # settings (env-driven), urls, pagination, uniform error format
│   ├── common/                 # TimeStampedModel, safe image upload validation
│   ├── accounts/               # custom User (email login), register/login/logout, profile, password change/reset
│   ├── workspaces/             # Workspace, WorkspaceMembership (RBAC), Invitation, access helpers, seed_demo command
│   ├── projects/               # Project, ProjectMembership, CRUD/duplicate/archive/restore/members/activity
│   ├── builder/                # component registry + validator, templates, pages, versions, theme, assets, publishing
│   ├── collaboration/          # Task, ActivityLog (audit trail)
│   ├── smartstock/             # Store, StoreStaff, Product, InventoryMovement, Supplier, PurchaseOrder(+Item),
│   │                           # AIRecommendation, services (transactions, recommendation engine), demo data
│   ├── tests/                  # pytest API and business-logic tests
│   ├── Dockerfile, entrypoint.sh, requirements.txt, pytest.ini
└── frontend/
    ├── public/brand/           # logo and symbol taken from the supplied WebMindClub logo
    ├── src/
    │   ├── app/                # app shell, router, auth guards
    │   ├── layouts/            # public layout, workspace layout (sidebar, search, notifications, switcher)
    │   ├── pages/              # public/, auth/, app/, builder/, site/ (preview + published), smartstock/
    │   ├── features/           # marketing, projects, tasks, activity, team, builder (renderer, canvas, panels), smartstock
    │   ├── components/ui/      # Button, Input, Dialog, ConfirmDialog, Dropdown, Tabs, Switch, states…
    │   ├── services/           # http client (CSRF, error mapping) and typed API layer
    │   ├── stores/             # Zustand: auth, workspace, ui (appearance), editor (undo/redo)
    │   ├── hooks/ types/ lib/ test/
    ├── Dockerfile, nginx.conf, vite.config.ts
```

## 2. Installation

Requirements: Python 3.12 or newer, Node 20 or newer, PostgreSQL 14 or newer. Docker is optional.

```bash
cd webmindclub
cp .env.example .env            # then edit the values (see section 4)

# Backend
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm ci
```

Create the database. These are example values; they must match `.env`:

```bash
sudo -u postgres psql -c "CREATE USER webmind WITH PASSWORD 'change-me-too' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE webmindclub OWNER webmind;"
```

## 3. Running

**Local development (two terminals):**

```bash
# terminal 1 — API on http://localhost:8000
cd webmindclub/backend && . .venv/bin/activate
python manage.py migrate
python manage.py runserver

# terminal 2 — SPA on http://localhost:5173 (proxies /api and /media to :8000)
cd webmindclub/frontend
npm run dev
```

For local development, set `DJANGO_DEBUG=true` in `.env`. With that set, the default `DJANGO_SECRET_KEY` and `DJANGO_SECURE_COOKIES` are acceptable.

**Docker (production-like):**

```bash
cd webmindclub
cp .env.example .env    # set DJANGO_SECRET_KEY and POSTGRES_PASSWORD
docker compose up -d --build
# open http://localhost:8080
```

The backend entrypoint runs `migrate` and `collectstatic` automatically.

Useful URLs:
- Swagger UI: `/api/docs/`
- OpenAPI schema: `/api/schema/`
- Django admin: `/admin/`

## 4. `.env` configuration

| Variable | Purpose |
|---|---|
| `DJANGO_DEBUG` | `true` only for local development. When it is `false`, `DJANGO_SECRET_KEY` is required. |
| `DJANGO_SECRET_KEY` | Long random string, e.g. `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated host names |
| `DJANGO_CSRF_TRUSTED_ORIGINS` / `DJANGO_CORS_ALLOWED_ORIGINS` | Origins the SPA is served from |
| `DJANGO_SECURE_COOKIES` | `true` behind HTTPS (production), `false` for plain-http local use |
| `FRONTEND_URL` | Base URL used in password-reset and invitation links |
| `DJANGO_EMAIL_BACKEND` | The default console backend prints emails to the server log. Use the SMTP backend together with `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` and `EMAIL_USE_TLS`. |
| `POSTGRES_*` | Database connection |
| `DEMO_OWNER_EMAIL` | Docker only: seed the demo workspace for this existing user at startup |

## 5. Migrations, test user and demo data

```bash
cd webmindclub/backend && . .venv/bin/activate
python manage.py migrate

# Create a local test user — either sign up in the UI at /signup, or:
python manage.py createsuperuser          # asks for email + password (also gives /admin access)

# Seed the demo workspace "WebMindClub" for that user:
python manage.py seed_demo --owner-email you@example.com
```

The seed creates:
- the **WebMindClub** workspace, with the user as owner
- the **SmartStock AI** project with 4 site pages, a custom theme and 8 development tasks
- 4 demo team members (designer, developer, project manager, viewer)
- a store with 4 suppliers and 20 products
- 30 days of simulated sales and the AI insights computed from them

Demo members are created with unusable passwords and `is_demo=True`, so nobody can log in as them. No shared account with a fixed password is created.

Any workspace owner or admin can also click **"Load SmartStock AI demo"** on the dashboard to add the same demo project to their own workspace.

In Docker: `docker compose exec backend python manage.py createsuperuser`, then `docker compose exec backend python manage.py seed_demo --owner-email …`.

## 6. Implemented features

**Public site:** landing page with an interactive workspace preview, plus Platform, Projects and About pages. The navbar, a featured-project section for SmartStock AI, a "How it works" section and a footer are all functional. Contact details are labelled placeholders.

**Authentication:**
- Sign up (creates a personal workspace), sign in, sign out
- Profile with avatar, password change and appearance setting
- Forgot/reset password through Django's token workflow. Without SMTP, the UI says so and the link is printed to the server log.
- Login is rate-limited, CSRF is enforced on anonymous auth endpoints, and the reset form does not reveal which accounts exist.

**Workspace:**
- Sidebar with Overview, My Projects, Website Builder, Templates, Team, Tasks, Activity and Settings
- Top bar with live project search, notifications (from the activity feed), workspace switcher with a "create workspace" option, and the user menu
- Dashboard numbers (totals, active, published, team, recent activity, recent projects, upcoming tasks) are computed from the database.

**Projects:**
- Full CRUD, duplicate, archive and restore. Deleting asks for confirmation.
- Search, status and type filters, sorting, grid and list views
- Project workspace tabs: Overview, Product, Tasks, Team, Design, Preview (device frames), Publish, Activity, Settings (general, SEO per page, danger zone)

**Create Project wizard:** 5 steps (information → type → template → branding → review). It validates each step, shows progress and has Back/Continue buttons. Slugs are generated automatically, the branding step has a live preview and an optional logo upload. The server builds the template's pages and theme.

**Website Builder:**
- Left panel tabs:
  - Pages: create from starters, settings and SEO, publication status, set as home, reorder, delete, version history with restore
  - Components (16 allow-listed types)
  - Sections (ready-made combinations of components)
  - Layers (drag-and-drop reordering, also keyboard-accessible)
  - Assets: image upload, then apply an image to a component or copy its URL
- Canvas with Desktop/Tablet/Mobile viewports. Responsive behaviour uses CSS container queries, so it matches the real site.
- Every canvas block has a toolbar: drag, move up/down, duplicate, delete.
- Right panel:
  - Component settings generated from the registry: text, links, images, colors, numbers, icons and lists
  - Design settings: typography, colors, background, spacing, borders, visibility (everywhere or per device)
  - Theme editor with 7 presets (Modern Dark, Minimal Light, Tech Blue, Indigo SaaS, Retail Fresh, Summer, Winter) and every token editable live
- Undo/redo with typing coalesced into single steps, Ctrl+S, Delete, Esc
- A warning appears before you leave with unsaved changes.
- Page content is saved as JSON (`{version, blocks:[{id,type,props,style,hidden,hiddenOn}]}`). A version is recorded on every save, and the last 30 are kept.

**Save, preview and publish:**
- Draft preview at `/preview/:projectId/:page` (members only) renders the real pages and links between them.
- Publishing saves an immutable snapshot (`PublicationVersion`) and serves it at `/sites/:slug`. Changes made after publishing stay out of the live site until you publish again.
- Unpublish, publication history with release notes, and copy/open of the published URL

**SmartStock AI (separate app at `/smartstock/:storeId`):**
- Dashboard: inventory value, products, low stock, 30-day sales, potential savings, insights, revenue chart, value by category
- Inventory: CRUD, search, category and stock filters, sortable columns, pagination, CSV export (protected against formula injection), audited stock adjustments
- AI Insights:
  - Stockout risk, recommended purchase, overstock and expiry risk
  - Each insight states the reason with its numbers, the suggested action and the potential savings.
  - One click turns an insight into a draft purchase order.
- Purchase orders: draft → ordered → received, or cancelled. Receiving updates stock in one transaction and logs a movement for each line.
- Suppliers, stock movement history, and store staff with roles (Store Manager, Inventory Clerk, Analyst) kept separate from workspace roles

**Team and tasks:**
- Members, role changes and removal
- Invitations with a role and per-project access. If email isn't configured, the UI shows the invite link to share and says plainly that no email was sent.
- Per-project assignment with Lead, Editor or Viewer roles
- Tasks with Kanban (drag between columns) and list views: create, edit, delete, assignee, priority, due date, status, linked project
- Activity feed

**Settings:**
- Workspace: name, logo, default theme, permission matrix
- Account and password
- Appearance: dark, light or system

**Security:**
- All authorisation happens on the server. Querysets are scoped to what the user can access, so changing an ID in a request returns 404.
- RBAC applies at workspace level and project level. SmartStock store roles are a separate layer.
- Page content and theme tokens are validated against an allow-list:
  - unknown types or properties are rejected
  - strings are length-limited
  - links are limited to relative paths, `#anchors`, `http(s)`, `mailto:` and `tel:` (so `javascript:` and `data:` are rejected)
  - colors must be hex
  - user JavaScript and HTML are never stored
- The renderer outputs only React text nodes and re-checks links.
- Uploads must be PNG, JPEG, WebP or GIF, at most 5 MB, and are verified with Pillow. SVG is rejected.
- Secrets come only from the environment. Passwords are hashed by Django.
- Important actions are recorded in `ActivityLog`, and stock changes in `InventoryMovement`.

## 7. Known limitations

- **Hosting:** "Publish" serves sites from this WebMindClub instance at `/sites/<slug>`. There is no external hosting, CDN or custom-domain integration, and the UI says so.
- **Email:** without SMTP settings, password-reset and invitation emails are only printed to the backend log. The UI shows invitation links to share manually.
- **Media files** are served by Django (`/media/`). For production, use object storage or a CDN.
- **"AI" insights** come from a transparent rule-based model (sales velocity, lead time, cover days, expiry), not a machine-learning service. This is intentional and explained in the UI.
- **Builder:** components are added by clicking. Drag-and-drop is used for reordering on the canvas, in Layers and on the Kanban board. There is no nested layout or column builder, and no inline on-canvas text editing (text is edited in the properties panel). Editing is meant for tablet or desktop screens.
- **Concurrency:** if two people edit the same page at once, the last save wins. Version history allows rolling back.
- **Load testing and HTTPS:** these were not exercised. Treat this as a well-tested MVP, not a hardened production deployment.

## 8. Test results

Run them yourself:

```bash
cd backend && . .venv/bin/activate && python -m pytest      # 34 passed
cd frontend && npm test                                      # 16 passed (5 files)
cd frontend && npm run build                                 # tsc + vite build: OK
```

**Backend (pytest, real PostgreSQL), 34 tests:**
- Sign-up, sign-in and sign-out, CSRF enforcement, validation errors, the password-reset token flow (no account enumeration), profile and password change, demo users blocked from login
- Project creation from a template with branding, validation, edit, duplicate, archive and restore, delete, search, filter and sort, live dashboard stats
- The registry rejecting unsafe content (`javascript:` links, `data:` images, unknown components or keys, CSS injection in colors)
- Page CRUD, save/load, versions and restore, theme save and validation
- Preview, publish and unpublish, isolation of the published snapshot, publication history
- Asset upload validation (fake PNG and SVG rejected)
- Permissions:
  - outsiders get 404 on someone else's workspace or project
  - members see only their assigned projects
  - viewers are read-only
  - workspace visibility grants read access
  - the invitation flow and role management work
- Tasks: CRUD, assignee validation, status changes logged
- SmartStock:
  - product CRUD, search, filters, sorting, CSV export, CSV formula neutralisation
  - stock adjustment audit trail and insufficient-stock error
  - purchase order lifecycle (receiving updates stock, no double receipt)
  - rejection of products from another store
  - store roles kept separate from workspace roles
  - the recommendation maths
  - insight → purchase order
  - demo seed

**Frontend (Vitest + Testing Library), 16 tests:** block operations and client-side validation, editor undo/redo and keystroke coalescing, renderer safety (HTML rendered as text, no anchors for unsafe links, per-device visibility), HTTP client error mapping and CSRF header, sign-in form validation.

**End-to-end smoke run (Playwright against the running dev servers, 15/15 steps):** landing → sign in → dashboard → projects → 5-step wizard → builder (add component, edit text, apply theme, save, mobile view, undo) → publish → public site and navigation between its pages → draft preview → tasks → team → SmartStock dashboard → stock adjustment → insights → purchase order from an insight → place → receive → mobile landing page.

**Docker Compose** was built and started (PostgreSQL + gunicorn + nginx, `DJANGO_DEBUG=false`). Verified through nginx: migrations, collectstatic, the SPA, API login, `/api/docs/`, admin static files, the demo seed and the SmartStock dashboard API.
