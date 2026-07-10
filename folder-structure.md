blackstone-ops/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  ← root layout, fonts
│   │   ├── page.tsx                    ← redirects to /admin or /store
│   │   ├── globals.css                 ← global styles + design tokens
│   │   │
│   │   ├── admin/
│   │   │   ├── layout.tsx              ← admin shell (sidebar + nav)
│   │   │   ├── page.tsx                ← redirect to /admin/overview
│   │   │   ├── login/
│   │   │   │   └── page.tsx            ← admin login
│   │   │   ├── overview/
│   │   │   │   └── page.tsx            ← dashboard
│   │   │   ├── orders/
│   │   │   │   └── page.tsx            ← order management
│   │   │   ├── customers/
│   │   │   │   └── page.tsx            ← customer list + approvals
│   │   │   ├── messages/
│   │   │   │   └── page.tsx            ← 1-1 messaging
│   │   │   ├── products/
│   │   │   │   └── page.tsx            ← product catalog
│   │   │   └── qr/
│   │   │       └── page.tsx            ← QR control
│   │   │
│   │   ├── store/
│   │   │   ├── layout.tsx              ← store shell
│   │   │   └── page.tsx                ← customer storefront
│   │   │
│   │   ├── gate/
│   │   │   └── page.tsx                ← QR landing → name+phone → pending
│   │   │
│   │   └── api/
│   │       ├── auth/
│   │       │   └── route.ts            ← admin login
│   │       ├── orders/
│   │       │   └── route.ts            ← GET all, POST new
│   │       ├── orders/[id]/
│   │       │   └── route.ts            ← PATCH status
│   │       ├── products/
│   │       │   └── route.ts            ← CRUD
│   │       ├── customers/
│   │       │   └── route.ts            ← list, approve, reject, remove
│   │       ├── messages/
│   │       │   └── route.ts            ← send + fetch
│   │       └── qr/
│   │           └── route.ts            ← generate + validate token
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Toast.tsx
│   │   ├── admin/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   ├── NotifBell.tsx
│   │   │   ├── StatCard.tsx
│   │   │   ├── OrderTable.tsx
│   │   │   ├── OrderModal.tsx
│   │   │   ├── CustomerRow.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   ├── ProductModal.tsx
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── PendingCard.tsx
│   │   │   └── QRPanel.tsx
│   │   └── store/
│   │       ├── StoreHero.tsx
│   │       ├── ProductGrid.tsx
│   │       ├── CartBar.tsx
│   │       ├── CartModal.tsx
│   │       ├── CheckoutModal.tsx
│   │       ├── OrderTracker.tsx
│   │       └── MessageFab.tsx
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts               ← browser supabase client
│   │   │   ├── server.ts               ← server supabase client
│   │   │   └── middleware.ts           ← auth middleware helper
│   │   ├── utils.ts                    ← cn(), fmt(), etc
│   │   ├── constants.ts                ← order statuses, categories
│   │   └── validations.ts              ← zod schemas
│   │
│   ├── hooks/
│   │   ├── useOrders.ts                ← realtime orders hook
│   │   ├── useMessages.ts              ← realtime messages hook
│   │   ├── useNotifications.ts         ← push + badge hook
│   │   ├── usePendingCustomers.ts      ← realtime pending hook
│   │   └── useCart.ts                  ← cart state (zustand)
│   │
│   ├── store/
│   │   └── cartStore.ts                ← zustand cart store
│   │
│   └── types/
│       └── index.ts                    ← all TypeScript types
│
├── public/
│   └── icons/                          ← PWA icons
│
├── supabase/
│   └── schema.sql                      ← full DB schema
│
├── middleware.ts                        ← route protection
├── .env.local                          ← secrets (never commit)
├── .env.example                        ← template to share
└── next.config.ts
