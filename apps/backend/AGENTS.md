# AGENTS.md - TypeScript Coding Guidelines for AI Agents

## Purpose

This document defines strict TypeScript coding standards for AI coding assistants (Claude, Copilot, Cursor, etc.) working in this codebase. Follow these guidelines without exception.

---

## Core Principles

1. **Absolute type safety** - No `any`, no `unknown`, no escape hatches
2. **Minimal type assertions** - Avoid `as` except specific whitelisted cases
3. **Explicit over implicit** - All types must be clearly defined
4. **Immutability by default** - Use `const`, spreads, functional patterns
5. **Query builder only** - No raw SQL, no relational queries
6. **Result types for errors** - Never throw from business logic

---

## 1. Type Safety Rules

### 1.1 Forbidden Types

**❌ NEVER use `any`**
```typescript
// ❌ NEVER
function process(data: any) { }
const result: any = fetchData();

// ✅ CORRECT - Use specific types
function process(data: string) { }
const result: UserData = fetchData();
```

**❌ NEVER use `unknown`**
```typescript
// ❌ NEVER
function handle(data: unknown) { }

// ✅ CORRECT - Validate with Zod at boundary
const DataSchema = z.object({ id: z.string(), name: z.string() });
type Data = z.infer<typeof DataSchema>;
function handle(data: Data) { }

// ✅ CORRECT - Union of possible types
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
function handle(data: JsonValue) { }

// ✅ CORRECT - Generic with constraint
function handle<T extends Record<string, string>>(data: T) { }
```

### 1.2 Type Definitions

**✅ Use `type` instead of `interface`**
```typescript
// ✅ CORRECT
type User = {
  id: string;
  email: string;
  name: string | null;
};

type WithDb<T> = T & { db: DbConnection };

// ❌ AVOID
interface User {
  id: string;
  email: string;
}
```

### 1.3 Const Assertions

**✅ Use `as const` for object and array literals**
```typescript
// ✅ CORRECT - Object constants
export const ErrorCodes = {
  INVALID_API_KEY: "INVALID_API_KEY",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  FORM_NOT_FOUND: "FORM_NOT_FOUND",
} as const;

export type ErrorCodes = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ✅ CORRECT - Array constants
export const ALLOWED_ROLES = ["applicant", "admin", "developer"] as const;
export type UserRole = (typeof ALLOWED_ROLES)[number];

// ✅ CORRECT - Return type assertions
return { ok: false, errorCode: ErrorCodes.USER_NOT_FOUND, error: "User not found" } as const;
```

### 1.4 Discriminated Unions

**✅ Use discriminated unions for result types**
```typescript
// ✅ CORRECT - Result type pattern
type Result<T> = 
  | { ok: true; data: T }
  | { ok: false; errorCode: ErrorCodes; error: string };

// Usage
function getUser(id: string): Result<User> {
  if (!user) {
    return { ok: false, errorCode: ErrorCodes.USER_NOT_FOUND, error: "Not found" } as const;
  }
  return { ok: true, data: user } as const;
}

// Type narrowing
const result = getUser("123");
if (!result.ok) {
  return result; // Error case
}
// TypeScript knows result.data exists here
const user = result.data;
```

**✅ Zod discriminated unions**
```typescript
// ✅ CORRECT
const FileDetailsSchema = z.discriminatedUnion("uploadType", [
  z.object({ uploadType: z.literal("single"), url: z.string() }),
  z.object({ uploadType: z.literal("multipart"), uploadId: z.string(), parts: z.number() }),
]);

type FileDetails = z.infer<typeof FileDetailsSchema>;
```

### 1.5 Type Guards

**✅ Use type predicates for narrowing**
```typescript
// ✅ CORRECT - Type guard function
export function isValidRole(role: string): role is UserRole {
  return ALLOWED_ROLES.includes(role as UserRole);
}

// Usage
if (isValidRole(input)) {
  // TypeScript knows input is UserRole here
}
```

### 1.6 Type Assertion Whitelist

**Only these uses of `as` are permitted:**
- ✅ Const assertions: `as const`
- ✅ After JSON parsing with immediate Zod validation
- ✅ Extending Error types: `error as Error & { detail?: string }`
- ✅ Buffer/crypto type coercion: `data as BufferSource`

```typescript
// ✅ CORRECT - JSON parsing with validation
const parsed = JSON.parse(input);
const validated = DataSchema.parse(parsed); // Throws if invalid

// ❌ NEVER - Arbitrary type assertion
const value = input as string; // NO!
```

---

## 2. Drizzle ORM Patterns

### 2.1 Query Builder Rules

**✅ ONLY use query builder API**
- ❌ **NEVER** use `sql` template tag for queries
- ❌ **NEVER** use `.query` relational API
- ❌ **NEVER** use raw SQL queries
- ✅ **ALWAYS** specify columns explicitly

### 2.2 SELECT Patterns

```typescript
// ✅ CORRECT - Explicit column selection
const users = await db
  .select({
    id: UserTable.id,
    email: UserTable.email,
    name: UserTable.name,
  })
  .from(UserTable)
  .where(eq(UserTable.id, id));

// ✅ CORRECT - Reusable selection objects
export const UserSelectInfo = {
  basic: { id: UserTable.id },
  info: { id: UserTable.id, email: UserTable.email, name: UserTable.name },
};

const user = await db.select(UserSelectInfo.info).from(UserTable);

// ❌ NEVER - Wildcard select
const users = await db.select().from(UserTable);

// ❌ NEVER - Raw SQL
const users = await db.execute(sql`SELECT * FROM users`);

// ❌ NEVER - Relational query
const users = await db.query.users.findMany({ with: { posts: true } });
```

### 2.3 INSERT Patterns

```typescript
// ✅ CORRECT - Always use .returning()
const newUser = await db
  .insert(UserTable)
  .values({ email, name })
  .returning({ id: UserTable.id });

// ✅ CORRECT - Conflict resolution
await db
  .insert(UserTable)
  .values({ email })
  .onConflictDoUpdate({
    target: UserTable.email,
    targetWhere: eq(UserTable.isActive, true),
    set: { updatedAt: new Date() },
  })
  .returning(UserSelectInfo.info);

// ✅ CORRECT - Bulk insert
await db.insert(AnswerTable).values(answerValues);
```

### 2.4 UPDATE Patterns

```typescript
// ✅ CORRECT - Soft delete (update isActive)
await db
  .update(UserTable)
  .set({ isActive: false, updatedAt: new Date() })
  .where(eq(UserTable.id, userId));

// ✅ CORRECT - Update with explicit where
await db
  .update(UserTable)
  .set({ name, updatedAt: new Date() })
  .where(eq(UserTable.id, userId))
  .returning({ id: UserTable.id });

// ❌ NEVER - Hard delete
await db.delete(UserTable).where(eq(UserTable.id, userId)); // NO!
```

### 2.5 JOIN Patterns

```typescript
// ✅ CORRECT - Only innerJoin
const roles = await db
  .select({ roleId: UserRoleTable.roleId, roleName: RoleTable.name })
  .from(UserRoleTable)
  .innerJoin(RoleTable, eq(UserRoleTable.roleId, RoleTable.id))
  .where(eq(UserRoleTable.userId, userId));

// ❌ NEVER - Left/right/full joins
await db.leftJoin(...); // NO!
```

### 2.6 Condition Operators

```typescript
import { eq, and, gte, desc, inArray, ne } from "drizzle-orm";

// ✅ CORRECT - Explicit operators
.where(eq(UserTable.email, email))
.where(and(eq(UserTable.id, id), eq(UserTable.isActive, true)))
.where(gte(FormTable.endDate, new Date()))
.where(inArray(FileTable.id, fileIds))
.orderBy(desc(UserTable.createdAt))
```

### 2.7 Transaction Patterns

```typescript
// ✅ CORRECT - Accept union type for transaction support
export async function createUser({ db }: WithDb<{ email: string }>) {
  // db can be DbConnection | DbTransaction
}

export type WithDb<T> = T & { db: DbConnection | DbTransaction };

// ✅ CORRECT - Transaction usage
const result = await db.transaction(
  async (tx) => {
    const user = await createUser({ db: tx, email });
    await assignRole({ db: tx, userId: user.id });
    return user;
  },
  { isolationLevel: "serializable" }
);
```

### 2.8 Schema Patterns

```typescript
// ✅ CORRECT - Common columns
export const CommonRows = {
  isActive: boolean().notNull().default(true),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
};

// ✅ CORRECT - UUID primary key
id: text().primaryKey().$defaultFn(() => crypto.randomUUID())

// ✅ CORRECT - Foreign key
userId: text().notNull().references(() => UserTable.id, { onDelete: "cascade" })

// ✅ CORRECT - JSONB with type
details: jsonb().$type<FileUploadDetails>().notNull()

// ✅ CORRECT - Partial unique index (ONLY allowed sql usage)
uniqueIndex("user_email_key").on(t.email).where(sql`${t.isActive}`)
```

---

## 3. Function Design

### 3.1 Parameter Patterns

```typescript
// ✅ CORRECT - Destructured parameters with explicit types
export async function getUser({ db, id }: WithDb<{ id: string }>) {
  // Implementation
}

// ✅ CORRECT - Composed types
export type WithEnv<T> = T & { env: Env };
export type WithDb<T> = T & { db: DbConnection | DbTransaction };
export type WithDbAndEnv<T> = WithDb<WithEnv<T>>;

export async function createUser({ db, env, email }: WithDbAndEnv<{ email: string }>) {
  // Implementation
}
```

### 3.2 Return Types

```typescript
// ✅ CORRECT - Explicit return type for public APIs
export async function getUser({ db, id }: WithDb<{ id: string }>): Promise<User | null> {
  const users = await db.select(UserSelectInfo.info).from(UserTable).where(eq(UserTable.id, id));
  return users.length > 0 ? users[0] : null;
}

// ✅ CORRECT - Result type pattern
type UserResult = 
  | { ok: true; user: User }
  | { ok: false; errorCode: ErrorCodes; error: string };

export async function getUser({ db, id }: WithDb<{ id: string }>): Promise<UserResult> {
  const users = await db.select(UserSelectInfo.info).from(UserTable).where(eq(UserTable.id, id));
  if (users.length === 0) {
    return { ok: false, errorCode: ErrorCodes.USER_NOT_FOUND, error: "User not found" } as const;
  }
  return { ok: true, user: users[0] } as const;
}
```

### 3.3 Error Handling

```typescript
// ✅ CORRECT - Result type, never throw from business logic
export async function submitApplication({ db, applicationId }: WithDb<{ applicationId: string }>) {
  const apps = await db.select({ id: ApplicationTable.id }).from(ApplicationTable).where(eq(ApplicationTable.id, applicationId));
  
  if (apps.length === 0) {
    return { ok: false, errorCode: ErrorCodes.APPLICATION_NOT_FOUND, error: "Application not found" } as const;
  }
  
  // ... business logic
  
  return { ok: true, data: { applicationId } } as const;
}

// ✅ CORRECT - Propagate errors
const userRes = await getUserFromApiKey({ apiKey, db, env });
if (!userRes.ok) {
  return userRes; // Propagate error
}
const user = userRes.user; // Type narrowed

// ❌ NEVER - Throw from business logic
if (!user) throw new Error("User not found"); // NO!
```

### 3.4 Async/Await

```typescript
// ✅ CORRECT - Always use async/await
export async function createUser({ db, email }: WithDb<{ email: string }>) {
  const existing = await getUser({ db, email });
  if (existing) {
    return { ok: false, errorCode: ErrorCodes.USER_EXISTS, error: "User exists" } as const;
  }
  const newUser = await db.insert(UserTable).values({ email }).returning({ id: UserTable.id });
  return { ok: true, user: newUser[0] } as const;
}

// ✅ CORRECT - Parallel operations
await Promise.all([
  createUser({ db, email: "a@example.com" }),
  createUser({ db, email: "b@example.com" }),
]);

// ❌ NEVER - Promise chains
fetchData().then(x => process(x)).then(y => save(y)); // NO!
```

---

## 4. Null Safety

```typescript
// ✅ CORRECT - Explicit null checks
if (user === null) {
  return { ok: false, errorCode: ErrorCodes.USER_NOT_FOUND, error: "Not found" } as const;
}

// ✅ CORRECT - Array length check
if (users.length === 0) {
  return null;
}

// ✅ CORRECT - Optional chaining
const userName = user?.name;

// ✅ CORRECT - Nullish coalescing
const displayName = user.name ?? "Anonymous";

// ✅ CORRECT - Nullable types explicit
type User = {
  id: string;
  name: string | null; // Explicit null
};
```

---

## 5. Immutability

```typescript
// ✅ CORRECT - Always const
const user = await getUser({ db, id });
const result = processData(input);

// ✅ CORRECT - Spread for updates
const updated = { ...user, name: "New Name" };
const newArray = [...items, newItem];

// ✅ CORRECT - Functional array methods
const ids = users.map(u => u.id);
const active = users.filter(u => u.isActive);

// ❌ AVOID - Mutation (only when absolutely necessary)
user.name = "New Name"; // Avoid
items.push(newItem); // Avoid
```

---

## 6. Code Organization

### 6.1 Import Ordering

```typescript
// 1. External core libraries
import { z } from "zod";
import { eq, and } from "drizzle-orm";

// 2. Framework libraries
import { Context } from "hono";

// 3. Internal utilities/types
import { WithDb, WithDbAndEnv } from "../../utils/commonTypes";
import { ErrorCodes } from "../../utils/error";

// 4. Feature modules
import { getUserFromApiKey } from "../../features/auth/auth";

// 5. Schemas
import { UserTable, ApplicationTable } from "../db/schema";
```

### 6.2 Export Patterns

```typescript
// ✅ CORRECT - Named exports only
export async function getUser() { }
export async function createUser() { }
export type User = { id: string };
export const UserSchema = z.object({ id: z.string() });

// ❌ NEVER - Default exports
export default function getUser() { } // NO!
```

---

## 7. Zod Integration

```typescript
// ✅ CORRECT - Define schema, infer type
const UserSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  name: z.string().min(1).max(255).trim(),
});

type User = z.infer<typeof UserSchema>;

// ✅ CORRECT - Validate at boundaries
const validation = UserSchema.safeParse(input);
if (!validation.success) {
  return { ok: false, errorCode: ErrorCodes.INVALID_INPUT, error: validation.error.message } as const;
}
const validated = validation.data; // Type: User

// ✅ CORRECT - Use validated data
function createUser({ db, data }: WithDb<{ data: User }>) {
  // data is validated User type, not unknown
}
```

---

## 8. Anti-Patterns Summary

### ❌ NEVER DO:

1. **Use `any` or `unknown` types**
2. **Use raw SQL queries or relational queries**
3. **Use `as` type assertions (except whitelist)**
4. **Use wildcard SELECT in queries**
5. **Hard delete database records**
6. **Throw errors from business logic**
7. **Use `.then()` promise chains**
8. **Use `interface` instead of `type`**
9. **Use default exports**
10. **Mutate objects/arrays (avoid when possible)**
11. **Use `var` or unnecessary `let`**
12. **Skip explicit type annotations for function parameters**

---

## 9. Quick Reference Checklist

Before committing code, verify:

- [ ] No `any` types
- [ ] No `unknown` types  
- [ ] No raw SQL or relational queries
- [ ] All SELECT statements have explicit columns
- [ ] All function parameters explicitly typed
- [ ] Public functions have explicit return types
- [ ] Result types use discriminated unions
- [ ] Error codes are centralized constants with `as const`
- [ ] Null/undefined handled explicitly
- [ ] Using `const` instead of `let`
- [ ] Objects updated immutably
- [ ] Imports properly ordered
- [ ] Named exports only
- [ ] External data validated with Zod
- [ ] Database operations use query builder only
- [ ] Soft deletes instead of hard deletes

---

## 10. Code Templates

### Result Type Pattern
```typescript
type Result<T> = 
  | { ok: true; data: T }
  | { ok: false; errorCode: ErrorCodes; error: string };

export async function doSomething({ db, id }: WithDb<{ id: string }>): Promise<Result<Data>> {
  const records = await db.select({ id: Table.id }).from(Table).where(eq(Table.id, id));
  if (records.length === 0) {
    return { ok: false, errorCode: ErrorCodes.NOT_FOUND, error: "Not found" } as const;
  }
  return { ok: true, data: records[0] } as const;
}
```

### Validation Pattern
```typescript
const InputSchema = z.object({ email: z.string().email() });
type Input = z.infer<typeof InputSchema>;

export async function process({ db, data }: WithDb<{ data: Input }>) {
  // data is validated Input type
}

// At boundary (API endpoint)
const validation = InputSchema.safeParse(input);
if (!validation.success) {
  return { ok: false, errorCode: ErrorCodes.INVALID_INPUT, error: validation.error.message } as const;
}
await process({ db, data: validation.data });
```

### Constants Pattern
```typescript
export const ErrorCodes = {
  INVALID_INPUT: "INVALID_INPUT",
  NOT_FOUND: "NOT_FOUND",
} as const;

export type ErrorCodes = (typeof ErrorCodes)[keyof typeof ErrorCodes];
```

---

**END OF GUIDELINES**

These rules are non-negotiable. Follow them strictly to maintain codebase quality and type safety.