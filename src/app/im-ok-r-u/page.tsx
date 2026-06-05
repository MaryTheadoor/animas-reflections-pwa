import PageLayout from "@/components/layout/page-layout";
import { IM_OK_R_U } from "@/lib/content";

export default function ImOkRuPage() {
  return (
    <PageLayout>
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pt-8 sm:pt-12 pb-16 sm:pb-20">
        <h1 className="text-4xl font-bold font-display mb-2">{IM_OK_R_U.heading}</h1>
        <p className="text-gold font-semibold text-lg mb-8">{IM_OK_R_U.subheading}</p>
        <p className="text-teal/80 leading-relaxed text-lg">{IM_OK_R_U.body}</p>
      </main>
    </PageLayout>
  );
}
