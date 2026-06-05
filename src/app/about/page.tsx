import PageLayout from "@/components/layout/page-layout";
import { OUR_STORY, SITE } from "@/lib/content";

export default function AboutPage() {
  return (
    <PageLayout>
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pt-8 sm:pt-12 pb-16 sm:pb-20">
        <h1 className="text-4xl font-bold font-display mb-2">{OUR_STORY.heading}</h1>
        <p className="text-gold font-semibold text-lg mb-8">{OUR_STORY.subheading}</p>
        <p className="text-primary/80 leading-relaxed text-lg mb-8">{OUR_STORY.body}</p>
        <div className="glass-card p-6">
          <p className="text-primary/70">
            <strong>{SITE.name}</strong><br />
            {SITE.phone}<br />
            {SITE.email}<br />
            {SITE.location}
          </p>
        </div>
      </main>
    </PageLayout>
  );
}
