import React, { useState, useEffect } from 'react';
import { 
  Play, Pause, RefreshCw, CheckCircle2, 
  AlertCircle, BookOpen, PenTool, Search, 
  Terminal, ChevronRight, Loader2, UserPlus,
  Table, Download, FileText, Mail, HardDrive, FileJson, MessageSquare,
  Image, Sparkles, Type
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WorkforceState {
  topic: string;
  title: string;
  isAiGenerated: boolean;
  status: 'idle' | 'researching' | 'outlining' | 'writing' | 'editing' | 'compiling' | 'completed' | 'error';
  currentChapter: number;
  totalChapters: number;
  logs: string[];
  research: string;
  outline: string;
  chapters: { title: string; content: string }[];
}

export default function WorkforceDashboard() {
  const [topic, setTopic] = useState("The Future of Artificial Intelligence in Healthcare");
  const [title, setTitle] = useState("Healing Minds: The AI Revolution");
  const [isAiGenerated, setIsAiGenerated] = useState(true);
  const [state, setState] = useState<WorkforceState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [googleFiles, setGoogleFiles] = useState<any[]>([]);
  const [showGooglePanel, setShowGooglePanel] = useState(false);
  const [activeTab, setActiveTab] = useState<'research' | 'outline' | 'chapters' | 'marketing'>('outline');

  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverPrompt, setCoverPrompt] = useState("");
  const [blurb, setBlurb] = useState("");
  const [authorBio, setAuthorBio] = useState("");
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [isGeneratingMarketing, setIsGeneratingMarketing] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/workforce/status');
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            setState(data);
          } catch (e) {
            console.error("Failed to parse workforce status JSON:", text.slice(0, 200));
          }
        }
      }

      const googleRes = await fetch('/api/auth/google/status');
      if (googleRes.ok) {
        const contentType = googleRes.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const text = await googleRes.text();
          try {
            const { connected } = JSON.parse(text);
            setIsGoogleConnected(connected);
            
            if (connected && !googleFiles.length) {
              const driveRes = await fetch('/api/google/drive/files');
              if (driveRes.ok) {
                const driveContentType = driveRes.headers.get("content-type");
                if (driveContentType && driveContentType.includes("application/json")) {
                  const driveText = await driveRes.text();
                  try {
                    const driveData = JSON.parse(driveText);
                    setGoogleFiles(driveData.files || []);
                  } catch (e) {
                    console.error("Failed to parse drive files JSON:", driveText.slice(0, 200));
                  }
                }
              }
            }
          } catch (e) {
            console.error("Failed to parse google status JSON:", text.slice(0, 200));
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch status", error);
    }
  };

  const sendEmail = async () => {
    if (!state) return;
    setIsLoading(true);
    try {
      await fetch('/api/google/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'brett@brettapps.com',
          subject: `Manuscript Ready: ${state.title}`,
          body: `<h1>Manuscript Completed</h1><p>The manuscript for "${state.title}" is now ready for review.</p>`
        })
      });
      alert("Email sent to brett@brettapps.com");
    } catch (e) {
      console.error("Failed to send email", e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveToDocs = async () => {
    if (!state) return;
    setIsLoading(true);
    try {
      const fullContent = state.chapters.map(c => `## ${c.title}\n\n${c.content}`).join('\n\n');
      await fetch('/api/google/docs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: state.title,
          content: fullContent
        })
      });
      alert("Manuscript saved to Google Docs");
    } catch (e) {
      console.error("Failed to save to docs", e);
    } finally {
      setIsLoading(false);
    }
  };

  const generateCover = async () => {
    if (!coverPrompt) return;
    setIsGeneratingCover(true);
    try {
      const { generateCoverImage } = await import('../services/geminiService');
      const imageUrl = await generateCoverImage(coverPrompt);
      if (imageUrl) {
        setCoverImage(imageUrl);
      }
    } catch (error) {
      console.error("Failed to generate cover", error);
    } finally {
      setIsGeneratingCover(false);
    }
  };

  const generateMarketing = async () => {
    if (!state) return;
    setIsGeneratingMarketing(true);
    try {
      const { generateBackCoverBlurb, generateAuthorBio } = await import('../services/geminiService');
      const [newBlurb, newBio] = await Promise.all([
        generateBackCoverBlurb(state.title, state.topic, state.outline),
        generateAuthorBio("Brett Sjoberg")
      ]);
      setBlurb(newBlurb || "");
      setAuthorBio(newBio || "");
    } catch (error) {
      console.error("Failed to generate marketing content", error);
    } finally {
      setIsGeneratingMarketing(false);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        fetchStatus();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const connectGoogle = async () => {
    try {
      const res = await fetch('/api/auth/google/url');
      const contentType = res.headers.get("content-type");
      
      if (!res.ok) {
        let errorMessage = `Server returned ${res.status}`;
        if (contentType && contentType.includes("application/json")) {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } else {
          const text = await res.text();
          errorMessage = text.slice(0, 100) || errorMessage;
        }
        throw new Error(errorMessage);
      }

      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Expected JSON, got ${contentType}`);
      }

      const text = await res.text();
      try {
        const { url } = JSON.parse(text);
        window.open(url, 'google_auth', 'width=600,height=700');
      } catch (e) {
        console.error("Failed to parse Google Auth URL JSON:", text.slice(0, 200));
        throw new Error("Invalid response from server");
      }
    } catch (error: any) {
      console.error("Failed to get Google Auth URL", error);
      alert(`Failed to connect to Google: ${error.message}`);
    }
  };

  useEffect(() => {
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const startWorkforce = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/workforce/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, title, isAiGenerated })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to start workforce' }));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }
      await fetchStatus();
    } catch (error) {
      console.error("Failed to start workforce", error);
    } finally {
      setIsLoading(false);
    }
  };

  const runResearch = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/workforce/step/research', { method: 'POST' });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Research failed' }));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }
      await fetchStatus();
      setActiveTab('research');
    } catch (error) {
      console.error("Research failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  const runOutline = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/workforce/step/outline', { method: 'POST' });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Outline generation failed' }));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }
      await fetchStatus();
      setActiveTab('outline');
    } catch (error) {
      console.error("Outline failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  const runNextChapter = async () => {
    if (!state) return;
    setIsLoading(true);
    try {
      setActiveTab('chapters');
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

  const exportBook = async (format: 'epub' | 'docx') => {
    if (!state) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: state.title,
          author: "KDP Master Suite",
          chapters: state.chapters
        })
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.title.replace(/\s+/g, '_')}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error(`Failed to export ${format}`, error);
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
          <button 
            onClick={() => setShowGooglePanel(!showGooglePanel)}
            className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all border ${
              isGoogleConnected 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
            }`}
          >
            <Search className="w-4 h-4" />
            {isGoogleConnected ? 'Workspace Connected' : 'Connect Workspace'}
          </button>
          {!isGoogleConnected && (
            <button 
              onClick={connectGoogle}
              className="px-4 py-2 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-all flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" /> Connect Google
            </button>
          )}
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

      <AnimatePresence>
        {showGooglePanel && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 bg-white border border-stone-200 rounded-3xl shadow-sm space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold flex items-center gap-2"><Search className="w-5 h-5 text-emerald-600" /> Google Workspace Integration</h3>
                <div className="flex gap-2">
                  <button onClick={sendEmail} className="px-3 py-1.5 bg-stone-100 text-stone-700 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-stone-200"><Mail className="w-3.5 h-3.5" /> Email Brett</button>
                  <button onClick={saveToDocs} className="px-3 py-1.5 bg-stone-100 text-stone-700 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-stone-200"><FileText className="w-3.5 h-3.5" /> Save to Docs</button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                  <div className="flex items-center gap-2 mb-3 text-xs font-bold text-stone-400 uppercase tracking-wider">
                    <HardDrive className="w-3.5 h-3.5" /> Recent Drive Files
                  </div>
                  <div className="space-y-2">
                    {googleFiles.length > 0 ? googleFiles.map(file => (
                      <div key={file.id} className="text-sm text-stone-600 flex items-center gap-2">
                        <FileJson className="w-3.5 h-3.5 opacity-50" /> {file.name}
                      </div>
                    )) : <div className="text-sm text-stone-400 italic">No files found</div>}
                  </div>
                </div>
                
                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                  <div className="flex items-center gap-2 mb-3 text-xs font-bold text-stone-400 uppercase tracking-wider">
                    <MessageSquare className="w-3.5 h-3.5" /> Chat Status
                  </div>
                  <div className="text-sm text-stone-600">
                    Integration active. Ready to send notifications to Google Chat spaces.
                  </div>
                </div>

                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <div className="flex items-center gap-2 mb-3 text-xs font-bold text-emerald-600 uppercase tracking-wider">
                    <UserPlus className="w-3.5 h-3.5" /> Account
                  </div>
                  <div className="text-sm text-emerald-900 font-medium">
                    brett@brettapps.com
                  </div>
                  <div className="text-[10px] text-emerald-600 mt-1">
                    Full API access granted for Drive, Docs, Gmail, and Sheets.
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
            <div className="flex items-center gap-3 p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
              <input 
                type="checkbox" 
                id="ai-disclosure"
                checked={isAiGenerated}
                onChange={e => setIsAiGenerated(e.target.checked)}
                className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
              />
              <label htmlFor="ai-disclosure" className="text-sm font-medium text-emerald-900 cursor-pointer">
                This book contains AI-generated content (KDP Disclosure)
              </label>
            </div>
          </div>
          <div className="p-6 bg-stone-50 rounded-2xl border border-dashed border-stone-300">
            <h4 className="text-sm font-bold mb-2 flex items-center gap-2"><Terminal className="w-4 h-4" /> Workforce Configuration</h4>
            <ul className="text-xs text-stone-500 space-y-2">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> 1x Deep Research Agent (Gemini 2.5 Deep Research)</li>
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
                    onClick={runResearch}
                    disabled={isLoading}
                    className="w-full py-4 bg-emerald-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-800 transition-all"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4" /> Run Deep Research</>}
                  </button>
                )}

                {state.research && state.status !== 'researching' && !state.outline && (
                  <button 
                    onClick={runOutline}
                    disabled={isLoading}
                    className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><BookOpen className="w-4 h-4" /> Run Outline Phase</>}
                  </button>
                )}

                {(state.status === 'completed' || state.outline) && state.status !== 'completed' && state.status !== 'researching' && (
                  <button 
                    onClick={runNextChapter}
                    disabled={isLoading}
                    className="w-full py-4 bg-emerald-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-800 transition-all"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><PenTool className="w-4 h-4" /> {state.chapters.length === state.totalChapters ? 'Compile Manuscript' : `Write Chapter ${state.chapters.length + 1}`}</>}
                  </button>
                )}

                {state.status === 'completed' && (
                  <div className="space-y-3">
                    <button 
                      onClick={() => exportBook('epub')}
                      disabled={isLoading}
                      className="w-full py-4 bg-emerald-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-800 transition-all"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4" /> Export EPUB</>}
                    </button>
                    <button 
                      onClick={() => exportBook('docx')}
                      disabled={isLoading}
                      className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><FileText className="w-4 h-4" /> Export DOCX</>}
                    </button>
                  </div>
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
                  <button 
                    onClick={() => setActiveTab('research')}
                    className={`text-xs font-bold pb-1 transition-all ${activeTab === 'research' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-stone-400'}`}
                  >
                    Research
                  </button>
                  <button 
                    onClick={() => setActiveTab('outline')}
                    className={`text-xs font-bold pb-1 transition-all ${activeTab === 'outline' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-stone-400'}`}
                  >
                    Outline
                  </button>
                  <button 
                    onClick={() => setActiveTab('chapters')}
                    className={`text-xs font-bold pb-1 transition-all ${activeTab === 'chapters' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-stone-400'}`}
                  >
                    Chapters ({state.chapters.length})
                  </button>
                  <button 
                    onClick={() => setActiveTab('marketing')}
                    className={`text-xs font-bold pb-1 transition-all ${activeTab === 'marketing' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-stone-400'}`}
                  >
                    Cover & Marketing
                  </button>
                </div>
                <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                  {state.isAiGenerated && <span className="mr-4 text-emerald-600">AI-Generated</span>}
                  Progress: {Math.round((state.chapters.length / (state.totalChapters || 1)) * 100)}%
                </div>
              </div>
              <div className="flex-1 p-8 overflow-y-auto prose prose-stone max-w-none custom-scrollbar">
                {activeTab === 'research' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-500">
                    {state.research ? (
                      <pre className="whitespace-pre-wrap font-sans text-stone-700 leading-relaxed">
                        {state.research}
                      </pre>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-stone-300 italic py-20">
                        <Search className="w-12 h-12 mb-4 opacity-20" />
                        No research data available yet.
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'outline' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-500">
                    {state.outline ? (
                      <pre className="whitespace-pre-wrap font-sans text-stone-700 leading-relaxed">
                        {state.outline}
                      </pre>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-stone-300 italic py-20">
                        <BookOpen className="w-12 h-12 mb-4 opacity-20" />
                        Waiting for Architect to generate outline...
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'chapters' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-500 space-y-12">
                    {state.chapters.length > 0 ? (
                      state.chapters.map((ch, i) => (
                        <div key={i} className="border-b border-stone-100 pb-12 last:border-0">
                          <h3 className="text-2xl font-bold mb-6">{ch.title}</h3>
                          <div className="text-stone-700 leading-relaxed whitespace-pre-wrap">
                            {ch.content}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-stone-300 italic py-20">
                        <PenTool className="w-12 h-12 mb-4 opacity-20" />
                        No chapters written yet.
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'marketing' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-500 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Image className="w-5 h-5 text-emerald-600" /> Book Cover Generator
                          </h3>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Cover Art Prompt</label>
                              <textarea 
                                rows={3} 
                                value={coverPrompt} 
                                onChange={e => setCoverPrompt(e.target.value)}
                                placeholder="Describe the mood, setting, and style of your cover..."
                                className="w-full p-4 bg-white border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none text-sm"
                              />
                            </div>
                            <button 
                              onClick={generateCover}
                              disabled={isGeneratingCover || !coverPrompt}
                              className="w-full py-3 bg-stone-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all disabled:opacity-50"
                            >
                              {isGeneratingCover ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Generate Cover Art</>}
                            </button>
                          </div>
                        </div>

                        {coverImage && (
                          <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-500">
                            <div className="relative group">
                              <img 
                                src={coverImage} 
                                alt="Generated Book Cover" 
                                className="w-64 aspect-[9/16] object-cover rounded-xl shadow-2xl border-4 border-white"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                                <button 
                                  onClick={() => {
                                    const a = document.createElement('a');
                                    a.href = coverImage;
                                    a.download = 'book_cover.png';
                                    a.click();
                                  }}
                                  className="p-3 bg-white rounded-full text-stone-900 hover:scale-110 transition-transform"
                                >
                                  <Download className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                            <p className="text-xs text-stone-400 italic">9:16 Aspect Ratio - Optimized for Kindle</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-6">
                        <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                              <Type className="w-5 h-5 text-emerald-600" /> Marketing Copy
                            </h3>
                            <button 
                              onClick={generateMarketing}
                              disabled={isGeneratingMarketing}
                              className="p-2 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-all disabled:opacity-50"
                              title="Generate Marketing Content"
                            >
                              {isGeneratingMarketing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            </button>
                          </div>
                          
                          <div className="space-y-6">
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Back Cover Blurb</label>
                              <div className="p-4 bg-white border border-stone-200 rounded-xl text-sm text-stone-700 min-h-[100px] whitespace-pre-wrap">
                                {blurb || <span className="text-stone-300 italic">No blurb generated yet.</span>}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Author Bio</label>
                              <div className="p-4 bg-white border border-stone-200 rounded-xl text-sm text-stone-700 min-h-[80px] whitespace-pre-wrap">
                                {authorBio || <span className="text-stone-300 italic">No bio generated yet.</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
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
