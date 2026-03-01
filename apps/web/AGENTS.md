# React Frontend Development Guide

> **Philosophy**: Correct first, readable second, performant third. Optimize only after measuring.

---

## Tech Stack

| Category           | Technology              | Why                                              |
| ------------------ | ----------------------- | ------------------------------------------------ |
| **Framework**      | React 19+               | Automatic memoization via React Compiler         |
| **Routing**        | React Router 7+         | SSR, loaders, actions, type-safe data loading    |
| **Build**          | Vite                    | Fastest DX, native ESM                           |
| **Language**       | TypeScript (strict)     | Catch errors at compile-time                     |
| **Styling**        | Tailwind CSS 4+         | Utility-first, zero runtime                      |
| **UI Components**  | Radix UI + shadcn/ui    | Accessible, composable primitives                |
| **Validation**     | Zod                     | Runtime + compile-time validation                |
| **Server State**   | TanStack Query          | Caching, background refetch, optimistic updates  |
| **Client State**   | Zustand                 | Minimal API, selective re-renders                |
| **Testing**        | Vitest + Playwright     | Fast unit tests, real browser E2E                |

---

## Project Structure (Feature-Based)

```
src/
├── app/                    # Application shell & routes
│   ├── routes/             # React Router route files
│   ├── root.tsx
│   └── app.css
├── features/               # Self-contained feature modules
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   ├── schemas/
│   │   └── index.ts        # Public API
│   ├── jobs/
│   └── dashboard/
├── shared/                 # Shared across features
│   ├── components/ui/      # Base primitives
│   ├── hooks/
│   ├── utils/
│   └── types/
├── core/                   # Infrastructure
│   ├── api/
│   ├── config/
│   └── providers/
└── test/
```

**Rules:**
1. **Unidirectional imports**: `shared` → `features` → `app` (never reverse)
2. **Feature isolation**: Features cannot import from other features
3. **Colocation**: Tests live next to their components

---

## Component Patterns

### Structure Template

```typescript
// 1. Imports (external → internal → types)
import { useState } from 'react';
import { Button } from '~/shared/components/ui/button';
import type { Job } from '../types';

// 2. Props interface
interface JobCardProps {
  job: Job;
  onApply: (jobId: string) => void;
  className?: string;
}

// 3. Component
export function JobCard({ job, onApply, className }: JobCardProps) {
  // Hooks first
  const [isExpanded, setIsExpanded] = useState(false);

  // Derived state (compute, don't store)
  const canApply = !job.hasApplied;

  // Handlers
  const handleApply = () => onApply(job.id);

  // Early returns
  if (!job) return null;

  // Render
  return (/* JSX */);
}
```

### Props Rules

```typescript
// ✅ Explicit interface with JSDoc
interface ButtonProps {
  /** Visual style variant */
  variant?: 'primary' | 'secondary';
  isLoading?: boolean;
}

// ✅ Discriminated unions for conditional props
type ModalProps =
  | { type: 'alert'; message: string }
  | { type: 'confirm'; message: string; onConfirm: () => void };

// ❌ Never use
interface BadProps {
  data: any;
  onClick: Function;
}
```

---

## State Management

### Hierarchy (Use simplest option)

| Priority | Type | When to Use |
|----------|------|-------------|
| 1 | Derived | Compute during render |
| 2 | Local (`useState`) | Component-specific |
| 3 | URL (`useSearchParams`) | Shareable/bookmarkable (filters, pagination) |
| 4 | Context | Dependency injection only (auth, theme, i18n) |
| 5 | TanStack Query | Server/API data |
| 6 | Zustand | Complex client state |

### Key Patterns

```typescript
// ❌ BAD: Storing derived state
const [filteredItems, setFilteredItems] = useState([]);
useEffect(() => {
  setFilteredItems(items.filter(/*...*/));
}, [items, filter]);

// ✅ GOOD: Compute during render
const filteredItems = items.filter(/*...*/);

// ✅ URL state for filters
const [searchParams, setSearchParams] = useSearchParams();
const page = Number(searchParams.get('page')) || 1;

// ✅ TanStack Query for server state
const { data, isLoading } = useQuery({
  queryKey: ['jobs', filters],
  queryFn: () => fetchJobs(filters),
});

// ✅ Zustand for client state (selective subscriptions)
const isOpen = useUIStore((s) => s.sidebarOpen); // Only re-renders when this changes
```

---

## useEffect Rules

> **Decision Framework**: Ask "Why does this code need to run?"
> - "Because the component displayed" → Maybe Effect
> - "Because user performed an action" → Event handler
> - "It's derived from props/state" → Compute during render

### When to Use useEffect

| ✅ Valid (External Systems) | ❌ Never Use For |
|----------------------------|------------------|
| Third-party library sync (maps, charts, widgets) | Derived/computed state |
| Browser APIs (title, localStorage on mount) | Transforming data for rendering |
| WebSocket/EventSource subscriptions | Responding to user events |
| Global event listeners (keydown, resize) | Chaining state updates |
| Cleanup (timers, subscriptions) | Notifying parent of state changes |
| Analytics tracking on mount | Resetting state when props change |

### You Don't Need useEffect For:

**1. Derived State** → Compute during render
```typescript
// ❌ BAD
const [fullName, setFullName] = useState('');
useEffect(() => setFullName(`${first} ${last}`), [first, last]);

// ✅ GOOD
const fullName = `${first} ${last}`;
```

**2. Expensive Calculations** → useMemo
```typescript
// ❌ BAD
const [filtered, setFiltered] = useState([]);
useEffect(() => setFiltered(expensiveFilter(items)), [items]);

// ✅ GOOD
const filtered = useMemo(() => expensiveFilter(items), [items]);
```

**3. Resetting State on Prop Change** → Use key
```typescript
// ❌ BAD
useEffect(() => setInput(''), [userId]);

// ✅ GOOD
<EditForm key={userId} userId={userId} />
```

**4. User Event Logic** → Event handlers
```typescript
// ❌ BAD
useEffect(() => { if (submitted) postData(); }, [submitted]);

// ✅ GOOD
const handleSubmit = () => postData();
```

**5. Data Fetching** → TanStack Query or loaders
```typescript
// ❌ BAD (no cleanup, race conditions)
useEffect(() => { fetch('/api').then(setData); }, []);

// ✅ GOOD
const { data } = useQuery({ queryKey: ['data'], queryFn: fetchData });
```

**6. Notifying Parent** → Call in event handler or lift state
```typescript
// ❌ BAD
useEffect(() => { onChange(value); }, [value]);

// ✅ GOOD
const handleChange = (v) => { setValue(v); onChange(v); };
```

### Valid useEffect Examples

```typescript
// ✅ Third-party library
useEffect(() => {
  const map = new MapLibrary(ref.current);
  return () => map.destroy();
}, []);

// ✅ Global event listener
useEffect(() => {
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}, [onClose]);

// ✅ Document title sync
useEffect(() => { document.title = `${count} items`; }, [count]);
```

---

## Preventing Re-renders

### Problem
Every state update re-renders the component AND all children.

### Solutions

| Solution | When to Use |
|----------|-------------|
| **Composition** | Pass children as props - they won't re-render |
| **Move state down** | Colocate state with components that use it |
| **Extract components** | Split components so state changes affect less |
| **Stable references** | Move objects/arrays outside component |
| **Zustand selectors** | Subscribe only to specific state slices |

```typescript
// ✅ Composition: children don't re-render
function Parent({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  return <div><button>{count}</button>{children}</div>;
}
<Parent><ExpensiveComponent /></Parent>

// ✅ Stable references (move outside component)
const style = { color: 'red' };
const items = [1, 2, 3];
function Component() {
  return <Child style={style} items={items} />;
}
```

---

## React Router 7

### Route File Structure

```typescript
// app/routes/jobs.$jobId.tsx
import type { Route } from './+types/jobs.$jobId';

// Loader - data fetching
export async function loader({ params }: Route.LoaderArgs) {
  const job = await getJob(params.jobId);
  if (!job) throw data({ message: 'Not found' }, { status: 404 });
  return { job };
}

// Action - mutations
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const result = schema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    return data({ errors: result.error.flatten().fieldErrors }, { status: 400 });
  }
  await updateJob(result.data);
  return redirect('/jobs');
}

// Component
export default function JobPage({ loaderData }: Route.ComponentProps) {
  return <JobDetails job={loaderData.job} />;
}

// Error Boundary
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return isRouteErrorResponse(error)
    ? <NotFound />
    : <ErrorDisplay message="Something went wrong" />;
}
```

### Key Patterns

```typescript
// Parallel data fetching in loaders
const [job, applications] = await Promise.all([getJob(id), getApplications(id)]);

// Optimistic UI with useFetcher
const fetcher = useFetcher();
const optimisticValue = fetcher.formData?.get('value') ?? currentValue;

// Pending UI
const { state } = useNavigation();
const isPending = state !== 'idle';
```

---

## Form Validation (Zod)

```typescript
// Schema definition
export const createJobSchema = z.object({
  title: z.string().min(3).max(100),
  salary: z.object({
    min: z.coerce.number().min(0),
    max: z.coerce.number().min(0),
  }).refine(d => d.max >= d.min, { message: 'Max must be >= min', path: ['max'] }),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;

// In action
const result = createJobSchema.safeParse(data);
if (!result.success) {
  return data({ errors: result.error.flatten().fieldErrors }, { status: 400 });
}
```

---

## TypeScript

### Config (tsconfig.json)

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### Patterns

```typescript
// ✅ Discriminated unions (not optional properties)
type ApiResponse =
  | { ok: true; data: User }
  | { ok: false; error: string };

// ✅ Type guards instead of `any`
function process(data: unknown): string {
  if (typeof data === 'object' && data && 'value' in data) {
    return String(data.value);
  }
  throw new Error('Invalid');
}

// ✅ Extract types from Zod schemas
type User = z.infer<typeof userSchema>;
```

---

## Testing

### Strategy

| Type | Tool | Coverage | Focus |
|------|------|----------|-------|
| Unit | Vitest | 70% | Utils, hooks |
| Integration | Vitest + RTL | 20% | Components |
| E2E | Playwright | 10% | Critical journeys |

### Examples

```typescript
// Component test
it('calls onApply when clicked', async () => {
  const onApply = vi.fn();
  render(<JobCard job={mockJob} onApply={onApply} />);
  await userEvent.click(screen.getByRole('button', { name: /apply/i }));
  expect(onApply).toHaveBeenCalledWith(mockJob.id);
});

// E2E test
test('user can apply to job', async ({ page }) => {
  await page.goto('/jobs/123');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Application submitted')).toBeVisible();
});
```

---

## Accessibility

### Requirements (WCAG 2.2 AA)

- **Semantic HTML**: Use `<nav>`, `<main>`, `<article>`, `<button>` - not divs
- **Keyboard navigation**: All interactive elements must be keyboard accessible
- **Labels**: All form fields must have associated labels
- **Contrast**: 4.5:1 for normal text, 3:1 for large text
- **Focus management**: Trap focus in modals, return focus on close

```typescript
// Accessible form field
<label htmlFor={id}>{label}</label>
<input
  id={id}
  aria-invalid={!!error}
  aria-describedby={error ? `${id}-error` : undefined}
/>
{error && <p id={`${id}-error`} role="alert">{error}</p>}
```

---

## Error Handling

```typescript
// Granular error boundaries
<ErrorBoundary fallback={<AppCrash />}>
  <ErrorBoundary fallback={<SidebarError />}>
    <Sidebar />
  </ErrorBoundary>
  <ErrorBoundary fallback={<ContentError />}>
    <Content />
  </ErrorBoundary>
</ErrorBoundary>

// User feedback with toast
toast.promise(saveJob(data), {
  loading: 'Saving...',
  success: 'Saved!',
  error: (e) => e.message,
});
```

---

## Code Quality Checklist

### Before Every PR

- [ ] No `any` types
- [ ] No type assertions (`as`) without justification
- [ ] State is as local as possible
- [ ] No objects/arrays created in render
- [ ] Semantic HTML used
- [ ] Form fields have labels
- [ ] Error states handled
- [ ] Loading states shown

---

## Prohibited Patterns

| Pattern | Do This Instead |
|---------|-----------------|
| `any` type | Proper types + type guards |
| `as` assertions | Proper types |
| Index as key | Unique IDs |
| Inline `style={{}}` | Tailwind or constants |
| `useEffect` for derived state | Compute during render |
| `useEffect` for data fetching | TanStack Query or loaders |
| `useEffect` to reset state on prop change | Use `key` prop to remount |
| `useEffect` chains (effect sets state → triggers another effect) | Restructure logic or use event handlers |
| `fetch` in useEffect without cleanup | TanStack Query or AbortController |
| Prop drilling > 2 levels | Context or composition |
| `console.log` in production | Logging service |
| `// @ts-ignore` | Fix the type error |
| `setInterval` without cleanup | Always return cleanup function |
| Direct DOM manipulation | Use refs or React state |

---

## Sources

- [React 19 Best Practices](https://medium.com/@CodersWorld99/react-19-typescript-best-practices-the-new-rules-every-developer-must-follow-in-2025-3a74f63a0baf)
- [React Router 7 Docs](https://reactrouter.com/)
- [Bulletproof React](https://github.com/alan2207/bulletproof-react)
- [React State Management 2025](https://www.developerway.com/posts/react-state-management-2025)
- [TkDodo's Zustand Guide](https://tkdodo.eu/blog/zustand-and-react-context)