# NextAuth Authentication Package

A robust, type-safe authentication package built with [NextAuth.js](https://next-auth.js.org/) (Auth.js), [Effect](https://effect.land/), and [Prisma ORM](https://www.prisma.io/). This package provides a complete authentication solution that can be easily integrated into other Next.js projects.

## 🚀 Features

- **Complete Authentication System**: User registration, login, password reset, and two-factor authentication
- **Type-Safe**: Built with TypeScript and Effect for robust error handling
- **Database Integration**: Prisma ORM with PostgreSQL support
- **Modern Architecture**: Built with Effect for functional programming patterns
- **Easy Integration**: Simple exports for quick setup in other projects
- **Security**: Bcrypt password hashing, JWT tokens, and secure session management

## 📦 Packages

This monorepo contains the following packages:

- **`@repo/auth`**: Core authentication package with NextAuth.js integration
- **`@repo/db`**: Database layer with Prisma ORM and Effect services
- **`@repo/ui`**: Shared UI components
- **`@repo/eslint-config`**: ESLint configurations
- **`@repo/typescript-config`**: TypeScript configurations

## 🛠️ Tech Stack

- **Authentication**: [NextAuth.js](https://next-auth.js.org/) (Auth.js v5)
- **Functional Programming**: [Effect](https://effect.land/) for error handling and side effects
- **Database**: [Prisma ORM](https://www.prisma.io/) with PostgreSQL
- **Password Security**: [bcryptjs](https://github.com/dcodeIO/bcrypt.js/)
- **JWT**: [jose](https://github.com/panva/jose) for token handling
- **Email**: [Resend](https://resend.com/) for transactional emails
- **Monorepo**: [Turborepo](https://turborepo.com/) for efficient development

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd next-auth

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# NextAuth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Email (Resend)
RESEND_API_KEY="your-resend-api-key"
```

### Database Setup

```bash
# Generate Prisma client
pnpm --filter @repo/db db:generate

# Run migrations
pnpm --filter @repo/db db:migrate

# Or push schema changes
pnpm --filter @repo/db db:push
```

### Development

```bash
# Start development mode for all packages
pnpm dev

# Build all packages
pnpm build

# Lint all packages
pnpm lint
```

## 📚 Usage

### Basic Authentication Setup

```typescript
// In your Next.js app
import { authOptions } from '@repo/auth/options';
import NextAuth from 'next-auth';

export const { handlers, auth } = NextAuth(authOptions);

// API routes
export const GET = handlers.GET;
export const POST = handlers.POST;
```

### User Registration

```typescript
import { registerUser } from '@repo/auth/signup';
import { Effect } from 'effect';

const handleSignup = async (email: string, password: string) => {
  const result = await Effect.runPromise(
    registerUser({ email, password })
  );
  
  if (Effect.isSuccess(result)) {
    // User created successfully
    console.log('User created:', result.value);
  } else {
    // Handle error
    console.error('Error:', result.error);
  }
};
```

### User Login

```typescript
import { loginEffect } from '@repo/auth/login';
import { useRouter } from 'next/navigation';

const handleLogin = async (email: string, password: string) => {
  const router = useRouter();
  
  const result = await Effect.runPromise(
    loginEffect(email, password, router)
  );
  
  if (Effect.isSuccess(result)) {
    // Login successful, user redirected to dashboard
  } else {
    // Handle login error
    console.error('Login failed:', result.error);
  }
};
```

### Password Reset

```typescript
import { forgotPasswordRoute } from '@repo/auth/forgot-password-route';
import { resetPasswordRoute } from '@repo/auth/reset-password-route';

// Use in your API routes
export const POST = forgotPasswordRoute;
export const PUT = resetPasswordRoute;
```

## 🏗️ Architecture

### Effect Integration

The package uses Effect for functional error handling and side effects:

```typescript
import { Effect } from 'effect';

// All database operations are wrapped in Effect
const userResult = yield* findUserByEmail(email);

// Error handling with Effect
const result = yield* Effect.tryPromise({
  try: () => bcrypt.compare(password, user.password!),
  catch: (err) => new Error(`Password comparison failed: ${err}`)
});
```

### Prisma Service Layer

Database operations are abstracted through a service layer:

```typescript
import { PrismaServiceLive, findUserByEmail } from '@repo/db';

const userEffect = Effect.gen(function* () {
  const user = yield* findUserByEmail(email);
  // ... rest of the logic
}).pipe(Effect.provide(PrismaServiceLive));
```

## 🔧 Development

### Package Structure

```
packages/
├── auth/                 # Authentication package
│   ├── src/
│   │   ├── options.ts    # NextAuth configuration
│   │   ├── login.ts      # Login logic with Effect
│   │   ├── signup.ts     # User registration
│   │   ├── next.ts       # Next.js integration
│   │   └── reset-password/ # Password reset functionality
│   └── package.json
├── db/                   # Database package
│   ├── src/
│   │   ├── prisma-service.ts # Effect-based Prisma service
│   │   ├── query.ts      # Database queries
│   │   └── index.ts      # Exports
│   ├── prisma/           # Prisma schema and migrations
│   └── package.json
└── ui/                   # Shared UI components
```

### Adding New Features

1. **Database Changes**: Update the Prisma schema in `packages/db/prisma/schema.prisma`
2. **New Queries**: Add to `packages/db/src/query.ts`
3. **Auth Logic**: Add to `packages/auth/src/`
4. **Build**: Run `pnpm build` to generate types and build packages

## 📖 API Reference

### Auth Package Exports

- `@repo/auth/options` - NextAuth configuration
- `@repo/auth/next` - Next.js integration helpers
- `@repo/auth/login` - Login functionality
- `@repo/auth/signup` - User registration
- `@repo/auth/signup-route` - Signup API route
- `@repo/auth/forgot-password-route` - Password reset request
- `@repo/auth/reset-password-route` - Password reset
- `@repo/auth/crypto-service` - JWT and crypto utilities

### Database Package Exports

- `@repo/db` - Main database client and services
- `@repo/db/prisma` - Prisma client instance
- `@repo/db/query` - Database query functions
- `@repo/db/prisma-service` - Effect-based Prisma service

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Effect Documentation](https://effect.land/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Turborepo Documentation](https://turborepo.com/docs)
