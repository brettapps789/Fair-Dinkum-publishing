import React, { useState, useEffect } from 'react';
import { 
  Play, Pause, RefreshCw, CheckCircle2, 
  AlertCircle, BookOpen, PenTool, Search, 
  Terminal, ChevronRight, Loader2, UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WorkforceState {
  topic: string;
  title: string;
  status: 'idle' | 'outlining' | 'writing' | 'editing' | 'compiling' | 'completed' | 'error';
  currentChapter: number;
  totalChapters: number;
  logs: string[];
  outline: string;
  chapters: { title: string; content: string }[];
}

export default function WorkforceDashboard() {
  const [topic, setTopic] = useState("The Future of Artificial Intelligence in Healthcare");
  const [title, setTitle] = useState("Healing Minds: The AI Revolution");
  const [state, setState] = useState<WorkforceState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [autoMode, setAutoMode] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/workforce/status');
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch (error) {
      console.error("Failed to fetch status", error);
    }
  };

  useEffect(() => {
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const startWorkforce = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/workforce/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, title })
      });
      await fetchStatus();
    } finally {
      setIsLoading(false);
    }
  };

  const runOutline = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/workforce/step/outline', { method: 'POST' });
      await fetchStatus();
    } finally {
      setIsLoading(false);
    }
  };

  const runNextChapter = async () => {
    if (!state) return;
    setIsLoading(true);
    try {
      // Parse chapters from outline if not already done
      const chapterMatches = state.outline.match(/Chapter \d+: .+/g) || [];
      const nextIndex = state.chapters.length;
      if (nextIndex < chapterMatches.length) {
        const chapterTitle = chapterMatches[nextIndex];
        const context = state.chapters.map(c => c.title).join('\n');
        await fetch('/api/workforce/step/chapter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ index: nextIndex, title: chapterTitle, context })
        });
      } else {
        await fetch('/api/workforce/step/compile', { method: 'POST' });
      }
      await fetchStatus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Workforce</h2>
          <p className="text-stone-500">Multi-agent production pipeline for KDP bestsellers.</p>
        </div>
        <div className="flex gap-3">
          {!state ? (
            <button 
              onClick={startWorkforce}
              disabled={isLoading}
              className="px-6 py-2 bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-700/20"
            >
              <UserPlus className="w-4 h-4" /> Initialize Workforce
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-xl shadow-sm">
              <div className={`w-2 h-2 rounded-full ${state.status !== 'idle' ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300'}`} />
              <span className="text-xs font-bold uppercase tracking-wider text-stone-600">{state.status}</span>
            </div>
          )}
        </div>
      </header>

      {!state ? (
        <div className="bg-white p-10 rounded-3xl border border-stone-200 shadow-sm space-y-8 max-w-2xl mx-auto">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Book Title</label>
              <input 
                type="text" 
                value={title} 
                onChange={e => setTitle(e.target.value)}
                className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-lg font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Core Topic / Premise</label>
              <textarea 
                rows={4} 
                value={topic} 
                onChange={e => setTopic(e.target.value)}
                className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
              />
            </div>
          </div>
          <div className="p-6 bg-stone-50 rounded-2xl border border-dashed border-stone-300">
            <h4 className="text-sm font-bold mb-2 flex items-center gap-2"><Terminal className="w-4 h-4" /> Workforce Configuration</h4>
            <ul className="text-xs text-stone-500 space-y-2">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> 1x Senior Book Architect (GPT-4o)</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> 1x Lead Author (GPT-4o)</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> 1x Senior Copy Editor (GPT-4o)</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> 1x EPUB Technical Specialist</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Controls & Logs */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-6">
              <h3 className="font-bold flex items-center gap-2"><Play className="w-4 h-4" /> Production Controls</h3>
              
              <div className="space-y-3">
                {state.status === 'idle' && (
                  <button 
                    onClick={runOutline}
                    disabled={isLoading}
                    className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4" /> Run Outline Phase</>}
                  </button>
                )}

                {(state.status === 'completed' || state.outline) && state.status !== 'completed' && (
                  <button 
                    onClick={runNextChapter}
                    disabled={isLoading}
                    className="w-full py-4 bg-emerald-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-800 transition-all"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><PenTool className="w-4 h-4" /> {state.chapters.length === state.totalChapters ? 'Compile Manuscript' : `Write Chapter ${state.chapters.length + 1}`}</>}
                  </button>
                )}
              </div>

              <div className="pt-4 border-t border-stone-100">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Live Workforce Logs</span>
                  <button onClick={fetchStatus} className="p-1 hover:bg-stone-100 rounded-full transition-colors">
                    <RefreshCw className="w-3 h-3 text-stone-400" />
                  </button>
                </div>
                <div className="bg-stone-900 rounded-2xl p-4 h-[300px] overflow-y-auto font-mono text-[10px] space-y-2 custom-scrollbar">
                  {state.logs.map((log, i) => (
                    <div key={i} className="text-emerald-400/80">
                      <span className="text-emerald-500/40 mr-2">{'>'}</span>
                      {log}
                    </div>
                  ))}
                  <div className="animate-pulse text-emerald-500">_</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Output Preview */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
              <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                <div className="flex gap-4">
                  <button className="text-xs font-bold border-b-2 border-emerald-600 pb-1">Outline</button>
                  <button className="text-xs font-bold text-stone-400 pb-1">Chapters ({state.chapters.length})</button>
                </div>
                <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                  Progress: {Math.round((state.chapters.length / (state.totalChapters || 1)) * 100)}%
                </div>
              </div>
              <div className="flex-1 p-8 overflow-y-auto prose prose-stone max-w-none custom-scrollbar">
                {state.outline ? (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-500">
                    <pre className="whitespace-pre-wrap font-sans text-stone-700 leading-relaxed">
                      {state.outline}
                    </pre>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-stone-300 italic">
                    <BookOpen className="w-12 h-12 mb-4 opacity-20" />
                    Waiting for Architect to generate outline...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
