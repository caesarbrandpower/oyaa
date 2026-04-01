export const dynamic = 'force-dynamic';

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
    title: project ? `${project.name} \u2014 Waybetter.` : 'Project \u2014 Waybetter.',
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
        <h1 className="font-[family-name:var(--font-lexend)] text-3xl font-bold text-text">{project.name}</h1>
        {project.client_name && (
          <p className="text-text-sec mt-1">{project.client_name}</p>
        )}
      </div>

      <TranscriptFormWrapper projectId={id} />

      {outputs && outputs.length > 0 && (
        <div className="mt-10 space-y-6">
          <h2 className="font-[family-name:var(--font-lexend)] text-lg font-semibold text-text">Eerdere resultaten</h2>
          {outputs.map((output) => (
            <OutputCard key={output.id} output={output} />
          ))}
        </div>
      )}
    </div>
  );
}
