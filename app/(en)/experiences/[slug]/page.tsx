import { notFound } from 'next/navigation';
import ExperiencePage from '@/components/experience-page';
import { experienceCopy, experiencePath, experienceSlugs, isExperienceSlug } from '@/content/experiences';
import { pageMetadata } from '@/lib/metadata';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return experienceSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  if (!isExperienceSlug(slug)) notFound();
  const t = experienceCopy(slug, 'en');
  return pageMetadata('en', experiencePath(slug), t.title + ' | Arnaud Durand', t.description);
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  if (!isExperienceSlug(slug)) notFound();
  return <ExperiencePage locale="en" slug={slug} />;
}
