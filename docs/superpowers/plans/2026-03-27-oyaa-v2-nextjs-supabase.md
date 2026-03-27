# Oyaa v2: Next.js + Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Oyaa from a single HTML page into a Next.js app with Supabase auth and project-based output storage.

**Architecture:** Next.js App Router with server components where possible, Supabase for auth (email/password) and Postgres for data (projects + outputs tables). The existing anonymization layer, prompts, and Anthropic integration move into a Next.js API route. Styling uses Tailwind CSS with the existing Oyaa design tokens.

**Tech Stack:** Next.js 14 (App Router), Supabase (Auth + Postgres, Frankfurt), Tailwind CSS, @anthropic-ai/sdk, marked, jspdf, docx, pdfjs-dist, mammoth

---

## File Structure

```
oyaa/
├── app/
│   ├── layout.jsx              # Root layout: fonts, global styles, footer
│   ├── globals.css             # Tailwind + Oyaa design tokens
│   ├── login/
│   │   └── page.jsx            # Login/register page
│   ├── projects/
│   │   ├── page.jsx            # Project overview (list + create)
│   │   └── [id]/
│   │       └── page.jsx        # Project detail: outputs + new processing
│   ├── privacy/
│   │   └── page.jsx            # Privacy page (content from privacy.html)
│   └── api/
│       └── chat/
│           └── route.js        # Anthropic API route (from api/chat.js)
├── components/
│   ├── Header.jsx              # Top nav with logo + logout
│   ├── Footer.jsx              # Footer with privacy link
│   ├── TranscriptForm.jsx      # Textarea + file drop + output type buttons + generate
│   ├── OutputCard.jsx          # Rendered output with copy/PDF/Word export
│   ├── ProjectCard.jsx         # Single project in the overview list
│   └── AuthForm.jsx            # Login/register form
├── lib/
│   ├── anonymize.js            # Existing anonymization (convert to ESM)
│   ├── supabase-server.js      # Supabase server client helper
│   ├── supabase-browser.js     # Supabase browser client helper
│   └── prompts.js              # The six prompt templates (extract from api/chat.js)
├── middleware.js                # Auth redirect: unauthenticated → /login
├── tailwind.config.js
├── next.config.js
├── package.json
└── .env.local                  # ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

### Task 1: Initialize Next.js project and configure Tailwind with Oyaa tokens

**Files:**
- Create: `package.json` (overwrite existing)
- Create: `next.config.js`
- Create: `tailwind.config.js`
- Create: `app/globals.css`
- Create: `app/layout.jsx`
- Create: `app/page.jsx` (temporary redirect)
- Create: `.env.local`
- Delete: `index.html`, `privacy.html` (content moves to components)

- [ ] **Step 1: Initialize Next.js project**

Run from the oyaa directory:
```bash
npx create-next-app@latest . --js --app --tailwind --eslint --no-src-dir --import-alias "@/*" --use-npm
```

If it asks to overwrite, confirm yes. This scaffolds the project.

- [ ] **Step 2: Install dependencies**

```bash
npm install @anthropic-ai/sdk @supabase/supabase-js @supabase/ssr marked jspdf docx pdfjs-dist mammoth
```

- [ ] **Step 3: Configure Tailwind with Oyaa design tokens**

Replace `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        orange: {
          DEFAULT: '#FF4800',
          hover: '#E03E00',
          light: '#FFF0EB',
          mid: '#FFD6C4',
        },
        hero: '#FFF4F0',
        text: {
          DEFAULT: '#1F1F1F',
          sec: '#6B7280',
          muted: '#9CA3AF',
        },
        border: {
          DEFAULT: '#E5E7EB',
          focus: '#FF4800',
        },
      },
      fontFamily: {
        lexend: ['Lexend', 'sans-serif'],
        inter: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        md: '0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 4: Set up globals.css**

Replace `app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Lexend:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap');

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 5: Create root layout**

Create `app/layout.jsx`:

```jsx
import './globals.css';

export const metadata = {
  title: 'Oyaa.',
  description: 'Van gesprek naar geregeld, in minuten.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="nl">
      <body className="bg-white text-text min-h-screen">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Create temporary home page**

Create `app/page.jsx`:

```jsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/login');
}
```

- [ ] **Step 7: Create .env.local**

Create `.env.local`:

```
ANTHROPIC_API_KEY=your_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

- [ ] **Step 8: Verify the app starts**

```bash
npm run dev
```

Expected: App starts on localhost:3000, redirects to /login (404 for now is fine).

- [ ] **Step 9: Delete old files**

```bash
rm index.html privacy.html
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js project with Tailwind and Oyaa design tokens"
```

---

### Task 2: Set up Supabase auth helpers and middleware

**Files:**
- Create: `lib/supabase-server.js`
- Create: `lib/supabase-browser.js`
- Create: `middleware.js`

- [ ] **Step 1: Create browser Supabase client**

Create `lib/supabase-browser.js`:

```js
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
```

- [ ] **Step 2: Create server Supabase client**

Create `lib/supabase-server.js`:

```js
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from Server Component — ignore
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create auth middleware**

Create `middleware.js`:

```js
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthPage = request.nextUrl.pathname === '/login';
  const isPrivacyPage = request.nextUrl.pathname === '/privacy';
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');

  // Allow privacy page and API routes without auth
  if (isPrivacyPage || isApiRoute) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users to login
  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/projects';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 4: Commit**

```bash
git add lib/supabase-server.js lib/supabase-browser.js middleware.js
git commit -m "feat: add Supabase auth helpers and auth middleware"
```

---

### Task 3: Create Supabase database tables

**Files:**
- Create: `supabase/migrations/001_create_tables.sql` (reference file, applied via Supabase dashboard)

- [ ] **Step 1: Create the migration SQL file**

Create `supabase/migrations/001_create_tables.sql`:

```sql
-- Projects table
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  client_name text,
  created_at timestamp with time zone default now() not null
);

-- Enable RLS
alter table public.projects enable row level security;

-- Users can only see their own projects
create policy "Users can view own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can insert own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- Outputs table
create table public.outputs (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  output_type text not null,
  input_transcript text not null,
  result text not null,
  created_at timestamp with time zone default now() not null
);

-- Enable RLS
alter table public.outputs enable row level security;

-- Users can only see outputs of their own projects
create policy "Users can view own outputs"
  on public.outputs for select
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

create policy "Users can insert outputs to own projects"
  on public.outputs for insert
  with check (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply the migration**

Go to the Supabase dashboard → SQL Editor → paste and run the SQL above.

Alternatively, if using Supabase CLI:
```bash
npx supabase db push
```

- [ ] **Step 3: Verify tables exist**

In Supabase dashboard → Table Editor, confirm `projects` and `outputs` tables exist with RLS enabled.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add database migration for projects and outputs tables"
```

---

### Task 4: Build login page

**Files:**
- Create: `app/login/page.jsx`
- Create: `components/AuthForm.jsx`

- [ ] **Step 1: Create AuthForm component**

Create `components/AuthForm.jsx`:

```jsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';

export default function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = isRegister
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.push('/projects');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
          E-mailadres
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border-[1.5px] border-border rounded-lg px-4 py-3 font-inter text-sm text-text outline-none transition-all focus:border-orange focus:shadow-[0_0_0_3px_rgba(255,72,0,0.1)]"
          placeholder="naam@bureau.nl"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
          Wachtwoord
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full border-[1.5px] border-border rounded-lg px-4 py-3 font-inter text-sm text-text outline-none transition-all focus:border-orange focus:shadow-[0_0_0_3px_rgba(255,72,0,0.1)]"
          placeholder="Minimaal 6 tekens"
        />
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full h-12 bg-orange text-white rounded-lg font-inter text-sm font-semibold transition-all hover:bg-orange-hover shadow-[0_2px_8px_rgba(255,72,0,0.32)] hover:shadow-[0_4px_14px_rgba(255,72,0,0.38)] disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed"
      >
        {loading ? 'Even geduld...' : isRegister ? 'Account aanmaken' : 'Inloggen'}
      </button>

      <p className="text-center text-sm text-text-sec">
        {isRegister ? 'Al een account?' : 'Nog geen account?'}{' '}
        <button
          type="button"
          onClick={() => { setIsRegister(!isRegister); setError(null); }}
          className="text-orange font-medium hover:underline"
        >
          {isRegister ? 'Inloggen' : 'Registreren'}
        </button>
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Create login page**

Create `app/login/page.jsx`:

```jsx
import AuthForm from '@/components/AuthForm';

export const metadata = {
  title: 'Inloggen — Oyaa.',
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-hero px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <h1 className="font-lexend text-5xl font-bold text-text">
            Oyaa<span className="text-orange">.</span>
          </h1>
          <p className="text-text-sec text-base mt-3">
            Van gesprek naar geregeld, in minuten.
          </p>
        </div>
        <AuthForm />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify login page renders**

```bash
npm run dev
```

Open `localhost:3000/login`. Expected: login form with Oyaa branding. Form won't work yet without Supabase credentials in `.env.local`.

- [ ] **Step 4: Commit**

```bash
git add app/login/page.jsx components/AuthForm.jsx
git commit -m "feat: add login/register page with Supabase auth"
```

---

### Task 5: Build shared layout components (Header + Footer)

**Files:**
- Create: `components/Header.jsx`
- Create: `components/Footer.jsx`
- Modify: `app/layout.jsx`

- [ ] **Step 1: Create Header component**

Create `components/Header.jsx`:

```jsx
'use client';

import { createClient } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';

export default function Header() {
  const supabase = createClient();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="border-b border-border bg-white">
      <div className="max-w-[800px] mx-auto px-8 h-14 flex items-center justify-between">
        <a href="/projects" className="font-lexend text-xl font-bold text-text">
          Oyaa<span className="text-orange">.</span>
        </a>
        <button
          onClick={handleLogout}
          className="text-sm text-text-muted hover:text-text transition-colors"
        >
          Uitloggen
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create Footer component**

Create `components/Footer.jsx`:

```jsx
export default function Footer() {
  return (
    <footer className="bg-[#1F1F1F] text-white/55 py-7 text-[13px]">
      <div className="max-w-[800px] mx-auto px-8 flex justify-between items-center gap-4 flex-wrap">
        <span>&copy; 2026 <strong className="text-white font-medium">Oyaa</strong> — Made for agency people</span>
        <a href="/privacy" className="text-white/40 no-underline hover:text-white/70 transition-colors">
          Privacy &amp; data
        </a>
        <span className="text-white/30 tracking-wide">oyaa.nl</span>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Update root layout to include Header and Footer for authenticated pages**

Replace `app/layout.jsx`:

```jsx
import './globals.css';

export const metadata = {
  title: 'Oyaa.',
  description: 'Van gesprek naar geregeld, in minuten.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="nl">
      <body className="bg-white text-text min-h-screen flex flex-col">
        <div className="flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Create a layout for authenticated pages**

Create `app/(authenticated)/layout.jsx`:

```jsx
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function AuthenticatedLayout({ children }) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 5: Move projects route into authenticated group**

Move `app/projects/` into `app/(authenticated)/projects/`. The route stays `/projects` but now uses the authenticated layout.

```bash
mkdir -p app/\(authenticated\)/projects
```

- [ ] **Step 6: Commit**

```bash
git add components/Header.jsx components/Footer.jsx app/layout.jsx "app/(authenticated)/layout.jsx"
git commit -m "feat: add Header, Footer and authenticated layout"
```

---

### Task 6: Build projects overview page

**Files:**
- Create: `app/(authenticated)/projects/page.jsx`
- Create: `components/ProjectCard.jsx`

- [ ] **Step 1: Create ProjectCard component**

Create `components/ProjectCard.jsx`:

```jsx
import Link from 'next/link';

export default function ProjectCard({ project }) {
  const date = new Date(project.created_at).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block border border-border rounded-xl p-6 shadow-sm hover:border-orange hover:shadow-md transition-all group"
    >
      <h3 className="font-lexend text-base font-semibold text-text group-hover:text-orange transition-colors">
        {project.name}
      </h3>
      {project.client_name && (
        <p className="text-sm text-text-sec mt-1">{project.client_name}</p>
      )}
      <p className="text-xs text-text-muted mt-3">{date}</p>
    </Link>
  );
}
```

- [ ] **Step 2: Create projects overview page**

Create `app/(authenticated)/projects/page.jsx`:

```jsx
import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import ProjectCard from '@/components/ProjectCard';
import NewProjectForm from '@/components/NewProjectForm';

export const metadata = {
  title: 'Projecten — Oyaa.',
};

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-[800px] mx-auto px-8 py-14">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-lexend text-3xl font-bold text-text">Projecten</h1>
          <p className="text-text-sec mt-1">Kies een project of maak een nieuw project aan.</p>
        </div>
      </div>

      <NewProjectForm />

      {projects && projects.length > 0 ? (
        <div className="grid gap-3 mt-8">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <p className="text-text-muted text-sm mt-8">
          Je hebt nog geen projecten. Maak er een aan om te beginnen.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create NewProjectForm component**

Create `components/NewProjectForm.jsx`:

```jsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';

export default function NewProjectForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('projects').insert({
      name: name.trim(),
      client_name: clientName.trim() || null,
      user_id: user.id,
    });

    setName('');
    setClientName('');
    setOpen(false);
    setLoading(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="h-12 px-6 bg-orange text-white rounded-lg font-inter text-sm font-semibold transition-all hover:bg-orange-hover shadow-[0_2px_8px_rgba(255,72,0,0.32)] hover:shadow-[0_4px_14px_rgba(255,72,0,0.38)]"
      >
        + Nieuw project
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border rounded-xl p-6 space-y-4">
      <div>
        <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
          Projectnaam
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          placeholder="Bijv. Zomercampagne 2026"
          className="w-full border-[1.5px] border-border rounded-lg px-4 py-3 font-inter text-sm text-text outline-none transition-all focus:border-orange focus:shadow-[0_0_0_3px_rgba(255,72,0,0.1)]"
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
          Klant <span className="font-normal">(optioneel)</span>
        </label>
        <input
          type="text"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Bijv. Nike"
          className="w-full border-[1.5px] border-border rounded-lg px-4 py-3 font-inter text-sm text-text outline-none transition-all focus:border-orange focus:shadow-[0_0_0_3px_rgba(255,72,0,0.1)]"
        />
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="h-10 px-5 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {loading ? 'Aanmaken...' : 'Aanmaken'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-10 px-5 text-sm text-text-sec hover:text-text transition-colors"
        >
          Annuleren
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Verify projects page renders**

```bash
npm run dev
```

With valid Supabase credentials and a logged-in user, navigate to `/projects`. Expected: empty state message + "Nieuw project" button.

- [ ] **Step 5: Commit**

```bash
git add "app/(authenticated)/projects/page.jsx" components/ProjectCard.jsx components/NewProjectForm.jsx
git commit -m "feat: add projects overview page with create project form"
```

---

### Task 7: Extract prompts and convert anonymize to ESM

**Files:**
- Create: `lib/prompts.js`
- Modify: `lib/anonymize.js` (convert to ESM)

- [ ] **Step 1: Create prompts module**

Create `lib/prompts.js`:

```js
export const OUTPUT_TITLES = {
  'summary-actions': 'Samenvatting met actiepunten',
  'internal-briefing': 'Interne briefing',
  'external-debrief': 'Externe debrief naar klant',
  'internal-actions': 'Actiepunten intern',
  'external-actions': 'Actiepunten extern',
  'project-planning': 'Projectplanning aanzet',
};

export const PROMPTS = {
  'summary-actions': (transcript) =>
    `Je bent een ervaren accountmanager bij een reclamebureau. Maak op basis van het onderstaande transcript een heldere samenvatting van het gesprek, gevolgd door alle actiepunten.

Gebruik deze structuur:

**Samenvatting** — wat is er besproken in 5-8 zinnen?

**Actiepunten** — genummerde lijst met per punt: de actie, de eigenaar (indien genoemd), en de deadline (indien genoemd). Als eigenaar of deadline niet vermeld is, schrijf dan "Niet besproken."

Transcript:
${transcript}

Schrijf in professioneel Nederlands.`,

  'internal-briefing': (transcript) =>
    `Je bent een ervaren accountmanager bij een reclamebureau. Maak op basis van het onderstaande transcript een heldere interne briefing voor het creatieve team.

Gebruik exact de volgende structuur en koppen:

**Achtergrond** — Wie is de klant, wat is de context, wat speelt er?
**Doel/doelstellingen** — Wat wil de klant bereiken? Wat is het meetbare resultaat?
**Strategie/inzichten** — Wat zijn relevante inzichten uit het gesprek? Wat zegt de klant tussen de regels door?
**Projectstatus** — Waar staan we nu? Wat is er al gedaan?
**Deadlines** — Welke concrete data zijn er genoemd?
**Concrete afspraken** — Wat is er exact afgesproken?
**Planning** — Wat zijn de volgende stappen en wanneer?
**Oplevering met specs** — Wat wordt er opgeleverd, in welk format, voor welk kanaal?

Als informatie voor een sectie niet in het transcript staat, schrijf dan: "Niet besproken."

Transcript:
${transcript}

Schrijf de briefing in professioneel Nederlands. Wees concreet en bondig.`,

  'external-debrief': (transcript) =>
    `Je bent een ervaren accountmanager bij een reclamebureau. Schrijf op basis van het onderstaande transcript een professionele externe debrief die naar de klant verstuurd kan worden na een meeting.

Gebruik de volgende structuur:
**Samenvatting van de bespreking**
**Genomen beslissingen**
**Afgesproken volgende stappen** (met eigenaar en datum indien besproken)
**Open punten** (zaken die nog bevestigd of uitgezocht moeten worden)

Als informatie voor een sectie niet in het transcript staat, schrijf dan: "Niet besproken."

Transcript:
${transcript}

Schrijf de debrief in formeel, klantgericht Nederlands. De toon is professioneel en bevestigend.`,

  'internal-actions': (transcript) =>
    `Je bent een ervaren accountmanager bij een reclamebureau. Extraheer uit het onderstaande transcript alle interne actiepunten voor het bureau.

Geef elk actiepunt weer als:
- **Actie:** beschrijving van de taak
- **Eigenaar:** wie is verantwoordelijk (indien vermeld)
- **Deadline:** wanneer moet het klaar zijn (indien vermeld)

Nummer de actiepunten. Als eigenaar of deadline niet in het transcript staat, schrijf dan: "Niet besproken."

Transcript:
${transcript}

Schrijf in helder Nederlands. Focus op interne taken voor het bureau.`,

  'external-actions': (transcript) =>
    `Je bent een ervaren accountmanager bij een reclamebureau. Extraheer uit het onderstaande transcript alle actiepunten voor de klant.

Geef elk actiepunt weer als:
- **Actie:** wat de klant moet doen
- **Deadline:** wanneer (indien vermeld)

Nummer de actiepunten. Als deadline niet in het transcript staat, schrijf dan: "Niet besproken."

Transcript:
${transcript}

Schrijf in professioneel Nederlands.`,

  'project-planning': (transcript) =>
    `Je bent een ervaren accountmanager bij een reclamebureau. Maak op basis van het onderstaande transcript een eerste aanzet voor een projectplanning.

Identificeer:
- **Projectnaam / omschrijving**
- **Fases** – geef elke fase een naam, beschrijving en indicatieve tijdlijn
- **Mijlpalen** – cruciale momenten of goedkeuringen
- **Deliverables per fase**
- **Betrokken partijen** – wie doet wat (bureau, klant, derden)
- **Kritische afhankelijkheden** – wat moet af zijn voordat iets anders kan starten

Baseer de tijdlijnen op wat in het transcript besproken is. Als informatie voor een onderdeel niet in het transcript staat, schrijf dan: "Niet besproken."

Transcript:
${transcript}

Schrijf in professioneel Nederlands.`,
};
```

- [ ] **Step 2: Convert anonymize.js to ESM**

Replace `lib/anonymize.js`:

```js
const PATTERNS = [
  { type: 'EMAIL',    regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g },
  { type: 'TELEFOON', regex: /(\+31|0031|0)[1-9][0-9\s\-]{7,}/g },
  { type: 'IBAN',     regex: /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7,19}\b/g },
  { type: 'BEDRAG',   regex: /€\s?[0-9]+([.,][0-9]{1,3})*(\s?(k|K|miljoen))?|\b[0-9]+([.,][0-9]{3})*\s?(euro|EUR)\b/g },
  { type: 'NAAM',     regex: /\b([A-Z][a-zéèëàâîïôûù]+ [A-Z][a-zéèëàâîïôûù]+)\b/g },
  { type: 'BEDRIJF',  regex: /\b([A-Z][a-zA-Z\s&]{2,25}(BV|NV|VOF|B\.V\.|N\.V\.)?)\b/g },
];

export function anonymize(text) {
  const map = {};
  const counters = {};
  let result = text;

  for (const { type, regex } of PATTERNS) {
    result = result.replace(new RegExp(regex.source, regex.flags), (match) => {
      const existing = Object.entries(map).find(([, v]) => v === match);
      if (existing) return existing[0];
      counters[type] = (counters[type] || 0) + 1;
      const token = `[${type}_${counters[type]}]`;
      map[token] = match;
      return token;
    });
  }

  return { anonymized: result, map };
}

export function deanonymize(text, map) {
  let result = text;
  for (const [token, original] of Object.entries(map)) {
    result = result.split(token).join(original);
  }
  return result;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/prompts.js lib/anonymize.js
git commit -m "feat: extract prompts module and convert anonymize to ESM"
```

---

### Task 8: Build the API route (Next.js version)

**Files:**
- Create: `app/api/chat/route.js`
- Delete: `api/chat.js` (old Vercel serverless function)

- [ ] **Step 1: Create the Next.js API route**

Create `app/api/chat/route.js`:

```js
import Anthropic from '@anthropic-ai/sdk';
import { anonymize, deanonymize } from '@/lib/anonymize';
import { PROMPTS } from '@/lib/prompts';
import { createClient } from '@/lib/supabase-server';

export async function POST(request) {
  const { transcript, outputType, projectId } = await request.json();

  if (!transcript || !transcript.trim()) {
    return Response.json({ error: 'Transcript is verplicht.' }, { status: 400 });
  }

  if (!outputType || !PROMPTS[outputType]) {
    return Response.json({ error: 'Ongeldig outputType.' }, { status: 400 });
  }

  if (!projectId) {
    return Response.json({ error: 'Project ID is verplicht.' }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const trimmed = transcript.trim();
    const { anonymized, map } = anonymize(trimmed);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: PROMPTS[outputType](anonymized),
        },
      ],
    });

    const rawOutput = message.content[0].text;
    const finalOutput = deanonymize(rawOutput, map);

    // Save output to database
    const supabase = await createClient();
    await supabase.from('outputs').insert({
      project_id: projectId,
      output_type: outputType,
      input_transcript: trimmed,
      result: finalOutput,
    });

    return Response.json({ result: finalOutput });
  } catch (error) {
    console.error('Anthropic API error:', error);
    return Response.json(
      { error: 'Er is een fout opgetreden bij het verwerken van je verzoek.' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Delete old API route**

```bash
rm api/chat.js
rmdir api
```

- [ ] **Step 3: Commit**

```bash
git add app/api/chat/route.js
git rm api/chat.js
git commit -m "feat: migrate API route to Next.js with output persistence"
```

---

### Task 9: Build TranscriptForm component (processing UI)

**Files:**
- Create: `components/TranscriptForm.jsx`

- [ ] **Step 1: Create TranscriptForm component**

Create `components/TranscriptForm.jsx`:

```jsx
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { OUTPUT_TITLES } from '@/lib/prompts';

const OUTPUT_TYPES = [
  { key: 'summary-actions', label: 'Samenvatting met actiepunten', num: '01' },
  { key: 'internal-briefing', label: 'Interne briefing', num: '02' },
  { key: 'external-debrief', label: 'Externe debrief naar klant', num: '03' },
  { key: 'internal-actions', label: 'Actiepunten intern', num: '04' },
  { key: 'external-actions', label: 'Actiepunten extern', num: '05' },
  { key: 'project-planning', label: 'Projectplanning aanzet', num: '06' },
];

export default function TranscriptForm({ projectId, onResult }) {
  const [transcript, setTranscript] = useState('');
  const [selectedType, setSelectedType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileStatus, setFileStatus] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef(null);
  const router = useRouter();

  async function handleGenerate() {
    if (!transcript.trim() || !selectedType) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          outputType: selectedType,
          projectId,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        onResult?.(data.result, selectedType);
        router.refresh();
      }
    } catch {
      setError('Er is een fout opgetreden. Controleer je verbinding en probeer het opnieuw.');
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    const supported = ['.txt', '.pdf', '.doc', '.docx'];

    if (!supported.includes(ext)) {
      setFileStatus({ msg: `Bestandstype "${ext}" wordt niet ondersteund.`, type: 'error' });
      return;
    }

    setFileStatus({ msg: 'Bestand wordt ingelezen...', type: 'loading' });

    if (ext === '.txt') {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTranscript(e.target.result);
        setFileStatus({ msg: `"${file.name}" ingeladen.`, type: 'success' });
      };
      reader.onerror = () => setFileStatus({ msg: 'Fout bij inlezen.', type: 'error' });
      reader.readAsText(file);
    } else if (ext === '.pdf') {
      readPdf(file);
    } else {
      readDocx(file);
    }
  }

  async function readPdf(file) {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item) => item.str).join(' ') + '\n';
      }
      setTranscript(text.trim());
      setFileStatus({ msg: `"${file.name}" ingeladen (${pdf.numPages} pagina's).`, type: 'success' });
    } catch {
      setFileStatus({ msg: 'Fout bij het uitlezen van de PDF.', type: 'error' });
    }
  }

  async function readDocx(file) {
    try {
      const mammoth = await import('mammoth');
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      setTranscript(result.value.trim());
      setFileStatus({ msg: `"${file.name}" ingeladen.`, type: 'success' });
    } catch {
      setFileStatus({ msg: 'Fout bij het uitlezen van het Word-bestand.', type: 'error' });
    }
  }

  const statusColor = fileStatus?.type === 'error' ? 'text-red-600' : fileStatus?.type === 'success' ? 'text-green-600' : 'text-text-muted';

  return (
    <div className="border border-border rounded-xl p-9 shadow-sm">
      <h2 className="font-lexend text-lg font-semibold text-text mb-1">Jouw notities</h2>
      <p className="text-[15px] text-text-sec mb-5">Zet je notities neer of sleep een bestand. Wij doen de rest.</p>

      <textarea
        ref={textareaRef}
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
        onDrop={handleDrop}
        placeholder="Sleep een bestand hierin, of typ je aantekeningen."
        spellCheck={false}
        className={`w-full min-h-[220px] border-[1.5px] rounded-lg px-[18px] py-4 font-inter text-sm text-text leading-[1.7] resize-y outline-none transition-all ${
          dragOver
            ? 'border-orange border-dashed bg-orange-light shadow-[0_0_0_3px_rgba(255,72,0,0.1)]'
            : 'border-border bg-white focus:border-orange focus:shadow-[0_0_0_3px_rgba(255,72,0,0.1)]'
        }`}
      />

      {fileStatus && <p className={`text-xs mt-2 ${statusColor}`}>{fileStatus.msg}</p>}

      <div className="h-px bg-border my-8" />

      <h2 className="font-lexend text-lg font-semibold text-text mb-1">Wat wil je maken?</h2>
      <p className="text-[15px] text-text-sec mb-5">Kies een outputtype en klik op Verwerk.</p>

      <label className="block text-[11px] font-semibold text-text-muted mb-2.5 uppercase tracking-wider">
        Kies een type
      </label>

      <div className="grid grid-cols-3 gap-2.5 max-[580px]:grid-cols-2 max-[380px]:grid-cols-1">
        {OUTPUT_TYPES.map(({ key, label, num }) => (
          <button
            key={key}
            onClick={() => setSelectedType(key)}
            className={`text-left border-[1.5px] rounded-lg p-3.5 font-inter text-[15px] font-medium leading-[1.4] transition-all active:scale-[0.98] ${
              selectedType === key
                ? 'border-orange text-orange bg-orange-light shadow-[0_0_0_1px_#FF4800]'
                : 'border-border text-text-sec hover:border-orange hover:text-orange hover:bg-orange-light'
            }`}
          >
            <span className={`block text-xs font-semibold mb-1.5 tracking-wide ${
              selectedType === key ? 'text-orange-mid' : 'text-border'
            }`}>
              {num}
            </span>
            {label}
          </button>
        ))}
      </div>

      {selectedType && (
        <div className="mt-7">
          <button
            onClick={handleGenerate}
            disabled={loading || !transcript.trim()}
            className="h-12 px-8 bg-orange text-white rounded-lg font-inter text-sm font-semibold transition-all hover:bg-orange-hover shadow-[0_2px_8px_rgba(255,72,0,0.32)] hover:shadow-[0_4px_14px_rgba(255,72,0,0.38)] active:scale-[0.98] disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed"
          >
            {loading ? 'Bezig met verwerken...' : 'Verwerk →'}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-5 py-4">
          {error}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/TranscriptForm.jsx
git commit -m "feat: add TranscriptForm component with file drop and output type selection"
```

---

### Task 10: Build OutputCard component (with export)

**Files:**
- Create: `components/OutputCard.jsx`

- [ ] **Step 1: Create OutputCard component**

Create `components/OutputCard.jsx`:

```jsx
'use client';

import { useState } from 'react';
import { marked } from 'marked';
import { OUTPUT_TITLES } from '@/lib/prompts';

marked.setOptions({ gfm: true, breaks: true });

export default function OutputCard({ output }) {
  const [copyLabel, setCopyLabel] = useState('Kopiëren');
  const title = OUTPUT_TITLES[output.output_type] || 'Output';
  const result = output.result;
  const date = new Date(output.created_at).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  function copyOutput() {
    navigator.clipboard.writeText(result).then(() => {
      setCopyLabel('Gekopieerd');
      setTimeout(() => setCopyLabel('Kopiëren'), 2200);
    });
  }

  async function downloadPDF() {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 20;
    const maxWidth = 210 - margin * 2;
    let y = 20;

    const addPage = () => { doc.addPage(); y = 20; };
    const checkY = (needed) => { if (y + needed > 280) addPage(); };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(title, margin, y);
    y += 10;
    doc.setFontSize(10);

    for (const raw of result.split('\n')) {
      const line = raw.trim();
      if (line === '') { y += 3; continue; }

      const headingMatch = line.match(/^\*\*(.+?)\*\*(.*)$/);
      if (headingMatch) {
        const boldPart = headingMatch[1];
        const restPart = headingMatch[2].replace(/^[\s—]+/, '');
        checkY(8); y += 2;
        doc.setFont('helvetica', 'bold');
        const bw = doc.splitTextToSize(boldPart + (restPart ? ' — ' + restPart : ''), maxWidth);
        doc.text(bw, margin, y); y += bw.length * 5.5;
        doc.setFont('helvetica', 'normal');
        continue;
      }

      const listMatch = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
      if (listMatch) {
        const text = listMatch[1].replace(/\*\*/g, '').replace(/\*/g, '');
        const wrapped = doc.splitTextToSize('• ' + text, maxWidth - 4);
        checkY(wrapped.length * 5);
        doc.text(wrapped, margin + 4, y); y += wrapped.length * 5;
        continue;
      }

      const text = line.replace(/\*\*/g, '').replace(/\*/g, '');
      const wrapped = doc.splitTextToSize(text, maxWidth);
      checkY(wrapped.length * 5);
      doc.text(wrapped, margin, y); y += wrapped.length * 5;
    }

    doc.save(title.toLowerCase().replace(/[\s/]+/g, '-') + '.pdf');
  }

  async function downloadWord() {
    const docx = await import('docx');
    const paragraphs = [];

    paragraphs.push(new docx.Paragraph({
      children: [new docx.TextRun({ text: title, bold: true, size: 28 })],
      spacing: { after: 280 },
    }));

    for (const raw of result.split('\n')) {
      const line = raw.trim();
      if (line === '') {
        paragraphs.push(new docx.Paragraph({ text: '', spacing: { after: 60 } }));
        continue;
      }

      const headingMatch = line.match(/^\*\*(.+?)\*\*(.*)$/);
      if (headingMatch) {
        const boldText = headingMatch[1];
        const rest = headingMatch[2].replace(/^[\s—]+/, '');
        const runs = [new docx.TextRun({ text: boldText, bold: true, size: 22 })];
        if (rest) runs.push(new docx.TextRun({ text: ' — ' + rest, size: 22 }));
        paragraphs.push(new docx.Paragraph({ children: runs, spacing: { before: 200, after: 80 } }));
        continue;
      }

      const listMatch = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
      if (listMatch) {
        const runs = parseInlineRuns(listMatch[1], 20, docx);
        paragraphs.push(new docx.Paragraph({
          children: [new docx.TextRun({ text: '• ', size: 20 }), ...runs],
          indent: { left: 360 },
          spacing: { after: 60 },
        }));
        continue;
      }

      paragraphs.push(new docx.Paragraph({
        children: parseInlineRuns(line, 20, docx),
        spacing: { after: 100 },
      }));
    }

    const wordDoc = new docx.Document({
      sections: [{ properties: {}, children: paragraphs }],
    });

    const blob = await docx.Packer.toBlob(wordDoc);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = title.toLowerCase().replace(/[\s/]+/g, '-') + '.docx';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="border border-border border-l-[3px] border-l-orange rounded-xl p-9 shadow-sm">
      <div className="flex justify-between items-center mb-4 gap-3">
        <div>
          <span className="font-lexend text-[15px] font-semibold text-text">{title}</span>
          <span className="text-xs text-text-muted ml-3">{date}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={copyOutput} className="border-[1.5px] border-orange rounded-[7px] px-3.5 py-[7px] text-xs font-semibold text-orange hover:bg-orange hover:text-white transition-colors">
            {copyLabel}
          </button>
          <button onClick={downloadPDF} className="border-[1.5px] border-orange rounded-[7px] px-3.5 py-[7px] text-xs font-semibold text-orange hover:bg-orange hover:text-white transition-colors">
            PDF
          </button>
          <button onClick={downloadWord} className="border-[1.5px] border-orange rounded-[7px] px-3.5 py-[7px] text-xs font-semibold text-orange hover:bg-orange hover:text-white transition-colors">
            Word
          </button>
        </div>
      </div>

      <div
        className="text-sm leading-[1.8] text-text bg-[#FAFAFA] border border-border rounded-lg p-7 [&_h1]:font-lexend [&_h1]:text-[13px] [&_h1]:font-semibold [&_h1]:uppercase [&_h1]:tracking-wide [&_h1]:mt-6 [&_h1]:mb-2 [&_h2]:font-lexend [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:font-lexend [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:mb-3 [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1.5 [&_strong]:font-semibold [&_hr]:border-border [&_hr]:my-5 [&_table]:w-full [&_table]:border-collapse [&_table]:mb-4 [&_table]:text-[13px] [&_th]:border [&_th]:border-border [&_th]:px-3.5 [&_th]:py-2.5 [&_th]:text-left [&_th]:bg-orange-light [&_th]:font-semibold [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wide [&_td]:border [&_td]:border-border [&_td]:px-3.5 [&_td]:py-2.5 [&_td]:text-left"
        dangerouslySetInnerHTML={{ __html: marked.parse(result) }}
      />
    </div>
  );
}

function parseInlineRuns(text, size, docx) {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .filter((p) => p.length > 0)
    .map((p) =>
      p.startsWith('**') && p.endsWith('**')
        ? new docx.TextRun({ text: p.slice(2, -2), bold: true, size })
        : new docx.TextRun({ text: p.replace(/\*/g, ''), size })
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/OutputCard.jsx
git commit -m "feat: add OutputCard component with markdown render and PDF/Word export"
```

---

### Task 11: Build project detail page

**Files:**
- Create: `app/(authenticated)/projects/[id]/page.jsx`

- [ ] **Step 1: Create project detail page**

Create `app/(authenticated)/projects/[id]/page.jsx`:

```jsx
import { createClient } from '@/lib/supabase-server';
import { redirect, notFound } from 'next/navigation';
import OutputCard from '@/components/OutputCard';
import TranscriptFormWrapper from '@/components/TranscriptFormWrapper';
import Link from 'next/link';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('id', id)
    .single();

  return {
    title: project ? `${project.name} — Oyaa.` : 'Project — Oyaa.',
  };
}

export default async function ProjectDetailPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !project) notFound();

  const { data: outputs } = await supabase
    .from('outputs')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-[800px] mx-auto px-8 py-14">
      <Link
        href="/projects"
        className="text-sm text-text-muted hover:text-orange transition-colors mb-6 inline-block"
      >
        &larr; Alle projecten
      </Link>

      <div className="mb-10">
        <h1 className="font-lexend text-3xl font-bold text-text">{project.name}</h1>
        {project.client_name && (
          <p className="text-text-sec mt-1">{project.client_name}</p>
        )}
      </div>

      <TranscriptFormWrapper projectId={id} />

      {outputs && outputs.length > 0 && (
        <div className="mt-10 space-y-6">
          <h2 className="font-lexend text-lg font-semibold text-text">Eerdere outputs</h2>
          {outputs.map((output) => (
            <OutputCard key={output.id} output={output} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create TranscriptFormWrapper (client component bridge)**

Create `components/TranscriptFormWrapper.jsx`:

```jsx
'use client';

import { useState } from 'react';
import TranscriptForm from '@/components/TranscriptForm';
import OutputCard from '@/components/OutputCard';

export default function TranscriptFormWrapper({ projectId }) {
  const [latestResult, setLatestResult] = useState(null);

  function handleResult(result, outputType) {
    setLatestResult({
      result,
      output_type: outputType,
      created_at: new Date().toISOString(),
    });
  }

  return (
    <>
      <TranscriptForm projectId={projectId} onResult={handleResult} />

      {latestResult && (
        <div className="mt-6">
          <OutputCard output={latestResult} />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Verify the full flow works**

```bash
npm run dev
```

With valid `.env.local` credentials:
1. Navigate to `/login` → login
2. Navigate to `/projects` → create a project
3. Click the project → see the detail page with transcript form
4. Paste a transcript, choose an output type, click "Verwerk"
5. See the output appear, with copy/PDF/Word export
6. Refresh the page → see the output in "Eerdere outputs"

- [ ] **Step 4: Commit**

```bash
git add "app/(authenticated)/projects/[id]/page.jsx" components/TranscriptFormWrapper.jsx
git commit -m "feat: add project detail page with transcript processing and output history"
```

---

### Task 12: Build privacy page and finalize

**Files:**
- Create: `app/privacy/page.jsx`

- [ ] **Step 1: Create privacy page**

Create `app/privacy/page.jsx`:

```jsx
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Privacy & data — Oyaa.',
};

export default function PrivacyPage() {
  return (
    <>
      <section className="bg-hero py-[88px] pb-16 border-b border-orange-mid">
        <div className="max-w-[800px] mx-auto px-8">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-orange mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange" />
            Privacy & data
          </div>
          <h1 className="font-lexend text-[40px] font-bold leading-[1.15] tracking-tight text-text mb-4">
            Zo gaan we om met jouw klantdata
          </h1>
          <p className="text-lg text-text-sec leading-relaxed max-w-[520px]">
            Helder. Geen kleine lettertjes.
          </p>
        </div>
      </section>

      <div className="max-w-[800px] mx-auto px-8 py-14">
        <a href="/" className="text-sm text-text-muted hover:text-orange transition-colors mb-12 inline-block">
          &larr; Terug naar Oyaa
        </a>

        <p className="text-base text-text leading-[1.7] mb-10">
          Je werkt met gevoelige informatie. Transcripten van klantgesprekken, campagnebriefings,
          strategische plannen. Informatie die je niet zomaar ergens wil laten rondslingeren.
          Hier staat precies wat Oyaa doet — en wat we bewust niet doen.
        </p>

        <h2 className="font-lexend text-lg font-semibold text-text mt-12 mb-5">Wat we doen</h2>

        <h3 className="font-lexend text-[15px] font-semibold text-text mt-7 mb-2">We anonimiseren voor we verwerken</h3>
        <p className="text-[15px] text-text-sec leading-[1.75] mb-4">
          Voordat jouw input naar de AI gaat, worden namen, bedrijfsnamen, budgetten en andere
          identificerende informatie vervangen door tijdelijke codes. De AI ziet geen
          &quot;Erik van Vandaag &amp; Morgen&quot; — die ziet &quot;[PERSOON_1] van [BEDRIJF_1]&quot;.
          Na verwerking zetten we alles terug. Jij ziet de volledige output.
          De AI heeft de namen nooit gezien.
        </p>

        <h3 className="font-lexend text-[15px] font-semibold text-text mt-7 mb-2">Die anonimisering gebeurt lokaal, in Europa</h3>
        <p className="text-[15px] text-text-sec leading-[1.75] mb-4">
          De stap waarbij we namen herkennen en vervangen, vindt plaats op onze eigen server
          in Duitsland. Identificerende informatie verlaat de EU nooit.
        </p>

        <h3 className="font-lexend text-[15px] font-semibold text-text mt-7 mb-2">We slaan niets op</h3>
        <p className="text-[15px] text-text-sec leading-[1.75] mb-4">
          Wat je invoert wordt verwerkt en weggegooid. Geen database, geen logbestanden,
          geen geschiedenis. Zodra je output ziet, bestaat de originele input nergens
          meer in ons systeem.
        </p>

        <h2 className="font-lexend text-lg font-semibold text-text mt-12 mb-5">Wat we niet doen</h2>
        <ul className="space-y-2 mb-4">
          <li className="text-[15px] text-text-sec leading-[1.75] pl-5 relative before:content-['—'] before:absolute before:left-0 before:text-text-muted">We gebruiken jouw input niet om AI-modellen te trainen</li>
          <li className="text-[15px] text-text-sec leading-[1.75] pl-5 relative before:content-['—'] before:absolute before:left-0 before:text-text-muted">We verkopen geen data aan derden</li>
          <li className="text-[15px] text-text-sec leading-[1.75] pl-5 relative before:content-['—'] before:absolute before:left-0 before:text-text-muted">We bewaren geen transcripten of documenten</li>
          <li className="text-[15px] text-text-sec leading-[1.75] pl-5 relative before:content-['—'] before:absolute before:left-0 before:text-text-muted">We geven geen toegang aan andere bureaus of partijen</li>
        </ul>

        <h2 className="font-lexend text-lg font-semibold text-text mt-12 mb-5">De AI-laag</h2>
        <p className="text-[15px] text-text-sec leading-[1.75] mb-4">
          Oyaa gebruikt de Anthropic API. Via de API wordt content niet gebruikt voor
          modeltraining en niet bewaard na verwerking. Anthropic heeft een
          verwerkersovereenkomst beschikbaar die AVG-compliant is.{' '}
          <a href="https://anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-orange underline underline-offset-[3px] hover:text-orange-hover">
            Lees het privacybeleid van Anthropic &rarr;
          </a>
        </p>

        <h2 className="font-lexend text-lg font-semibold text-text mt-12 mb-5">Vergelijk het met wat je nu gebruikt</h2>
        <p className="text-[15px] text-text-sec leading-[1.75] mb-4">
          Slack, Google Workspace, Notion — tools die bureaus dagelijks gebruiken voor
          dezelfde gevoelige informatie — slaan data permanent op in de VS. WeTransfer
          probeerde in 2025 creatief werk te gebruiken voor AI-training, wat leidde tot
          een brede boycot in de creatieve industrie.
        </p>
        <p className="text-[15px] text-text-sec leading-[1.75] mb-4">
          Oyaa anonimiseert actief, slaat niets op en gebruikt jouw werk nooit voor
          iets anders dan de output die je vraagt.
        </p>

        <h2 className="font-lexend text-lg font-semibold text-text mt-12 mb-5">Verwerkersovereenkomst</h2>
        <p className="text-[15px] text-text-sec leading-[1.75] mb-4">
          Werk je voor klanten waarmee je een NDA hebt getekend? Dan kunnen we een
          verwerkersovereenkomst opstellen die vastlegt hoe Oyaa omgaat met data
          in jouw specifieke context. Mail naar{' '}
          <a href="mailto:privacy@oyaa.app" className="text-orange underline underline-offset-[3px] hover:text-orange-hover">
            privacy@oyaa.app
          </a>
        </p>
      </div>

      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Update home page redirect**

Replace `app/page.jsx`:

```jsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/projects');
}
```

- [ ] **Step 3: Full end-to-end verification**

```bash
npm run build
```

Expected: Build succeeds with no errors.

```bash
npm run dev
```

Test the full flow:
1. `/login` → register a new account
2. Redirected to `/projects` → create a project
3. Open project → process a transcript → see output
4. Refresh → output persists in "Eerdere outputs"
5. Export to PDF and Word works
6. `/privacy` renders correctly
7. Footer link to privacy works
8. Logout → redirected to login
9. Unauthenticated access to `/projects` → redirected to login

- [ ] **Step 4: Commit**

```bash
git add app/privacy/page.jsx app/page.jsx
git commit -m "feat: add privacy page and finalize routing"
```

- [ ] **Step 5: Final commit and push**

```bash
git add -A
git commit -m "feat: Oyaa v2 — Next.js + Supabase with project-based output storage"
git push
```
