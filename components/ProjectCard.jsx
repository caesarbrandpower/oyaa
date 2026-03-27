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
      <h3 className="font-[family-name:var(--font-lexend)] text-base font-semibold text-text group-hover:text-orange transition-colors">
        {project.name}
      </h3>
      {project.client_name && (
        <p className="text-sm text-text-sec mt-1">{project.client_name}</p>
      )}
      <p className="text-xs text-text-muted mt-3">{date}</p>
    </Link>
  );
}
