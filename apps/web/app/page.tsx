import { Button } from "@selecta/ui/components/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">Selecta</h1>
      <p className="text-muted-foreground mt-3 max-w-md text-center">
        Write how you mix. Play with a graph that thinks the same way.
      </p>
      <Button className="mt-6">Get started</Button>
    </main>
  );
}
