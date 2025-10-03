---
inclusion: always
---
# Project Structure

ActionLoom follows Next.js App Router conventions with a clear separation of concerns.

## Directory Organization

```
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   └── workflow/      # Workflow-related endpoints
│   ├── builder/           # Workflow builder page
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── *.tsx             # Feature components
├── lib/                  # Utility libraries
├── hooks/                # Custom React hooks
├── public/               # Static assets
└── styles/               # Additional stylesheets
```

## Key Architectural Patterns

### Component Organization
- **Feature components**: Top-level components in `/components`
- **UI primitives**: Reusable components in `/components/ui`
- **Page components**: Route-specific components in `/app`

### API Structure
- RESTful endpoints under `/app/api`
- Workflow operations: `/api/workflow/save`, `/api/workflow/execute`
- Type-safe request/response handling with TypeScript

### State Management
- Local component state with `useState`
- Workflow state managed in `WorkflowBuilder` component
- Props drilling for simple state sharing
- No global state management library (keeps it simple)

### Type Definitions
- Centralized types in `/lib/types.ts`
- Workflow, Action, and execution result interfaces
- Consistent typing across components and API routes

## File Naming Conventions
- **Components**: kebab-case (e.g., `workflow-builder.tsx`)
- **Pages**: Next.js conventions (`page.tsx`, `layout.tsx`)
- **API routes**: `route.ts` in directory structure
- **Types**: Descriptive interfaces (e.g., `ParsedWorkflow`, `ExecutionResult`)

## Import Patterns
- Use `@/` path alias for all internal imports
- Group imports: external libraries first, then internal modules
- Consistent import order: types, components, utilities