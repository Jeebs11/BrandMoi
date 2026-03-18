import { Link } from "wouter";
import { ArrowLeft, BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useListDrafts } from "@workspace/api-client-react";

export default function Library() {
  const { data: drafts, isLoading } = useListDrafts();

  return (
    <div className="min-h-screen bg-[#F4F4F5] flex justify-center">
      <div className="w-full max-w-[430px] bg-gray-50 min-h-screen shadow-2xl relative flex flex-col border-x border-gray-200">
        <header className="px-6 pt-12 pb-6 bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-foreground">Content Library</h1>
        </header>

        <main className="flex-1 px-6 py-8 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded-3xl animate-pulse"></div>
              ))}
            </div>
          ) : drafts && drafts.length > 0 ? (
            <div className="space-y-4 pb-24">
              {drafts.map(draft => (
                <div key={draft.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:border-primary/30 transition-colors cursor-pointer group">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-1 rounded-md">
                      {draft.status}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">
                      {new Date(draft.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 line-clamp-1">{draft.structuredBreakdown?.topic || "Untitled Draft"}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{draft.rawInput}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 text-gray-400">
                <BookOpen className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No drafts yet</h3>
              <p className="text-gray-500 mb-8 max-w-[250px]">Your saved posts, carousels, and visual concepts will appear here.</p>
              
              <Link href="/">
                <Button className="h-14 px-8 rounded-2xl group">
                  <Plus className="w-5 h-5 mr-2" />
                  Capture an idea
                </Button>
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
