# Lumière Beauty — Cosmetic Store

Full-stack e-commerce site for a cosmetic store with product catalog, user accounts, shopping cart, orders, and M-Pesa / card checkout.

## Quick start

1. Install [Node.js](https://nodejs.org/) (v18+).
2. In the project folder:

```bash
npm install
npm start
```

3. Open **http://localhost:3000** (store) or **http://localhost:3000/admin** (admin panel)

Development with auto-restart:

```bash
npm run dev
```

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML, CSS, vanilla JavaScript |
| Backend | Node.js, Express |
| Database | SQLite (`server/data/lumiere.db`) |
| Auth | JWT (7-day tokens, bcrypt passwords) |
| Payments | M-Pesa Daraja STK + card (simulated without API keys) |

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/categories` | List categories |
| GET | `/api/products` | List products (`?category=&search=&sort=`) |
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Current user (Bearer token) |
| POST | `/api/orders` | Place order + payment |
| GET | `/api/orders` | User order history (auth required) |
| POST | `/api/payments/mpesa/callback` | M-Pesa webhook |

## Admin panel

URL: **http://localhost:3000/admin**

On first run, a default admin account is created (configure in `.env`):

| Variable | Default |
|----------|---------|
| `ADMIN_EMAIL` | `admin@lumiere.beauty` |
| `ADMIN_PASSWORD` | `admin123` |

**Admin features:** dashboard stats, product CRUD, stock updates, order list with status changes, customer list.

Admin API routes (require `Authorization: Bearer <admin_token>`):

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/login` | Admin sign in |
| GET | `/api/admin/stats` | Dashboard metrics |
| GET/POST/PUT/DELETE | `/api/admin/products` | Manage inventory |
| GET/PATCH | `/api/admin/orders` | View and update orders |
| GET | `/api/admin/users` | Registered customers |

## Live M-Pesa (Safaricom Daraja)

Copy `.env.example` to `.env` and set:

- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_PASSKEY`
- `MPESA_SHORTCODE`
- `MPESA_CALLBACK_URL` (public HTTPS URL)
- `MPESA_ENV=sandbox` or `production`

Without these, checkout simulates a successful STK push for testing.

## Live card payments

Set `STRIPE_SECRET_KEY` in `.env` for Stripe integration. Without it, card checkout is simulated.

## Reset database

Delete `server/data/lumiere.db` and restart the server — it will re-seed automatically.

Or run:

```bash
npm run seed
```

## Project structure

```
cosWeb/
├── index.html          # Store (required — serve via npm start)
├── admin.html          # Admin panel
├── styles.css
├── app.js
├── admin.css
├── admin.js
├── package.json
├── .env.example
├── server/
│   ├── index.js
│   ├── db.js
│   ├── seed.js
│   ├── ensureAdmin.js
│   ├── middleware/     # auth.js, adminAuth.js
│   ├── routes/         # auth, products, categories, orders, payments, admin
│   ├── services/       # mpesa.js, payment.js
│   └── data/           # lumiere.db (created on first run)
└── .env
```

**Important:** Open the site at `http://localhost:3000` after `npm start`. Opening `index.html` directly in the browser will not load products (API unavailable).
