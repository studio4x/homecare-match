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
- **Extension**: If a specific UI pattern isn't met by base components, create a new component in `src/components/` that composes existing UI primitives.
- **Consistency**: Maintain the "Clinical Tech" design system defined in `src/index.css`.

### 2. Styling
- **Utility-First**: Use Tailwind CSS classes exclusively.
- **Responsiveness**: All designs must be mobile-first and fully responsive using Tailwind's breakpoint prefixes (`sm:`, `md:`, `lg:`, `xl:`).
- **Theme**: Utilize the custom CSS variables defined in `index.css` (e.g., `text-primary`, `bg-success`).

### 3. Iconography
- **Library**: Use `lucide-react` for all icons.
- **Sizing**: Use standard sizes (usually `h-4 w-4` or `h-5 w-5`) to maintain visual balance.

### 4. Data & State
- **Server State**: Use `useQuery` and `useMutation` from TanStack Query for all API interactions.
- **Form State**: Use `react-hook-form` for complex forms to ensure performance and validation accuracy.
- **Local State**: Use standard React `useState` or `useContext` for UI-only state.

### 5. Routing
- **Centralization**: Keep all route definitions in `src/App.tsx`.
- **Navigation**: Use the custom `NavLink` component or `Link` from `react-router-dom`.

### 6. Project Structure
- **Pages**: Functional views go into `src/pages/`.
- **Components**: Reusable blocks go into `src/components/`.
- **Layout**: Navigation and footer wrappers go into `src/components/layout/`.
- **Hooks**: Custom logic goes into `src/hooks/`.

### 7. Code Quality
- **TypeScript**: No `any` types. Define interfaces for all component props.
- **Naming**: Use PascalCase for components and camelCase for variables/functions.
- **Errors**: Don't swallow errors; allow them to bubble up or use the established toast system to inform the user.

### 8. Alterações por agentes de IA
- O agente de IA NUNCA deve apagar funcionalidades já implementadas, a não ser por solicitação expressa.
- Ao inserir uma nova funcionalidade ou alterar alguma existente por solicitação expressa, o agente deve se limitar a incluir e alterar somente o que for solicitado.
- **Ao executar uma tarefa, não envie textos de diálogo; limite-se a apenas executar a tarefa.**
- **Sempre execute uma tarefa e retorne ao usuário com a mensagem de "Concluído". Se ocorrer algum erro, informe o usuário detalhadamente.**

### 9. Versão do Build
- O agente de IA DEVE sempre atualizar o número da versão do build a cada alteração realizada no app, garantindo rastreabilidade das mudanças.
- A versão atualmente é exibida em `src/components/layout/AppVersion.tsx` e deve ser incrementada a cada modificação implementada.