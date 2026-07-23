# Complete Learning Guide: Fullstack Effect Hive

A comprehensive step-by-step guide to understanding and mastering this Effect-based fullstack chat application.

---

## Table of Contents

1. [Introduction & Prerequisites](#1-introduction--prerequisites)
2. [Project Overview & Architecture](#2-project-overview--architecture)
3. [Setting Up Your Environment](#3-setting-up-your-environment)
4. [Understanding the Monorepo Structure](#4-understanding-the-monorepo-structure)
5. [Effect Framework Fundamentals](#5-effect-framework-fundamentals)
6. [Backend Development Deep Dive](#6-backend-development-deep-dive)
7. [Frontend Development Deep Dive](#7-frontend-development-deep-dive)
8. [Real-time WebSocket Communication](#8-real-time-websocket-communication)
9. [Database Design & Migrations](#9-database-design--migrations)
10. [Authentication & Security](#10-authentication--security)
11. [State Management with Effect Atoms](#11-state-management-with-effect-atoms)
12. [Testing & Debugging](#12-testing--debugging)
13. [Deployment & Production](#13-deployment--production)
14. [Next Steps & Advanced Topics](#14-next-steps--advanced-topics)

---

## 1. Introduction & Prerequisites

### What You'll Build

This is a **real-time chat application** (like Slack or Discord) featuring:
- User authentication (signup/login)
- Channel-based chat rooms
- Direct messaging (DM)
- Real-time message delivery via WebSocket
- Typing indicators
- Room membership management
- Invitation system

### Prerequisites

Before diving in, ensure you understand:

| Topic | Importance | Resources |
|-------|------------|-----------|
| **TypeScript** | Essential | [TypeScript Handbook](https://www.typescriptlang.org/docs/) |
| **React & Next.js** | Essential | [Next.js Docs](https://nextjs.org/docs) |
| **Node.js** | Important | [Node.js Docs](https://nodejs.org/docs) |
| **PostgreSQL** | Important | [PostgreSQL Tutorial](https://www.postgresql.org/docs/) |
| **Functional Programming** | Helpful | [Effect Getting Started](https://effect.website/docs/getting-started/) |
| **Effect Framework** | Will Learn | Primary focus of this guide |

### Key Technologies

```
Backend:
├── Effect (Functional Programming Framework)
├── Effect Platform (HTTP Server)
├── Effect SQL (Database Layer)
├── WebSocket (Real-time Communication)
└── PostgreSQL (Database)

Frontend:
├── Next.js 15 (App Router)
├── React 19
├── Effect Atoms (State Management)
├── Tailwind CSS + shadcn/ui
└── WebSocket Client

Infrastructure:
├── Turborepo (Monorepo Build System)
├── pnpm (Package Manager)
└── TypeScript (Type Safety)
```

---

## 2. Project Overview & Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Next.js 15 App (@hive/web - Port 3000)                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │   │
│  │  │   Pages     │  │  Components │  │   State (Atoms) │ │   │
│  │  │  /login     │  │   /ui/      │  │  authAtom       │ │   │
│  │  │  /signup    │  │   /lib/     │  │  chatAtom       │ │   │
│  │  │  /chat      │  │  api/atoms/ │  │                 │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│         HTTP (3002)          │          WebSocket (3003)       │
│         REST API             │          Real-time Events       │
└──────────────────────────────┼─────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVER (Node.js)                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Effect Server (@hive/server)                           │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │  HTTP API (Port 3002)                           │    │   │
│  │  │  /api/auth/login, /signup                       │    │   │
│  │  │  /api/user/profile, /list                       │    │   │
│  │  │  /api/rooms/*                                   │    │   │
│  │  │  /api/messages/*                                │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │  WebSocket Server (Port 3003)                   │    │   │
│  │  │  /ws                                            │    │   │
│  │  │  - Authentication                               │    │   │
│  │  │  - Room subscriptions                           │    │   │
│  │  │  - Real-time message delivery                   │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │  Services (Effect Layers)                       │    │   │
│  │  │  UserService  ──┐                              │    │   │
│  │  │  AuthService  ──┼──> Shared Dependencies       │    │   │
│  │  │  RoomService  ──┤  (Db, JwtService, RealTimeBus)│   │   │
│  │  │  MessageService─┘                              │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  PostgreSQL Database                                    │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │  users   │ │  rooms   │ │ messages │ │invitation│  │   │
│  │  │  table   │ │  table   │ │  table   │ │  table   │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architectural Patterns

#### 1. **Effect Layer Pattern**
Services are composed using Effect's Layer system for dependency injection:

```typescript
// Base layers (no external requirements)
const BaseLive = Layer.mergeAll(DbLive, RealTimeBusLive);

// JwtService requires AppConfig
const JwtLive = JwtServiceLive.pipe(Layer.provide(AppConfigLive));

// Infrastructure: base layers + JWT
const InfraLive = Layer.mergeAll(BaseLive, JwtLive);

// Application service layers (all depend on Db, RealTimeBus, JwtService)
const SharedLive = Layer.mergeAll(
  UserServiceLive,
  RoomServiceLive,
  MessageServiceLive,
  AuthServiceLive,
).pipe(Layer.provide(InfraLive));
```

#### 2. **Service Tag Pattern**
Each service is defined as a Context Tag:

```typescript
// Definition
export const UserService = Context.GenericTag<UserService>("UserService");

// Implementation
export const UserServiceLive = Layer.effect(
  UserService,
  Effect.gen(function* () {
    const db = yield* Db;
    const jwtService = yield* JwtService;
    
    return UserService.of({
      create: (username, password, email) => Effect.gen(function* () {
        // Implementation
      }),
    });
  }),
);
```

#### 3. **Effect Error Handling**
All operations use typed errors:

```typescript
export class UserServiceError extends Data.TaggedError(
  "UserServiceError",
)<UserError> {}

// Usage
const user = yield* userService.findById(id).pipe(
  Effect.catchAll((error) => {
    // Handle error
  }),
);
```

---

## 3. Setting Up Your Environment

### Step 1: Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd fullstack-effect-hive

# Install all dependencies
pnpm install
```

### Step 2: Environment Configuration

Create a `.env.local` file in the root:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/hive_db"

# Server
PORT=3002
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
CORS_ORIGIN="http://localhost:3000"

# Frontend
NEXT_PUBLIC_API_URL="http://localhost:3002/api"
NEXT_PUBLIC_WS_URL="ws://localhost:3003/ws"
```

### Step 3: Database Setup

```bash
# Start PostgreSQL (if using Docker)
docker run -d \
  --name hive-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=hive_db \
  -p 5432:5432 \
  postgres:15

# Run migrations
pnpm --filter @hive/server db:migrate
```

### Step 4: Start Development Servers

```bash
# Start both servers concurrently
pnpm dev

# Or start individually:
pnpm --filter @hive/server dev    # HTTP (3002) + WebSocket (3003)
pnpm --filter @hive/web dev       # Next.js (3000)
```

### Verification Checklist

- [ ] Database is running and accessible
- [ ] Migrations completed successfully
- [ ] Server starts without errors on ports 3002 and 3003
- [ ] Frontend is accessible at http://localhost:3000
- [ ] You can sign up and log in
- [ ] You can create rooms and send messages

---

## 4. Understanding the Monorepo Structure

### Directory Tree

```
fullstack-effect-hive/
├── apps/
│   ├── server/              # Backend Effect application
│   │   ├── src/
│   │   │   ├── api/         # HTTP API routes
│   │   │   │   ├── routes/
│   │   │   │   │   ├── userRoute.ts
│   │   │   │   │   ├── roomRoute.ts
│   │   │   │   │   └── messageRoute.ts
│   │   │   │   └── index.ts
│   │   │   ├── auth/        # Authentication logic
│   │   │   │   ├── AuthService.ts
│   │   │   │   └── AuthMiddleware.ts
│   │   │   ├── config/      # Configuration
│   │   │   │   ├── Config.ts
│   │   │   │   └── Db.ts
│   │   │   ├── invitation/  # Invitation system
│   │   │   ├── jwt/         # JWT handling
│   │   │   │   └── JwtService.ts
│   │   │   ├── message/     # Message service
│   │   │   │   ├── MessageService.ts
│   │   │   │   └── messageUtils.ts
│   │   │   ├── realtime/    # WebSocket handling
│   │   │   │   ├── RealtimeBus.ts
│   │   │   │   └── WebSocketServer.ts
│   │   │   ├── room/        # Room service
│   │   │   │   ├── RoomService.ts
│   │   │   │   └── Utils.ts
│   │   │   ├── user/        # User service
│   │   │   │   ├── UserService.ts
│   │   │   │   └── Utils.ts
│   │   │   ├── index.ts     # Entry point
│   │   │   ├── server.ts    # Server configuration
│   │   │   └── migrate.ts   # Database migrations
│   │   └── package.json
│   │
│   └── web/                 # Frontend Next.js application
│       ├── app/             # Next.js App Router
│       │   ├── chat/
│       │   ├── login/
│       │   ├── signup/
│       │   ├── layout.tsx
│       │   └── page.tsx
│       ├── components/      # UI components
│       │   └── ui/
│       ├── lib/             # Utilities
│       │   ├── api/
│       │   │   ├── atoms/
│       │   │   │   ├── auth.ts
│       │   │   │   └── chat.ts
│       │   │   ├── client.ts
│       │   │   └── storage.ts
│       │   └── realtime/
│       │       └── ws.ts
│       └── package.json
│
├── packages/
│   ├── eslint-config/       # Shared ESLint config
│   ├── shared/              # Shared types and schemas
│   │   └── src/
│   │       ├── schema/
│   │       │   ├── UserSchema.ts
│   │       │   ├── RoomSchema.ts
│   │       │   ├── MessageSchema.ts
│   │       │   └── WebSocketMessageSchema.ts
│   │       └── types/
│   │           └── *.ts
│   └── typescript-config/   # Shared TypeScript config
│
├── package.json             # Root package.json
├── pnpm-workspace.yaml      # pnpm workspace config
└── turbo.json               # Turborepo config
```

### Package Dependencies

```
@hive/server
├── effect
├── @effect/platform
├── @effect/sql-pg
├── @hive/shared (workspace)
└── ws

@hive/web
├── next
├── react
├── effect
├── @effect-atom/atom-react
├── @hive/shared (workspace)
└── ws

@hive/shared
└── effect
```

---

## 5. Effect Framework Fundamentals

### Core Concepts

#### 1. **Effect Type**

`Effect<R, E, A>` represents a computation that:
- Requires environment `R`
- May fail with error `E`
- Succeeds with value `A`

```typescript
// Example: Fetch user from database
const getUser = (id: string): Effect.Effect<User, UserServiceError, Db> =>
  Effect.gen(function* () {
    const db = yield* Db;
    const result = yield* sqlSafe(db`SELECT * FROM users WHERE id = ${id}`);
    return yield* toUser(result[0]);
  });
```

#### 2. **Effect.gen and yield***

The `Effect.gen` function lets you write async code like async/await:

```typescript
Effect.gen(function* () {
  const db = yield* Db;              // Get dependency
  const result = yield* db.query();  // Run effect
  const user = yield* toUser(result); // Transform
  return user;
});
```

#### 3. **Context Tags (Dependency Injection)**

```typescript
// Define a service interface
export interface UserService {
  create: (username: string, password: string) => Effect.Effect<User, UserServiceError>;
  findById: (id: string) => Effect.Effect<User, UserServiceError>;
}

// Create a Context Tag
export const UserService = Context.GenericTag<UserService>("UserService");

// Implement the service
export const UserServiceLive = Layer.effect(
  UserService,
  Effect.gen(function* () {
    const db = yield* Db;
    
    return UserService.of({
      create: (username, password) => Effect.gen(function* () {
        // Implementation
      }),
      findById: (id) => Effect.gen(function* () {
        // Implementation
      }),
    });
  }),
);
```

#### 4. **Layers (Composition)**

```typescript
// Layer.provide - inject dependencies
const UserServiceLive = Layer.effect(
  UserService,
  implementation
).pipe(Layer.provide(DbLive));

// Layer.mergeAll - combine multiple layers
const AllServicesLive = Layer.mergeAll(
  UserServiceLive,
  RoomServiceLive,
  MessageServiceLive,
);

// Layer.provideMerge - provide and make services available
const ServerLive = HttpApiBuilder.serve().pipe(
  Layer.provide(RootApiLive),
  Layer.provide(AllServicesLive),
);
```

#### 5. **Error Handling**

```typescript
// Define typed errors
export class UserServiceError extends Data.TaggedError(
  "UserServiceError",
)<UserError> {}

// Catch errors
effect.pipe(
  Effect.catchAll((error) => {
    // Handle all errors
  }),
);

// Catch specific errors
effect.pipe(
  Effect.catchTag("UserServiceError", (error) => {
    // Handle specific error type
  }),
);

// Map errors
effect.pipe(
  Effect.mapError((error) => ({
    code: error.code,
    message: error.message,
  })),
);
```

#### 6. **Schema Validation**

```typescript
import { Schema } from "effect";

// Define a schema
const UserCreateSchema = Schema.Struct({
  username: Schema.String.pipe(
    Schema.minLength(3),
    Schema.maxLength(50),
  ),
  password: Schema.String.pipe(Schema.minLength(8)),
  email: Schema.optional(Schema.String),
});

// Decode and validate
const decoded = yield* Schema.decodeUnknown(UserCreateSchema)(input).pipe(
  Effect.mapError(() => new UserServiceError({ code: "VALIDATION_FAILED", message: "Invalid input" })),
);
```

### Study Exercises

1. **Read and trace** through `UserService.ts` - understand how dependencies are injected
2. **Create a simple Effect** that combines multiple services
3. **Practice error handling** by adding new error types to existing services
4. **Build a Layer** that combines multiple dependencies

---

## 6. Backend Development Deep Dive

### 6.1 Server Entry Point (`apps/server/src/index.ts`)

The server bootstraps all services and starts HTTP + WebSocket servers:

```typescript
// 1. Define base infrastructure layers
const BaseLive = Layer.mergeAll(DbLive, RealTimeBusLive);

// 2. Create JWT service (requires AppConfig)
const JwtLive = JwtServiceLive.pipe(Layer.provide(AppConfigLive));

// 3. Merge infrastructure
const InfraLive = Layer.mergeAll(BaseLive, JwtLive);

// 4. Create application services
const SharedLive = Layer.mergeAll(
  UserServiceLive,
  RoomServiceLive,
  MessageServiceLive,
  AuthServiceLive,
).pipe(Layer.provide(InfraLive));

// 5. Make all services available
const AllServicesLive = Layer.provideMerge(SharedLive, InfraLive);

// 6. Start WebSocket server on port 3003
const WebSocketServerLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const wss = yield* createWebSocketServer(wsHttpServer);
    wsHttpServer.listen(3003);
  }),
).pipe(Layer.provide(AllServicesLive));

// 7. Start HTTP server on port 3002
const ServerLive = HttpApiBuilder.serve().pipe(
  Layer.provide(RootApiLive),
  Layer.provide(AllServicesLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3002 })),
);

// 8. Launch both servers
const MainLive = Layer.mergeAll(ServerLive, WebSocketServerLive);
Layer.launch(MainLive).pipe(NodeRuntime.runMain);
```

### 6.2 Configuration (`apps/server/src/config/`)

#### Config.ts - Environment Variables

```typescript
export const AppConfigSchema = Schema.Struct({
  NODE_ENV: Schema.Literal("development", "production"),
  PORT: Schema.Number,
  DATABASE_URL: Schema.NonEmptyString,
  JWT_SECRET: Schema.String,
});

export const AppConfigLive = Layer.effect(
  AppConfig,
  Effect.sync(() => {
    const cfg: AppConfig = {
      NODE_ENV: process.env.NODE_ENV === "development" ? "development" : "production",
      PORT: Number(process.env.PORT) ?? 3000,
      DATABASE_URL: process.env.DATABASE_URL!,
      JWT_SECRET: process.env.JWT_SECRET || "default_secret",
    };
    return Schema.decodeSync(AppConfigSchema)(cfg);
  }),
);
```

#### Db.ts - Database Connection

```typescript
export const Db = SqlClient.SqlClient;

export const DbLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const { DATABASE_URL } = yield* AppConfig;
    return PgClient.layer({
      url: Redacted.make(DATABASE_URL),
      ssl: true,
      connectTimeout: 30000,
      idleTimeout: 30000,
    });
  }).pipe(Effect.provide(AppConfigLive)),
);
```

### 6.3 API Routes (`apps/server/src/api/`)

#### Route Definition Pattern

```typescript
// apps/server/src/api/routes/userRoute.ts

export const AuthApiGropup = HttpApiGroup.make("auth")
  .add(
    HttpApiEndpoint.post("login", "/login")
      .setPayload(UserLoginSchema)      // Request validation
      .addSuccess(UserSchemaWithToken)  // Response schema
      .addError(UserServiceErrorSchema), // Error schema
  )
  .prefix("/auth");

// Handler implementation
export const handleLogin = ({ payload }: { payload: UserLogin }) =>
  Effect.gen(function* () {
    const authService = yield* AuthService;
    const result = yield* authService.authenticate(
      payload.username,
      payload.password,
    );
    return result;
  }).pipe(
    Effect.mapError((err) => ({
      code: err.code,
      message: err.message,
    })),
  );
```

#### API Group Registration

```typescript
// apps/server/src/api/index.ts

export const RootApi = HttpApi.make("RootApi")
  .add(AuthApiGropup)
  .add(UserApiGroup)
  .add(RoomApiGroup)
  .add(MessageApiGroup)
  .prefix("/api");

export const RootApiLive = HttpApiBuilder.api(RootApi).pipe(
  Layer.provide(AuthApiGroupLive),
  Layer.provide(UserApiGroupLive),
  Layer.provide(RoomsApiGroupLive),
  Layer.provide(MessageApiGroupLive),
);
```

### 6.4 Service Implementation Pattern

Each service follows this pattern:

```typescript
// 1. Define error type
export class UserServiceError extends Data.TaggedError(
  "UserServiceError",
)<UserError> {}

// 2. Define service interface
export interface UserService {
  create: (username: string, password: string, email?: string) => 
    Effect.Effect<User, UserServiceError | JwtError>;
  findByName: (username: string) => Effect.Effect<User, UserServiceError>;
  findById: (id: string) => Effect.Effect<User, UserServiceError>;
  listAll: () => Effect.Effect<User[], UserServiceError>;
}

// 3. Create Context Tag
export const UserService = Context.GenericTag<UserService>("UserService");

// 4. Implement with Layer
export const UserServiceLive = Layer.effect(
  UserService,
  Effect.gen(function* () {
    const db = yield* Db;
    const jwtService = yield* JwtService;

    return UserService.of({
      create: (username, password, email) =>
        Effect.gen(function* () {
          // Validate input
          const input = yield* decodeCreate({ username, password, email }).pipe(
            Effect.mapError(() => new UserServiceError({ 
              code: "USER_VALIDATION_FAILED", 
              message: "Data validation failed" 
            })),
          );
          
          // Hash password
          const password_hash = yield* passwordHash(password);

          // Insert into database
          const sql = yield* sqlSafe(
            db`INSERT INTO users (username, email, password_hash) 
               VALUES (${input.username}, ${input.email ?? null}, ${password_hash}) 
               RETURNING id, username, email`,
          );

          // Convert to User type
          const user = yield* toUser(sql[0]);
          
          // Generate JWT token
          const token = yield* jwtService.sign({
            email: user.email as string,
            id: user.id,
          });

          return { ...user, token };
        }),
      
      // ... other methods
    });
  }),
);
```

### 6.5 Database Utilities

Each service has utility functions for common operations:

```typescript
// apps/server/src/user/Utils.ts

// Schema decoders
export const decodeCreate = Schema.decodeUnknown(UserCreateSchema);
export const decodeUser = Schema.decodeUnknown(UserSchema);

// Password hashing
export const passwordHash = (password: string) =>
  Effect.tryPromise(() => bcrypt.hash(password, 10)).pipe(
    Effect.mapError(() => new UserServiceError({ 
      code: "USER_CREATION_FAILED", 
      message: "Password hashing failed" 
    })),
  );

// SQL error handling
export const sqlSafe = <A, R>(eff: Effect.Effect<A, SqlError.SqlError, R>) =>
  eff.pipe(Effect.mapError(mapSqlError));

// Type conversion
export const toUser = (sqlQueryResult: unknown) =>
  decodeUser(sqlQueryResult).pipe(
    Effect.mapError((err) => new UserServiceError({
      code: "INTERNAL_USER_ERROR",
      message: "Invalid user data returned by query: " + JSON.stringify(err),
    })),
  );
```

### Study Exercises

1. **Trace a request** from HTTP endpoint → service → database → response
2. **Add a new endpoint** (e.g., update user profile)
3. **Create a new service** (e.g., NotificationService)
4. **Implement error handling** for a new error case

---

## 7. Frontend Development Deep Dive

### 7.1 Application Structure

```
apps/web/
├── app/                    # Next.js App Router
│   ├── chat/              # Main chat interface
│   ├── login/             # Login page
│   ├── signup/            # Signup page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # Reusable UI components
│   └── ui/               # shadcn/ui components
└── lib/                   # Utilities
    ├── api/
    │   ├── atoms/        # Effect Atoms (state)
    │   ├── client.ts     # API client
    │   └── storage.ts    # LocalStorage wrapper
    └── realtime/
        └── ws.ts         # WebSocket client
```

### 7.2 Effect Atoms (State Management)

Atoms provide reactive state management integrated with Effect:

#### Auth Atom (`lib/api/atoms/auth.ts`)

```typescript
type AuthState = {
  user: User | null;
  loading: boolean;
  error: ApiError | null;
  isAuthenticated: boolean;
  initialized: boolean;
};

// Create atom with initial state
export const authAtom = Atom.make<AuthState>(initialState);

// Writable atom for initialization
export const initializeAuthAtom = Atom.writable(
  (get) => get(authAtom),  // Read function
  (ctx, _?: void) => {     // Write function
    ctx.set(authAtom, { ...ctx.get(authAtom), loading: true });
    
    const hasToken = tokenStorage.hasToken();
    const token = tokenStorage.get();
    
    if (token) {
      Effect.runPromise(
        apiClient.user.profile().pipe(
          Effect.tap((response) =>
            Effect.sync(() =>
              ctx.set(authAtom, {
                ...ctx.get(authAtom),
                user: response,
                loading: false,
                isAuthenticated: true,
                initialized: true,
              }),
            ),
          ),
          Effect.catchAll((error) => {
            // Handle error
          }),
        ),
      );
    }
  },
);

// Login atom
export const loginAtom = Atom.writable(
  (get) => get(authAtom),
  (ctx, credentials: { username: string; password: string }) => {
    ctx.set(authAtom, { ...ctx.get(authAtom), loading: true, error: null });

    Effect.runPromise(
      apiClient.auth.login(credentials).pipe(
        Effect.tap((response) =>
          Effect.sync(() => {
            tokenStorage.set(response.token);
            ctx.set(authAtom, {
              user: response,
              loading: false,
              isAuthenticated: true,
              error: null,
              initialized: true,
            });
          }),
        ),
        Effect.catchAll((error) => {
          // Handle error
        }),
      ),
    );
  },
);
```

#### Chat Atom (`lib/api/atoms/chat.ts`)

```typescript
type ChatState = {
  rooms: RoomWithMembers[];
  activeRoomId: string | null;
  messagesByRoom: Record<string, MessageWithUser[]>;
  wsStatus: ConnectionStatus;
  subscribedRooms: Set<string>;
  typingIndicators: Record<string, Record<string, TypingUser>>;
  loading: boolean;
  error: string | null;
};

export const chatAtom = Atom.make<ChatState>(initialState);

export const initializeChatAtom = Atom.writable(
  (get) => get(chatAtom),
  (ctx) => {
    const auth = ctx.get(authAtom);
    if (!auth.isAuthenticated || !auth.user) return;

    const wsClient = getWebSocketClient();
    
    // Start status polling
    const intervalId = setInterval(() => {
      const status = wsClient.getStatus();
      // Update status in atom
    }, 100);

    // Subscribe to event stream
    const eventStream = wsClient.getEventStream();
    Effect.runFork(
      Stream.runForEach(eventStream, (event) =>
        Effect.sync(() => {
          handleRealtimeEvent(ctx, event);
        }),
      ),
    );

    // Connect WebSocket
    Effect.runFork(wsClient.connect());

    // Load rooms via HTTP
    Effect.runPromise(
      apiClient.rooms.listByUser(auth.user.id).pipe(
        Effect.tap((rooms) =>
          Effect.sync(() => {
            ctx.set(chatAtom, { ...ctx.get(chatAtom), rooms, loading: false });
          }),
        ),
      ),
    );
  },
);
```

### 7.3 API Client (`lib/api/client.ts`)

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api";

export const apiFetchWithAuth = <T>(url: string, init?: RequestInit) =>
  apiFetch<T>(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenStorage.get() ?? ""}`,
      ...(init?.headers ?? {}),
    },
  });

export const apiClient = {
  auth: {
    login: (credentials) =>
      apiFetch<User & { token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      }).pipe(
        Effect.tap((data) => Effect.sync(() => tokenStorage.set(data.token))),
      ),
    signup: (credentials) => /* ... */,
  },
  
  user: {
    profile: () => apiFetchWithAuth<User>("/user/profile"),
    listAll: () => apiFetchWithAuth<User[]>("/user/list"),
  },

  rooms: {
    create: (data) => apiFetchWithAuth<Room>("/rooms/create", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    findOrCreateDM: (targetUserId) => /* ... */,
    listByUser: (userId) => /* ... */,
  },

  messages: {
    create: (data) => /* ... */,
    listByRoom: (roomId) => /* ... */,
  },
};
```

### 7.4 Page Components

#### Login Page (`app/login/page.tsx`)

```typescript
export default function LoginPage() {
  const authState = useAtomValue(authAtom);
  const setLogin = useAtomSet(loginAtom);
  const initializeAuth = useAtomSet(initializeAuthAtom);
  const router = useRouter();

  // Initialize auth on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Redirect if authenticated
  useEffect(() => {
    if (authState.isAuthenticated) {
      router.push("/chat");
    }
  }, [authState.isAuthenticated, router]);

  // Form setup with Effect validation
  const form = useForm<LoginType>({
    resolver: effectTsResolver(LoginSchema),
    defaultValues: { username: "", password: "" },
  });

  const handleSubmit = (data: LoginType) => {
    setLogin(data);  // Trigger login effect
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)}>
      {/* Form fields */}
      <Button disabled={authState.loading}>
        {authState.loading ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  );
}
```

#### Chat Page (`app/chat/page.tsx`)

```typescript
export default function ChatPage() {
  const authState = useAtomValue(authAtom);
  const chatState = useAtomValue(chatAtom);
  
  const initializeChat = useAtomSet(initializeChatAtom);
  const selectRoom = useAtomSet(selectRoomAtom);
  const sendMessage = useAtomSet(sendMessageAtom);
  const sendTyping = useAtomSet(sendTypingAtom);
  const createRoom = useAtomSet(createRoomAtom);

  // Initialize chat when auth is ready
  useEffect(() => {
    if (authState.initialized && authState.isAuthenticated) {
      initializeChat(undefined);
    }
  }, [authState.initialized, authState.isAuthenticated]);

  const activeRoom = chatState.rooms.find(r => r.id === chatState.activeRoomId);
  const activeMessages = chatState.activeRoomId 
    ? chatState.messagesByRoom[chatState.activeRoomId] || [] 
    : [];

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    sendMessage(messageInput);
    setMessageInput("");
  };

  return (
    <div className="h-screen flex">
      {/* Sidebar with rooms */}
      <div className="w-60">
        {chatState.rooms.map(room => (
          <button 
            key={room.id}
            onClick={() => selectRoom(room.id)}
          >
            {room.name}
          </button>
        ))}
      </div>

      {/* Main chat area */}
      <div className="flex-1">
        {activeMessages.map(message => (
          <div key={message.id}>{message.content}</div>
        ))}
        <input 
          value={messageInput}
          onChange={(e) => handleTyping(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
        />
      </div>
    </div>
  );
}
```

### Study Exercises

1. **Trace state flow**: Login → authAtom → redirect → chatAtom initialization
2. **Add a new atom**: Create a theme toggle atom
3. **Implement optimistic updates**: Study `sendMessageAtom`
4. **Add a new page**: Create a settings page

---

## 8. Real-time WebSocket Communication

### 8.1 Architecture Overview

```
┌─────────────────┐         ┌─────────────────┐
│   Frontend      │         │    Backend      │
│  WebSocketClient│         │ WebSocketServer │
│                 │         │                 │
│  connect()      │─────┐   │  on connection  │
│                 │     │   │                 │
│  send(auth)     │─────┼──>│  verify token   │
│                 │     │   │                 │
│  authenticated  │<────┼───│  send confirm   │
│                 │     │   │                 │
│  subscribe(room)│─────┼──>│  filter events  │
│                 │     │   │                 │
│  event          │<────┼───│  publish(event) │
│  event          │<────┘   │                 │
└─────────────────┘         └────────┬────────┘
                                    │
                          ┌─────────▼────────┐
                          │   RealTimeBus    │
                          │   (PubSub)       │
                          └──────────────────┘
```

### 8.2 Backend: RealTimeBus (`realtime/RealtimeBus.ts`)

The RealTimeBus is a central PubSub system for real-time events:

```typescript
export interface RealTimeBusInterface {
  publish: (event: RoomEvent) => Effect.Effect<void>;
  subscribeToRoom: (roomId: string) => Effect.Effect<Stream.Stream<RoomEvent>>;
  subscribeToRooms: (roomIds: string[]) => Effect.Effect<Stream.Stream<RoomEvent>>;
  subscribeToUser: (userId: string) => Effect.Effect<Stream.Stream<RoomEvent>>;
}

export const RealTimeBusLive = Layer.scoped(
  RealTimeBus,
  Effect.gen(function* () {
    // Create a bounded PubSub (max 1000 events)
    const pubsub = yield* PubSub.bounded<RoomEvent>(1000);
    
    return RealTimeBus.of({
      publish: (event: RoomEvent) => PubSub.publish(pubsub, event),

      subscribeToRoom: (roomId: string) =>
        Effect.gen(function* () {
          const dequeue = yield* PubSub.subscribe(pubsub);
          return Stream.fromQueue(dequeue).pipe(
            Stream.filter((event) => 
              "roomId" in event && event.roomId === roomId
            ),
          );
        }),

      subscribeToRooms: (roomIds: string[]) =>
        Effect.gen(function* () {
          const dequeue = yield* PubSub.subscribe(pubsub);
          const roomSet = new Set(roomIds);
          return Stream.fromQueue(dequeue).pipe(
            Stream.filter((event) => 
              "roomId" in event && roomSet.has(event.roomId)
            ),
          );
        }),

      subscribeToUser: (userId: string) =>
        Effect.gen(function* () {
          const dequeue = yield* PubSub.subscribe(pubsub);
          return Stream.fromQueue(dequeue).pipe(
            Stream.filter((event) => {
              switch (event.type) {
                case "room.created":
                  return event.room.created_by === userId;
                case "room.member_added":
                case "room.member_removed":
                  return event.userId === userId;
                case "user.typing":
                  return event.userId === userId;
                default:
                  return false;
              }
            }),
          );
        }),
    });
  }),
);
```

### 8.3 Backend: WebSocket Server (`realtime/WebSocketServer.ts`)

```typescript
export const createWebSocketServer = (
  server: any,
): Effect.Effect<WSServer, never, ServerEnv> =>
  Effect.gen(function* () {
    const runtime = yield* Effect.runtime<ServerEnv>();
    const wss = new WSServer({ noServer: true });

    wss.on("connection", (ws: WebSocket, req) => {
      const program = handleConnection(ws, runtime);
      Runtime.runFork(runtime)(program);
    });

    return wss;
  });

// Connection handler
const handleConnection = (ws: WebSocket, runtime: Runtime.Runtime<ServerEnv>) =>
  Effect.gen(function* () {
    // Connection state
    const state = yield* Ref.make(createInitialState());

    // Handle incoming messages
    ws.on("message", (data: Buffer) => {
      const program = handleClientMessage(ws, state, data.toString(), runtime);
      Runtime.runFork(runtime)(program);
    });

    // Handle disconnect
    ws.on("close", (code, reason) => {
      const cleanup = Effect.gen(function* () {
        yield* stopEventStream(state);
        yield* stopUserEventStream(state);
      });
      Runtime.runFork(runtime)(cleanup);
    });
  });
```

### 8.4 Client: WebSocket Client (`lib/realtime/ws.ts`)

```typescript
export class WebSocketClient {
  private state: WebSocketState | null = null;
  private connectionFiber: Fiber.RuntimeFiber<void, WebSocketError> | null = null;
  private eventHub: PubSub.PubSub<RoomEvent>;

  connect(): Effect.Effect<void, WebSocketError, never> {
    return Effect.gen(this, function* () {
      // Use forkDaemon for independent fiber
      this.connectionFiber = yield* Effect.forkDaemon(
        this.createConnection().pipe(Effect.uninterruptible),
      );
    });
  }

  private createConnection(): Effect.Effect<void, WebSocketError, never> {
    return Effect.gen(this, function* () {
      yield* this.setStatus("connecting");
      
      const ws = yield* this.createWebSocket();
      const authenticated = yield* Deferred.make<void, AuthenticationError>();
      
      this.state = {
        ws,
        status: "connecting",
        userId: null,
        username: null,
        subscribedRooms: new Set(),
      };

      // Run message handler and sender concurrently
      yield* Effect.all([
        this.setupMessageHandler(ws, authenticated),
        this.setupMessageSender(ws),
      ], { concurrency: "unbounded" });

      // Authenticate
      yield* this.setStatus("authenticating");
      yield* this.authenticate(ws);
      yield* Deferred.await(authenticated);
    });
  }

  private authenticate(ws: WebSocket): Effect.Effect<void, WebSocketError, never> {
    return Effect.gen(this, function* () {
      const token = tokenStorage.get();
      if (!token) {
        return yield* Effect.fail(new WebSocketError({ message: "No token" }));
      }
      ws.send(JSON.stringify({ type: "auth", token }));
    });
  }

  private setupMessageHandler(
    ws: WebSocket,
    authenticated: Deferred.Deferred<void, AuthenticationError>,
  ): Effect.Effect<void, WebSocketError, never> {
    return Effect.gen(this, function* () {
      ws.onmessage = (event) => {
        Effect.runFork(this.handleServerMessage(event.data, authenticated));
      };

      // Wait for close/error
      const closeSignal = yield* Deferred.make<void, WebSocketError>();
      ws.onclose = () => Effect.runFork(Deferred.fail(closeSignal, ...));
      ws.onerror = () => Effect.runFork(Deferred.fail(closeSignal, ...));
      yield* Deferred.await(closeSignal);
    });
  }

  private handleServerMessage(
    data: string,
    authenticated: Deferred.Deferred<void, AuthenticationError>,
  ): Effect.Effect<void, Error, never> {
    return Effect.gen(this, function* () {
      const message = JSON.parse(data) as WSServerMessage;

      switch (message.type) {
        case "authenticated":
          if (this.state) {
            this.state.userId = message.userId;
            this.state.username = message.username;
          }
          yield* this.setStatus("authenticated");
          yield* Deferred.succeed(authenticated, undefined);
          yield* this.resubscribeToRooms();
          break;

        case "event":
          const decoded = yield* Schema.decodeUnknown(RoomEventSchema)(message.event);
          yield* PubSub.publish(this.eventHub, decoded);
          break;
      }
    });
  }

  subscribe(roomId: string): Effect.Effect<void, never, never> {
    return Effect.gen(this, function* () {
      if (this.state) {
        this.state.subscribedRooms.add(roomId);
      }
      yield* this.sendMessage({ type: "subscribe", roomId });
    });
  }

  sendChatMessage(roomId: string, content: string): Effect.Effect<void, never, never> {
    return this.sendMessage({ type: "message.send", roomId, content });
  }

  getEventStream(): Stream.Stream<RoomEvent, never, never> {
    return Stream.fromPubSub(this.eventHub);
  }
}
```

### 8.5 Event Types (`packages/shared/src/schema/`)

```typescript
// RealTimeEventSchema.ts
export const MessageCreatedEventSchema = Schema.Struct({
  type: Schema.Literal("message.created"),
  roomId: Schema.String,
  message: MessageWithUserSchema,
  timestamp: Schema.Date,
});

export const RoomMemberAddedEventSchema = Schema.Struct({
  type: Schema.Literal("room.member_added"),
  roomId: Schema.String,
  userId: Schema.String,
  username: Schema.String,
  role: Schema.Literal("member", "admin", "owner"),
  addedBy: Schema.String,
  timestamp: Schema.Date,
});

export const UserTypingEventSchema = Schema.Struct({
  type: Schema.Literal("user.typing"),
  roomId: Schema.String,
  userId: Schema.String,
  username: Schema.String,
  isTyping: Schema.Boolean,
  timestamp: Schema.Date,
});

export const RoomEventSchema = Schema.Union(
  MessageCreatedEventSchema,
  MessageUpdatedEventSchema,
  RoomCreatedEventSchema,
  RoomMemberAddedEventSchema,
  UserTypingEventSchema,
  // ... more events
);
```

### 8.6 Publishing Events from Services

```typescript
// RoomService.ts - Publishing room.created
const room = yield* toRoom(roomResult[0]);

yield* bus.publish({
  type: "room.created",
  room: room,
  timestamp: new Date(),
});

// MessageService.ts - Publishing message.updated
yield* bus.publish({
  type: "message.updated",
  timestamp: new Date(),
  userId,
  roomId: row[0]?.room_id as string,
  content,
  messageId,
  updatedAt: new Date(),
});
```

### Study Exercises

1. **Trace an event**: Message send → WebSocket → RealTimeBus → All subscribers
2. **Add a new event type**: e.g., "user.online" / "user.offline"
3. **Implement room typing indicators**: Study existing typing implementation
4. **Add message reactions**: Design and implement reaction events

---

## 9. Database Design & Migrations

### 9.1 Database Schema

#### Users Table (`user/UserModel.sql`)

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
```

#### Rooms Tables (`room/RoomModel.sql`)

```sql
-- Main rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  TYPE TEXT NOT NULL CHECK (TYPE IN ('channel', 'dm')),
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Room membership table
CREATE TABLE IF NOT EXISTS room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_created_by ON rooms(created_by);
```

#### Messages Table (`message/MessageModel.sql`)

```sql
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL  -- Soft delete
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_room_active ON messages(room_id, created_at DESC) 
  WHERE deleted_at IS NULL;
```

#### Invitations Table (`invitation/InvitationModel.sql`)

```sql
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '7 days')
);

-- Partial unique index for pending invitations
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_unique_pending
  ON invitations(room_id, invitee_id)
  WHERE status = 'pending';
```

### 9.2 Running Migrations

```typescript
// migrate.ts
const sqlFiles = [
  "user/UserModel.sql",
  "room/RoomModel.sql",
  "message/MessageModel.sql",
  "invitation/InvitationModel.sql",
];

const migrate = Effect.gen(function* () {
  yield* Console.log("Migration starts...");
  const DB = yield* Db;
  let combinedSql = "";

  for (const file of sqlFiles) {
    const sql = readFileSync(join(__dirname, file), "utf-8");
    combinedSql += sql + "\n";
  }

  yield* DB.unsafe(combinedSql);
  yield* Console.log("Migration completed successfully");
});

Effect.runPromise(migrate.pipe(Effect.provide(DbLive)));
```

Run with:
```bash
pnpm --filter @hive/server db:migrate
```

### 9.3 Common SQL Patterns

#### Parameterized Queries (SQL Injection Safe)

```typescript
// Using Effect SQL tagged template
const result = yield* db`
  SELECT * FROM users 
  WHERE username = ${username} 
  LIMIT 1
`;
```

#### Transactions

```typescript
const result = yield* Db.transaction((sql) =>
  Effect.gen(function* () {
    yield* sql`INSERT INTO rooms ...`;
    yield* sql`INSERT INTO room_members ...`;
  }),
);
```

#### Complex Queries with CTEs

```typescript
const rooms = yield* sqlSafe(db`
  WITH member_counts AS (
    SELECT room_id, COUNT(*) AS member_count
    FROM room_members
    GROUP BY room_id
  )
  SELECT r.*, rm.role as user_role, mc.member_count
  FROM rooms r
  INNER JOIN room_members rm ON r.id = rm.room_id
  INNER JOIN member_counts mc ON r.id = mc.room_id
  WHERE rm.user_id = ${userId}
  ORDER BY r.updated_at DESC
`);
```

### Study Exercises

1. **Design a new table**: Add a "reactions" table for message reactions
2. **Write complex queries**: Practice with JOINs and CTEs
3. **Add indexes**: Identify slow queries and add appropriate indexes
4. **Implement soft delete**: Study the messages table pattern

---

## 10. Authentication & Security

### 10.1 JWT Authentication Flow

```
┌──────────┐                              ┌──────────┐
│  Client  │                              │  Server  │
└────┬─────┘                              └────┬─────┘
     │                                         │
     │  POST /auth/login {username, password}  │
     │────────────────────────────────────────>│
     │                                         │
     │                           Verify credentials
     │                           Generate JWT token
     │                                         │
     │  { user, token }                        │
     │<────────────────────────────────────────│
     │                                         │
     │  Store token (localStorage)             │
     │                                         │
     │  GET /api/user/profile                  │
     │  Authorization: Bearer <token>          │
     │────────────────────────────────────────>│
     │                                         │
     │                           Verify JWT signature
     │                           Extract user from payload
     │                                         │
     │  { user }                               │
     │<────────────────────────────────────────│
     │                                         │
```

### 10.2 JWT Service (`jwt/JwtService.ts`)

```typescript
export interface JwtService {
  sign: (payload: AuthJWTPayload) => Effect.Effect<string, JwtError>;
  verify: (token: string) => Effect.Effect<AuthJWTPayload, JwtError>;
}

export const JwtServiceLive = Layer.effect(
  JwtService,
  Effect.gen(function* () {
    const appConfig = yield* AppConfig;
    const secret = new TextEncoder().encode(appConfig.JWT_SECRET);

    return JwtService.of({
      sign: (payload) =>
        Effect.tryPromise(() =>
          new SignJWT(payload)
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("7d")
            .sign(secret),
        ).pipe(
          Effect.mapError(() => new JwtError({ 
            code: "JWT_SIGN_ERROR", 
            message: "Signing jwt token failed" 
          })),
        ),

      verify: (token: string) =>
        Effect.tryPromise({
          try: () => jwtVerify(token, secret),
          catch: (cause) => new JwtError({
            code: "JWT_VERIFY_ERROR",
            message: "Jwt verify error",
            cause,
          }),
        }).pipe(Effect.map(({ payload }) => payload as AuthJWTPayload)),
    });
  }),
);
```

### 10.3 Auth Middleware (`auth/AuthMiddleware.ts`)

```typescript
export const requireAuth: Effect.Effect<
  AuthJWTPayload,
  AuthError,
  HttpServerRequest.HttpServerRequest | JwtService
> = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return yield* new AuthError({
      code: "MISSING_TOKEN",
      message: "Token is not present in request header",
    });
  }
  
  const token = authHeader.replace("Bearer ", "");
  const jwtService = yield* JwtService;
  
  const payload = yield* jwtService.verify(token).pipe(
    Effect.mapError(() => new AuthError({
      code: "INVALID_TOKEN",
      message: "Token Invalid or expires",
    })),
  );
  
  return payload;
});
```

### 10.4 Protected Routes

```typescript
export const handleProfile = () =>
  Effect.gen(function* () {
    const userService = yield* UserService;
    const user = yield* requireAuth;  // Extract user from JWT
    const result = yield* userService.findById(user.id as string);
    return result;
  }).pipe(
    Effect.mapError((err) => ({
      code: err.code,
      message: err.message,
    })),
  );
```

### 10.5 Password Hashing (`user/Utils.ts`)

```typescript
export const passwordHash = (password: string) =>
  Effect.tryPromise(() => bcrypt.hash(password, 10)).pipe(
    Effect.mapError(() => new UserServiceError({
      code: "USER_CREATION_FAILED",
      message: "Password hashing failed",
    })),
  );

export const comparePassword = (password: string, password_hash: string) =>
  Effect.tryPromise(() => bcrypt.compare(password, password_hash)).pipe(
    Effect.mapError(() => new UserServiceError({
      code: "INVALID_CREDENTIALS",
      message: "Password matching failed",
    })),
  );
```

### 10.6 WebSocket Authentication

```typescript
// Client sends auth message
ws.send(JSON.stringify({ type: "auth", token }));

// Server verifies
const handleAuthentication = (
  ws: WebSocket,
  state: Ref.Ref<ConnectionState>,
  token: string,
  runtime: Runtime.Runtime<ServerEnv>,
) =>
  Effect.gen(function* () {
    const jwtService = yield* JwtService;
    const userService = yield* UserService;

    const payload = yield* jwtService.verify(token);
    const user = yield* userService.findById(payload.id);

    yield* Ref.update(state, (s) => ({
      ...s,
      userId: user.id,
      username: user.username,
      userEmail: user.email ?? null,
      authenticated: true,
    }));

    yield* sendMessage(ws, {
      type: "authenticated",
      userId: user.id,
      username: user.username,
    });
  });
```

### Security Best Practices Implemented

1. **Password Hashing**: bcrypt with salt rounds
2. **JWT Expiration**: 7-day token expiration
3. **SQL Injection Prevention**: Parameterized queries
4. **CORS Configuration**: Allowed origins configured
5. **Token Storage**: localStorage (consider httpOnly cookies for production)
6. **Input Validation**: Effect Schema validation on all inputs

### Study Exercises

1. **Add token refresh**: Implement refresh token flow
2. **Add rate limiting**: Prevent brute force attacks
3. **Implement logout**: Token invalidation
4. **Add OAuth**: Google/GitHub authentication

---

## 11. State Management with Effect Atoms

### 11.1 What are Effect Atoms?

Effect Atoms provide reactive state management that integrates seamlessly with Effect's type system and effects.

```typescript
// Basic atom
const countAtom = Atom.make(0);

// Read value
const count = useAtomValue(countAtom);

// Update value
const setCount = useAtomSet(countAtom);
setCount(5);
```

### 11.2 Writable Atoms (With Effects)

```typescript
export const loginAtom = Atom.writable(
  // Read function
  (get) => get(authAtom),
  
  // Write function (can run effects)
  (ctx, credentials: { username: string; password: string }) => {
    // Update state immediately (loading)
    ctx.set(authAtom, {
      ...ctx.get(authAtom),
      loading: true,
      error: null,
    });

    // Run async effect
    Effect.runPromise(
      apiClient.auth.login(credentials).pipe(
        Effect.tap((response) =>
          Effect.sync(() => {
            // Update state on success
            tokenStorage.set(response.token);
            ctx.set(authAtom, {
              user: response,
              loading: false,
              isAuthenticated: true,
              error: null,
            });
          }),
        ),
        Effect.catchAll((error) => {
          // Update state on error
          ctx.set(authAtom, {
            ...ctx.get(authAtom),
            loading: false,
            error: error instanceof ApiError ? error : new ApiError({ 
              message: "Login failed", 
              code: "UNKNOWN_ERROR" 
            }),
          });
        }),
      ),
    );
  },
);
```

### 11.3 Using Atoms in Components

```typescript
"use client";

import { useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import { authAtom, loginAtom } from "@/lib/api/atoms/auth";

export default function LoginForm() {
  // Read state
  const authState = useAtomValue(authAtom);
  
  // Get setter function
  const login = useAtomSet(loginAtom);

  const handleSubmit = (data: LoginType) => {
    login(data);  // Triggers the effect
  };

  return (
    <form onSubmit={handleSubmit}>
      {authState.loading && <Spinner />}
      {authState.error && <Error message={authState.error.message} />}
      {/* ... fields */}
    </form>
  );
}
```

### 11.4 Complex State: Chat Atom

```typescript
type ChatState = {
  rooms: RoomWithMembers[];
  activeRoomId: string | null;
  messagesByRoom: Record<string, MessageWithUser[]>;
  wsStatus: ConnectionStatus;
  subscribedRooms: Set<string>;
  typingIndicators: Record<string, Record<string, TypingUser>>;
};

export const chatAtom = Atom.make<ChatState>(initialState);

// Complex operation: Select room
export const selectRoomAtom = Atom.writable(
  (get) => get(chatAtom),
  (ctx, roomId: string) => {
    const currentState = ctx.get(chatAtom);
    const auth = ctx.get(authAtom);
    const wsClient = getWebSocketClient();

    // Unsubscribe from previous room
    if (currentState.activeRoomId) {
      Effect.runFork(wsClient.unsubscribe(currentState.activeRoomId));
    }

    // Update state
    ctx.set(chatAtom, {
      ...currentState,
      activeRoomId: roomId,
      loading: true,
    });

    // Fetch messages and subscribe
    Effect.runPromise(
      apiClient.messages.listByRoom(roomId).pipe(
        Effect.tap((messages) =>
          Effect.gen(function* () {
            yield* wsClient.subscribe(roomId);
            
            yield* Effect.sync(() => {
              const state = ctx.get(chatAtom);
              ctx.set(chatAtom, {
                ...state,
                messagesByRoom: {
                  ...state.messagesByRoom,
                  [roomId]: messages.reverse(),
                },
                subscribedRooms: new Set([...state.subscribedRooms, roomId]),
                loading: false,
              });
            });
          }),
        ),
      ),
    );
  },
);
```

### 11.5 Optimistic Updates

```typescript
export const sendMessageAtom = Atom.writable(
  (get) => get(chatAtom),
  (ctx, content: string) => {
    const state = ctx.get(chatAtom);
    const auth = ctx.get(authAtom);
    const roomId = state.activeRoomId;

    if (!roomId || !auth.user) return;

    // Create optimistic message
    const optimisticId = `_optimistic:${++optimisticCounter}`;
    const now = new Date();
    const optimisticMessage: MessageWithUser = {
      id: optimisticId,
      room_id: roomId,
      user_id: auth.user.id,
      content,
      created_at: now,
      updated_at: now,
      username: auth.user.username,
      user_email: auth.user.email ?? null,
      is_edited: false,
    };

    // Update UI immediately
    const existingMessages = state.messagesByRoom[roomId] || [];
    ctx.set(chatAtom, {
      ...state,
      messagesByRoom: {
        ...state.messagesByRoom,
        [roomId]: [...existingMessages, optimisticMessage],
      },
    });

    // Send to server
    const wsClient = getWebSocketClient();
    Effect.runFork(wsClient.sendChatMessage(roomId, content));
  },
);

// Later, when server confirms, replace optimistic with real message
function handleRealtimeEvent(ctx, event: RoomEvent) {
  if (event.type === "message.created") {
    const existingMessages = state.messagesByRoom[event.roomId] || [];
    const optimisticIdx = existingMessages.findIndex(
      (m) =>
        m.id.startsWith("_optimistic:") &&
        m.user_id === event.message.user_id &&
        m.content === event.message.content,
    );

    if (optimisticIdx !== -1) {
      // Replace optimistic with real
      newMessages[optimisticIdx] = event.message;
    } else {
      // New message from another user
      newMessages = [...existingMessages, event.message];
    }
  }
}
```

### Study Exercises

1. **Create a theme atom**: Toggle dark/light mode
2. **Add loading states**: Implement skeleton loaders
3. **Implement undo**: Add undo functionality to message deletion
4. **Add pagination**: Implement infinite scroll for messages

---

## 12. Testing & Debugging

### 12.1 Development Tools

#### Debug Logging

Add console logs to trace execution:

```typescript
// In service methods
Effect.gen(function* () {
  yield* Console.log("Service method called with:", input);
  const result = yield* someEffect;
  yield* Console.log("Result:", result);
  return result;
});
```

#### Effect Tracing

```typescript
import { Effect } from "effect";

effect.pipe(
  Effect.tapBoth({
    onSuccess: (a) => Console.log("Success:", a),
    onFailure: (e) => Console.error("Error:", e),
  }),
);
```

### 12.2 Testing Strategies

#### Unit Testing Services

```typescript
import { describe, it, expect } from "vitest";
import { Effect, Layer } from "effect";

describe("UserService", () => {
  it("should create a user", () => {
    const program = Effect.gen(function* () {
      const userService = yield* UserService;
      const user = yield* userService.create("testuser", "password123");
      return user;
    });

    const TestLive = Layer.mergeAll(
      UserServiceLive,
      DbLive,  // Use test database
      JwtServiceLive,
    );

    const result = Effect.runPromise(program.pipe(Effect.provide(TestLive)));
    expect(result.username).toBe("testuser");
  });
});
```

#### Integration Testing API

```typescript
import { HttpClient } from "@effect/platform";

describe("Auth API", () => {
  it("should login user", async () => {
    const client = HttpClient.fetch();
    
    const response = yield* client.post("/auth/login", {
      body: JSON.stringify({ username: "test", password: "pass" }),
    });
    
    expect(response.status).toBe(200);
  });
});
```

### 12.3 Common Issues & Solutions

#### Issue: Effect not executing

```typescript
// Wrong - Effect is lazy, needs to be run
const effect = someEffect();

// Correct
Effect.runPromise(effect);
// or
Effect.runSync(effect);
// or
yield* effect;  // Inside Effect.gen
```

#### Issue: Missing dependencies

```typescript
// Wrong - missing Layer.provide
const result = Effect.runPromise(someEffect);

// Correct
const result = Effect.runPromise(
  someEffect.pipe(Effect.provide(ServiceLive)),
);
```

#### Issue: WebSocket not connecting

Check:
1. Server is running on correct port
2. CORS is configured correctly
3. Token is valid
4. WebSocket URL is correct

### 12.4 Debugging WebSocket

```typescript
// Add logging in WebSocket handler
ws.on("message", (data) => {
  console.log("Received:", data.toString());
  // ...
});

ws.on("close", (code, reason) => {
  console.log("Closed:", code, reason.toString());
});
```

### Study Exercises

1. **Write unit tests**: For UserService methods
2. **Add integration tests**: For API endpoints
3. **Debug a failing effect**: Practice tracing
4. **Add error boundaries**: Handle errors gracefully

---

## 13. Deployment & Production

### 13.1 Environment Variables for Production

```bash
# .env.production
NODE_ENV=production
DATABASE_URL="postgresql://user:password@prod-db:5432/hive_db"
JWT_SECRET="<strong-random-secret>"
PORT=3002
CORS_ORIGIN="https://your-domain.com"

# Frontend
NEXT_PUBLIC_API_URL="https://api.your-domain.com/api"
NEXT_PUBLIC_WS_URL="wss://api.your-domain.com/ws"
```

### 13.2 Building for Production

```bash
# Build all packages
pnpm build

# Build individual apps
pnpm --filter @hive/server build
pnpm --filter @hive/web build
```

### 13.3 Database Migrations in Production

```bash
# Run before deploying new version
pnpm --filter @hive/server db:migrate
```

### 13.4 Deployment Options

#### Option 1: Docker

```dockerfile
# Dockerfile.server
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @hive/server build
EXPOSE 3002 3003
CMD ["pnpm", "--filter", "@hive/server", "start"]
```

#### Option 2: Vercel (Frontend) + Railway/Render (Backend)

- Deploy `@hive/web` to Vercel
- Deploy `@hive/server` to Railway/Render
- Use managed PostgreSQL

#### Option 3: Single VPS

```bash
# Using PM2
pm2 start ecosystem.config.js
```

### 13.5 Production Checklist

- [ ] Environment variables configured
- [ ] Database migrated
- [ ] SSL certificates installed
- [ ] CORS configured for production domain
- [ ] JWT secret is strong and unique
- [ ] Rate limiting enabled
- [ ] Logging configured
- [ ] Monitoring setup
- [ ] Backup strategy implemented

---

## 14. Next Steps & Advanced Topics

### 14.1 Features to Add

1. **File Uploads**: Images, documents in messages
2. **Message Threads**: Nested replies
3. **Search**: Full-text search for messages
4. **Notifications**: Push notifications for mentions
5. **User Presence**: Online/offline status
6. **Message Reactions**: Emoji reactions
7. **Room Settings**: Customizable room options
8. **Admin Panel**: User and room management

### 14.2 Advanced Effect Patterns

1. **Caching**: Use Effect's caching features
2. **Retry Policies**: Automatic retry for failed operations
3. **Circuit Breakers**: Prevent cascade failures
4. **Metrics**: Collect and export metrics
5. **Distributed Tracing**: Trace requests across services

### 14.3 Scaling Considerations

1. **Horizontal Scaling**: Multiple server instances
2. **Redis PubSub**: Replace in-memory PubSub
3. **Load Balancing**: Distribute WebSocket connections
4. **Database Pooling**: Optimize database connections
5. **CDN**: Serve static assets

### 14.4 Learning Resources

- [Effect Documentation](https://effect.website/)
- [Effect YouTube Channel](https://www.youtube.com/@effect-ts)
- [Next.js Documentation](https://nextjs.org/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

### 14.5 Project Ideas

1. **Video Chat**: Add WebRTC for video calls
2. **Screen Sharing**: Collaborative features
3. **Bots**: Extensible bot system
4. **Integrations**: Slack, GitHub, etc.
5. **Mobile App**: React Native version

---

## Conclusion

Congratulations! You've completed a comprehensive tour of the Fullstack Effect Hive application. You now understand:

- **Effect Framework**: Core concepts, Layers, Context, Error handling
- **Backend Architecture**: Services, API routes, Database integration
- **Frontend Development**: Next.js, Effect Atoms, Real-time updates
- **WebSocket Communication**: Real-time messaging architecture
- **Security**: JWT authentication, password hashing
- **State Management**: Reactive state with Effect integration

### Your Learning Path Forward

1. **Week 1-2**: Master Effect basics (Types, Effects, Layers)
2. **Week 3-4**: Build a simple CRUD service
3. **Week 5-6**: Add WebSocket real-time features
4. **Week 7-8**: Implement authentication
5. **Week 9-10**: Build a complete feature end-to-end
6. **Week 11-12**: Optimize and deploy

Remember: The best way to learn is by building. Start small, iterate often, and don't be afraid to experiment!

Happy coding! 🚀
