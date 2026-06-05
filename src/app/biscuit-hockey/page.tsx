import PageLayout from "@/components/layout/page-layout";
import { BISCUIT_HOCKEY } from "@/lib/content";

export default function BiscuitHockeyPage() {
  return (
    <PageLayout>
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pt-8 sm:pt-12 pb-16 sm:pb-20">
        <h1 className="text-4xl font-bold font-display mb-2">{BISCUIT_HOCKEY.heading}</h1>
        <p className="text-gold font-semibold text-lg mb-8">{BISCUIT_HOCKEY.subheading}</p>
        <p className="text-teal/80 leading-relaxed text-lg">{BISCUIT_HOCKEY.body}</p>
      </main>
    </PageLayout>
  );
}
