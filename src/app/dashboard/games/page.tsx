import { GlassCard } from "@/components/layout/GlassCard";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Games() {
  return (
    <main className="flex-1 p-6 md:p-12 min-h-screen flex items-center justify-center">
      <GlassCard className="max-w-md w-full text-center p-8">
        <h1 className="text-3xl font-bold text-white mb-4">Games</h1>
        <p className="text-muted-foreground mb-8">This feature is coming soon.</p>
        <Link href="/dashboard">
          <Button variant="outline" className="glass-button text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </GlassCard>
    </main>
  );
}
