# HomeCareMatch AI Rules & Tech Stack

This document outlines the technical standards and architectural guidelines for the HomeCareMatch application.

## Tech Stack
- **Vite**: Ultra-fast build tool and development server.
- **React 18 & TypeScript**: Core framework for building a type-safe and performant UI.
- **Tailwind CSS**: Primary styling method using utility-first classes.
- **shadcn/ui**: Accessible, high-quality UI components built on top of Radix UI.
- **React Router DOM**: Client-side routing management (configured in `src/App.tsx`).
- **TanStack Query (React Query)**: Data fetching, caching, and server-state management.
- **Lucide React**: The standard library for consistent, modern iconography.
- **Sonner & Radix Toast**: User feedback systems for notifications and alerts.
- **React Hook Form & Zod**: Schema-based form handling and validation.

## Development Rules

### 1. UI Components
- **Preference**: Always check `src/components/ui/` first. Use existing shadcn/ui components.
- **Extension**: If a specific UI pattern is not met by base components, create a new component in `src/components/` that composes existing UI primitives.
- **Consistency**: Maintain the "Clinical Tech" design system defined in `src/index.css`.

### 2. Styling
- **Utility-First**: Use Tailwind CSS classes exclusively.
- **Responsiveness**: All designs must be mobile-first and fully responsive using Tailwind breakpoint prefixes (`sm:`, `md:`, `lg:`, `xl:`).
- **Theme**: Use custom CSS variables defined in `src/index.css` (for example, `text-primary`, `bg-success`).

### 3. Iconography
- **Library**: Use `lucide-react` for all icons.
- **Sizing**: Use standard sizes (usually `h-4 w-4` or `h-5 w-5`) to maintain visual balance.

### 4. Data & State
- **Server State**: Use `useQuery` and `useMutation` from TanStack Query for API interactions.
- **Form State**: Use `react-hook-form` for complex forms.
- **Local State**: Use React `useState` or `useContext` for UI-only state.

### 5. Routing
- **Centralization**: Keep route definitions in `src/App.tsx`.
- **Navigation**: Use the custom `NavLink` component or `Link` from `react-router-dom`.

### 6. Project Structure
- **Pages**: Functional views go in `src/pages/`.
- **Components**: Reusable blocks go in `src/components/`.
- **Layout**: Navigation/footer wrappers go in `src/components/layout/`.
- **Hooks**: Custom logic goes in `src/hooks/`.

### 7. Code Quality
- **TypeScript**: Avoid `any`; define interfaces for component props when possible.
- **Naming**: Use PascalCase for components and camelCase for variables/functions.
- **Errors**: Do not swallow errors; bubble them up or use toasts to inform the user.

### 8. AI Agent Change Rules
- AI agents must not remove implemented features unless explicitly requested.
- On requested changes, agents must alter only what was requested.
- Keep responses objective and execution-focused.
- Report completion clearly; if errors occur, report them with details.

### 9. Build Version Policy
- The footer build version (`Build vX.Y.Z`) is defined in `src/components/layout/AppVersion.tsx`.
- This version must be incremented on every local build execution.
- In CI/deploy (`CI=true`), bump is skipped by default to avoid double increment between local and deploy builds.
- To force CI bump, set `HCM_BUMP_IN_CI=1`.
- Do not rely on manual version updates.
- Build commands must run the automatic bump script before compiling.

