export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
        DJ Graph Notes
      </h1>
      <p className="mt-3 max-w-md text-center text-zinc-600">
        Web app (`apps/web`). API lives at `apps/api` (port 3001). Shared
        domain code lives in `packages/*`.
      </p>
    </main>
  );
}
