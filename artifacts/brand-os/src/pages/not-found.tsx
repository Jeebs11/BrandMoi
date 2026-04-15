import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";

export default function NotFound() {
  return (
    <AppShell auth>
      <div className="w-full max-w-[430px] md:max-w-[500px] bg-white rounded-[40px] p-10 text-center shadow-2xl border border-gray-100">
        <h1 className="text-9xl font-extrabold text-gray-100 mb-4 tracking-tighter">404</h1>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h2>
        <p className="text-gray-500 mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link href="/">
          <Button className="w-full h-14 text-lg">Return Home</Button>
        </Link>
      </div>
    </AppShell>
  );
}
