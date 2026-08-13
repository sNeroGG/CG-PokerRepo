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
| Frontend | Next.js 16 → **Vercel** |
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

Sin Supabase configurado funciona en **memoria únicamente durante desarrollo local**. En
producción, el servidor rechaza el arranque de la persistencia si faltan las credenciales
de Supabase para evitar salas inconsistentes entre instancias.

## Configurar Supabase

1. Crea proyecto en [supabase.com](https://supabase.com)
2. Ejecuta en orden las migraciones de `backend/supabase/migrations/001` a `005`.
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

La migración `005_secure_atomic_rooms.sql` añade:

- versión y escritura transaccional por sala;
- tokens invitados almacenados como hash;
- presencia y última actividad de cada jugador.

## Sesiones invitadas

Crear o unirse a una sala emite una cookie `HttpOnly`, `SameSite=Lax` distinta para cada
sala. El identificador enviado por el navegador nunca autoriza acciones: todas las rutas
validan el token del servidor. La cookie dura siete días y permite reconexión sin crear
cuentas.

## Realtime

El hook `useRoom` suscribe al canal `room:{code}`, escucha cambios en `rooms`, mantiene
presencia cada 20 segundos y usa polling cada 10 segundos como respaldo.

## Calidad y pruebas

```bash
npm test          # motores, salas, concurrencia y privacidad
npm run typecheck
npm run lint
npm run build
npm run test:e2e # Playwright: 8 navegadores en una sala
```

La prueba E2E crea ocho contextos aislados, inicia una mesa de Poker, comprueba cartas
privadas y sincronización, cierra una mano y valida ausencia de overflow en:

- 1440×900 (escritorio)
- 1024×768 (tablet)
- 390×844 (móvil vertical)
- 844×390 (móvil horizontal)

La primera ejecución de Playwright puede requerir:

```bash
npx playwright install chromium
```

## Agregar un juego

1. Motor en `backend/src/games/mijuego/engine.ts`
2. Registrar en `backend/src/games/registry.ts`
3. UI en `frontend/src/components/games/mijuego/`
4. Tipo en `backend/src/types.ts`
