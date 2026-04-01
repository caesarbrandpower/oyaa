import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import ProjectCard from '@/components/ProjectCard';
import NewProjectForm from '@/components/NewProjectForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Projecten \u2014 Waybetter.',
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
          <h1 className="font-[family-name:var(--font-lexend)] text-3xl font-bold text-text">Projecten</h1>
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
