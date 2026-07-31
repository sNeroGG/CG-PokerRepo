# CHOLOS GROUP CORPORATION — Monorepo

Poker y Blackjack multijugador con **Vercel** (frontend) y **Supabase** (base de datos + Realtime).

## Estructura

```
CG-PokerRepo/
├── frontend/          → Next.js (desplegar en Vercel)
│   ├── src/
│   │   ├── app/           Páginas y API routes
│   │   ├── components/
│   │   │   ├── cards/     Cartas y animaciones
│   │   │   ├── table/     Mesa, crupier, asientos
│   │   │   ├── games/     Blackjack & Poker UI
│   │   │   ├── ui/        Botones de juego, fichas
│   │   │   └── lobby/     Lista de jugadores
│   │   ├── lib/
│   │   │   ├── game-logic/  Lógica de cartas (cliente)
│   │   │   └── supabase/    Cliente Realtime
│   │   └── hooks/           useRoom + Realtime
│
└── backend/           → Lógica servidor + Supabase
    ├── src/
    │   ├── games/         Motores Blackjack & Poker
    │   └── services/      Room service + store
    └── supabase/
        └── migrations/    Schema SQL
```

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 15 → **Vercel** |
| Backend / DB | **Supabase** PostgreSQL |
| Tiempo real | **Supabase Realtime** channels |
| Lógica juegos | `@cg/backend` (workspace) |

## Inicio local

```bat
start-local.bat
```

O manualmente:

```bash
npm install
npm run dev
```

Sin Supabase configurado funciona en **memoria** (solo misma instancia del servidor).

## Configurar Supabase

1. Crea proyecto en [supabase.com](https://supabase.com)
2. Ejecuta `backend/supabase/migrations/001_initial_schema.sql` en el SQL Editor
3. Copia `frontend/.env.example` → `frontend/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Desplegar en Vercel

1. Conecta el repo en [vercel.com](https://vercel.com)
2. Root Directory: **`frontend`**
3. Agrega las 3 variables de entorno de Supabase
4. Deploy

## Realtime

El hook `useRoom` suscribe al canal `room:{code}` y escucha cambios en `rooms` y `room_players`. Si Supabase no está configurado, hace polling cada 2s como fallback.

## Agregar un juego

1. Motor en `backend/src/games/mijuego/engine.ts`
2. Registrar en `backend/src/games/registry.ts`
3. UI en `frontend/src/components/games/mijuego/`
4. Tipo en `backend/src/types.ts`
