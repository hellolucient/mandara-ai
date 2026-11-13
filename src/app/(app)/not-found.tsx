import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="font-heading text-3xl">That page is not in your workspace.</h1>
      <Link href="/chat" className="mt-4 inline-block text-sm text-primary">
        Back to the assistant
      </Link>
    </main>
  );
}
