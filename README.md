# Fullstack Effect Hive

A modern, type-safe fullstack chat application built with [Effect](https://effect.land/), featuring real-time messaging, room-based conversations, and user authentication. This monorepo showcases functional programming patterns with Effect while delivering a complete chat experience.

## 🚀 Features

- **Real-time Chat**: WebSocket-based messaging with instant delivery
- **Room-based Conversations**: Create and join chat rooms for organized discussions
- **User Authentication**: Secure JWT-based authentication system
- **Invitation System**: Invite users to join rooms and conversations
- **Type-Safe**: Built with TypeScript and Effect for robust error handling
- **Functional Architecture**: Effect-based services for predictable, testable code
- **Database Integration**: PostgreSQL with Effect SQL for reliable data persistence
- **Modern Frontend**: Next.js 15 with React 19 and Tailwind CSS

## 📦 Apps & Packages

This monorepo contains the following applications and packages:

### Apps

- **`@hive/server`**: Effect-based backend API server with WebSocket support
- **`@hive/web`**: Next.js frontend application with modern UI

### Packages

- **`@hive/eslint-config`**: Shared ESLint configurations
- **`@hive/typescript-config`**: Shared TypeScript configurations

## 🛠️ Tech Stack

- **Backend Framework**: [Effect](https://effect.land/) for functional programming and error handling
- **HTTP Server**: Effect Platform with Node.js runtime
- **Database**: PostgreSQL with Effect SQL
- **Real-time**: WebSocket integration for live messaging
- **Frontend**: [Next.js 15](https://nextjs.org/) with [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) for modern UI
- **Monorepo**: [Turborepo](https://turborepo.com/) for efficient development
- **Type Safety**: [TypeScript](https://www.typescriptlang.org/) throughout

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- pnpm package manager

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd fullstack-effect-hive

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/hive_db"

# Server
PORT=3001
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# Frontend (optional, for production builds)
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

### Database Setup

```bash
# Run database migrations
pnpm --filter @hive/server db:migrate
```

### Development

```bash
# Start both server and web apps in development mode
pnpm dev

# Or run them separately:
pnpm --filter @hive/server dev    # Start the Effect server on port 3001
pnpm --filter @hive/web dev       # Start the Next.js app on port 3000

# Build all apps
pnpm build

# Lint all code
pnpm lint

# Type checking
pnpm check-types
```

## 📚 Usage

### Architecture Overview

The application follows a clean architecture with Effect-based services:

- **Server**: Effect HTTP API with WebSocket support for real-time features
- **Database**: PostgreSQL with Effect SQL for type-safe queries
- **Frontend**: Next.js with modern React patterns
- **Real-time**: WebSocket connections for live messaging

### API Endpoints

The server exposes RESTful endpoints for:

- User management (registration, authentication)
- Room creation and management
- Message handling
- Invitation system

### Frontend Integration

The Next.js frontend connects to the Effect server via:

- HTTP requests for data operations
- WebSocket connections for real-time updates
- JWT-based authentication

  if (Effect.isSuccess(result)) {
  // Login successful, user redirected to dashboard
  } else {
  // Handle login error
  console.error("Login failed:", result.error);
  }
  };

````

### Password Reset

```typescript
import { forgotPasswordRoute } from "@repo/auth/forgot-password-route";
import { resetPasswordRoute } from "@repo/auth/reset-password-route";

// Use in your API routes
export const POST = forgotPasswordRoute;
export const PUT = resetPasswordRoute;
````

## 🏗️ Architecture

### Effect Integration

The application uses Effect for functional error handling and side effects throughout:

```typescript
import { Effect } from "effect";

// All operations are wrapped in Effect for predictable error handling
const userResult = yield * findUserByEmail(email);

// HTTP API with Effect Platform
const api = HttpApi.make("ChatAPI").add(
  HttpApiGroup.make("users").add(
    HttpApiEndpoint.post("register")`/users`.addSuccess(UserSchema),
  ),
);

// WebSocket real-time messaging
const realtimeBus = yield * RealtimeBus;
yield * realtimeBus.broadcast(roomId, message);
```

### Service Layer Architecture

Business logic is organized in service layers with Effect:

```typescript
// User service with Effect
export const UserService = Effect.gen(function* () {
  const db = yield* DatabaseService;
  const auth = yield* AuthService;

  return {
    createUser: (data: UserCreate) =>
      Effect.gen(function* () {
        // Implementation with proper error handling
      }),
    authenticateUser: (credentials: LoginCredentials) =>
      Effect.gen(function* () {
        // JWT token generation and validation
      }),
  };
});
```

## 🔧 Development

### Project Structure

```
apps/
├── server/               # Effect-based backend
│   ├── src/
│   │   ├── api/routes/   # HTTP API routes
│   │   ├── auth/         # Authentication services
│   │   ├── config/       # Configuration management
│   │   ├── invitation/   # Invitation system
│   │   ├── message/      # Message handling
│   │   ├── realtime/     # WebSocket real-time features
│   │   ├── room/         # Room management
│   │   ├── user/         # User services
│   │   ├── index.ts      # Server entry point
│   │   └── migrate.ts    # Database migrations
│   └── package.json
└── web/                  # Next.js frontend
    ├── app/              # Next.js app router
    ├── public/           # Static assets
    └── package.json

packages/
├── eslint-config/        # Shared ESLint configs
└── typescript-config/    # Shared TypeScript configs
```

### Adding New Features

1. **Database Models**: Add SQL schema files in `apps/server/src/*/Model.sql`
2. **Services**: Implement Effect-based services in respective directories
3. **API Routes**: Add HTTP endpoints in `apps/server/src/api/routes/`
4. **Frontend**: Build React components in `apps/web/app/`
5. **Real-time**: Extend WebSocket functionality in `apps/server/src/realtime/`
6. **Build**: Run `pnpm build` to compile all applications

## 📖 API Reference

### Server Services

- **UserService**: User registration, authentication, and profile management
- **RoomService**: Chat room creation, membership, and management
- **MessageService**: Message sending, retrieval, and real-time delivery
- **InvitationService**: Room invitation creation and acceptance
- **AuthService**: JWT token generation and validation
- **RealtimeBus**: WebSocket-based real-time messaging

### HTTP API Endpoints

- `GET /` - Health check
- `POST /users` - User registration
- `POST /auth/login` - User authentication
- `GET /rooms` - List user's rooms
- `POST /rooms` - Create new room
- `GET /rooms/:id/messages` - Get room messages
- `POST /rooms/:id/messages` - Send message
- `POST /rooms/:id/invitations` - Invite user to room

### WebSocket Events

- `join-room` - Join a chat room
- `leave-room` - Leave a chat room
- `send-message` - Send a message to room
- `message-received` - Receive new messages in real-time

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- [Effect Documentation](https://effect.land/) - Functional programming framework
- [Next.js Documentation](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Turborepo Documentation](https://turborepo.com/docs) - Monorepo build system
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets) - Real-time communication
