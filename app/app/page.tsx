type AppPageProps = {
  searchParams: Promise<{ tab?: string; login?: string }>;
};

export default async function AppPage({ searchParams }: AppPageProps) {
  const { tab, login } = await searchParams;
  const params = new URLSearchParams();
  if (tab) params.set('tab', tab);
  if (login === '1') params.set('login', '1');
  const src = `/local-mvp/index.html?view=app${params.size ? `&${params}` : ''}`;

  return (
    <main className="mvp-frame-page" aria-label="Aesthetic Archive workspace">
      <iframe className="mvp-frame" src={src} title="Aesthetic Archive workspace" />
    </main>
  );
}
