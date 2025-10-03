---
inclusion: always
---
# Technology Stack

ActionLoom is built with modern web technologies optimized for performance and developer experience.

## Frontend Stack
- **Framework**: Next.js 15.2.4 with App Router
- **Runtime**: React 19 with TypeScript 5
- **Styling**: Tailwind CSS 4.1.9 with CSS variables
- **UI Components**: Radix UI primitives with shadcn/ui (New York style)
- **Icons**: Lucide React
- **Fonts**: Geist Sans & Geist Mono
- **Theme**: next-themes for dark/light mode support

## Workflow Engine
- **Canvas**: @xyflow/react (ReactFlow) for visual workflow builder
- **Form Handling**: React Hook Form with Zod validation
- **State Management**: React useState/useEffect patterns

## Build System & Tools
- **Package Manager**: pnpm (lockfile present)
- **Build Tool**: Next.js built-in bundler
- **Linting**: ESLint (disabled during builds for rapid development)
- **TypeScript**: Strict mode enabled, build errors ignored for development speed

## Common Commands
```bash
# Development
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint

# Package management
pnpm install      # Install dependencies
pnpm add <pkg>    # Add new dependency
```

## Configuration Notes
- Path aliases configured: `@/*` maps to project root
- Images are unoptimized for static export compatibility
- ESLint and TypeScript errors ignored during builds for rapid iteration
- CSS variables used for theming consistency