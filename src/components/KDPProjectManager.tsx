import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Book, Send, FileText, AlertTriangle, Loader2, 
  Layout, Image as ImageIcon, User, DollarSign, 
  Download, List, ChevronRight, Save, Database, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import WorkforceDashboard from './WorkforceDashboard';
import { 
  generateChapter, generateOutline, generateBackCoverBlurb, 
  generateAuthorBio, getPricingRecommendation, generateCoverImage,
  editChapter, compileManuscript
} from '../services/geminiService';

type Tab = 'setup' | 'workforce' | 'outline' | 'manuscript' | 'marketing' | 'author' | 'pricing' | 'resources';

export default function KDPProjectManager() {
  const [activeTab, setActiveTab] = useState<Tab>('setup');
  const [isLoading, setIsLoading] = useState(false);
  const [showDisclosure, setShowDisclosure] = useState(false);

  // Project State
  const [bookTitle, setBookTitle] = useState('');
  const [genre, setGenre] = useState('Fiction');
  const [targetWordCount, setTargetWordCount] = useState('50000');
  
  // Content State
  const [outline, setOutline] = useState('');
  const [chapters, setChapters] = useState<{number: string, title: string, content: string}[]>([]);
  const [currentChapter, setCurrentChapter] = useState({ number: '1', title: '', prompt: '' });
  const [blurb, setBlurb] = useState('');
  const [authorBio, setAuthorBio] = useState('');
  const [pricing, setPricing] = useState('');
  const [marketingHooks, setMarketingHooks] = useState('');
  const [compiledManuscript, setCompiledManuscript] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverPrompt, setCoverPrompt] = useState('');

  const handleGenerateOutline = async () => {
    setIsLoading(true);
    try {
      const result = await generateOutline(bookTitle, genre, targetWordCount);
      setOutline(result || '');
      setShowDisclosure(true);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateChapter = async () => {
    setIsLoading(true);
    try {
      const context = chapters.map(c => `Chapter ${c.number}: ${c.title}`).join('\n');
      // Step A: Scribe Writes
      const draft = await generateChapter(currentChapter.number, currentChapter.title, currentChapter.prompt, context);
      
      if (draft) {
        // Step B: Critic Edits
        const finalChapter = await editChapter(draft);
        
        if (finalChapter) {
          setChapters([...chapters, { number: currentChapter.number, title: currentChapter.title, content: finalChapter }]);
          setShowDisclosure(true);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompileManuscript = async () => {
    setIsLoading(true);
    try {
      const result = await compileManuscript(chapters.map(c => ({ title: c.title, content: c.content })));
      setCompiledManuscript(result || '');
      setShowDisclosure(true);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateMarketing = async () => {
    setIsLoading(true);
    try {
      const blurbResult = await generateBackCoverBlurb(bookTitle, genre, outline, marketingHooks);
      setBlurb(blurbResult || '');
      const imgResult = await generateCoverImage(coverPrompt || genre);
      setCoverImage(imgResult);
      setShowDisclosure(true);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateAuthor = async () => {
    setIsLoading(true);
    try {
      const result = await generateAuthorBio("Brett Sjoberg");
      setAuthorBio(result || '');
      setShowDisclosure(true);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetPricing = async () => {
    setIsLoading(true);
    try {
      const totalWords = chapters.reduce((acc, c) => acc + c.content.split(/\s+/).length, 0);
      const result = await getPricingRecommendation(genre, totalWords);
      setPricing(result || '');
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportManuscript = () => {
    const content = compiledManuscript || chapters.map(c => `CHAPTER ${c.number}: ${c.title}\n\n${c.content}`).join('\n\n---\n\n');
    const fullText = `---
title: "${bookTitle}"
author: "Brett Sjoberg"
language: en-AUS
---

# ${bookTitle}
**Genre:** ${genre}

## Table of Contents
${chapters.map(c => `- Chapter ${c.number}: ${c.title}`).join('\n')}

---

${content}

---
# About the Author
${authorBio}
    `;
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bookTitle.replace(/\s+/g, '_')}_Manuscript.txt`;
    a.click();
  };

  const exportEpub = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/export/epub', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: bookTitle,
          author: "Brett Sjoberg",
          chapters: chapters.map(c => ({ title: c.title, content: c.content })),
          coverImage: coverImage
        }),
      });

      if (!response.ok) throw new Error('Failed to generate EPUB');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bookTitle.replace(/\s+/g, '_')}.epub`;
      a.click();
    } catch (error) {
      console.error(error);
      alert('Failed to export EPUB. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex font-sans text-stone-900">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-stone-200 flex flex-col shrink-0">
        <div className="p-6 border-bottom border-stone-100">
          <div className="flex items-center gap-3 text-emerald-700 mb-1">
            <Book className="w-6 h-6" />
            <h1 className="font-bold tracking-tight">KDP Master</h1>
          </div>
          <p className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold">2026 Publishing Suite</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavButton active={activeTab === 'setup'} onClick={() => setActiveTab('setup')} icon={<Save className="w-4 h-4" />} label="Project Setup" />
          <NavButton active={activeTab === 'workforce'} onClick={() => setActiveTab('workforce')} icon={<Users className="w-4 h-4" />} label="AI Workforce" />
          <NavButton active={activeTab === 'outline'} onClick={() => setActiveTab('outline')} icon={<List className="w-4 h-4" />} label="Book Outline" />
          <NavButton active={activeTab === 'manuscript'} onClick={() => setActiveTab('manuscript')} icon={<FileText className="w-4 h-4" />} label="Manuscript" />
          <NavButton active={activeTab === 'marketing'} onClick={() => setActiveTab('marketing')} icon={<ImageIcon className="w-4 h-4" />} label="Cover & Blurb" />
          <NavButton active={activeTab === 'author'} onClick={() => setActiveTab('author')} icon={<User className="w-4 h-4" />} label="Author Bio" />
          <NavButton active={activeTab === 'pricing'} onClick={() => setActiveTab('pricing')} icon={<DollarSign className="w-4 h-4" />} label="Pricing & Export" />
          <NavButton active={activeTab === 'resources'} onClick={() => setActiveTab('resources')} icon={<Database className="w-4 h-4" />} label="KDP Resources" />
        </nav>

        <div className="p-4 border-t border-stone-100">
          <AnimatePresence>
            {showDisclosure && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                <div className="flex gap-2 text-amber-800 mb-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-tighter">AI Disclosure Required</span>
                </div>
                <p className="text-[9px] text-amber-700 leading-tight">Must select "AI-generated" on KDP Bookshelf.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8 lg:p-12">
        <div className="max-w-5xl mx-auto space-y-8">
          
          {activeTab === 'setup' && (
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <header>
                <h2 className="text-2xl font-bold">Project Setup</h2>
                <p className="text-stone-500">Define the core metadata for your KDP project.</p>
              </header>
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-400">Book Title</label>
                  <input type="text" value={bookTitle} onChange={e => setBookTitle(e.target.value)} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Enter title..." />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-400">Genre</label>
                  <select value={genre} onChange={e => setGenre(e.target.value)} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500">
                    <option>Fiction</option>
                    <option>Non-Fiction</option>
                    <option>Self-Help</option>
                    <option>Business</option>
                    <option>Sci-Fi/Fantasy</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-400">Target Word Count</label>
                  <input type="number" value={targetWordCount} onChange={e => setTargetWordCount(e.target.value)} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
            </section>
          )}

          {activeTab === 'workforce' && <WorkforceDashboard />}

          {activeTab === 'outline' && (
            <section className="space-y-6">
              <div className="flex justify-between items-end">
                <header>
                  <h2 className="text-2xl font-bold">Book Outline</h2>
                  <p className="text-stone-500">Generate a structured roadmap for your manuscript.</p>
                </header>
                <button onClick={handleGenerateOutline} disabled={isLoading || !bookTitle} className="px-6 py-2 bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-2 hover:bg-emerald-800 transition-colors disabled:bg-stone-300">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><List className="w-4 h-4" /> Generate Outline</>}
                </button>
              </div>
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 min-h-[400px]">
                {outline ? (
                  <div className="prose prose-stone max-w-none">
                    <Markdown remarkPlugins={[remarkGfm]}>{outline}</Markdown>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-stone-400 italic">No outline generated yet.</div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'manuscript' && (
            <section className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 space-y-4">
                    <h3 className="font-bold">Draft New Chapter</h3>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-stone-400">Chapter #</label>
                      <input type="text" value={currentChapter.number} onChange={e => setCurrentChapter({...currentChapter, number: e.target.value})} className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-stone-400">Title</label>
                      <input type="text" value={currentChapter.title} onChange={e => setCurrentChapter({...currentChapter, title: e.target.value})} className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-stone-400">Prompt</label>
                      <textarea rows={4} value={currentChapter.prompt} onChange={e => setCurrentChapter({...currentChapter, prompt: e.target.value})} className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg outline-none resize-none" />
                    </div>
                    <button onClick={handleGenerateChapter} disabled={isLoading || !currentChapter.title} className="w-full py-3 bg-emerald-700 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-1">
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <Send className="w-4 h-4" /> 
                            <span>Write & Edit Chapter</span>
                          </div>
                          <span className="text-[9px] opacity-70 font-normal">Scribe + Critic Agents</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 space-y-4">
                    <h3 className="font-bold flex items-center gap-2"><List className="w-4 h-4" /> Table of Contents</h3>
                    <div className="space-y-2">
                      {chapters.map((c, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-stone-50 rounded-lg text-sm">
                          <span className="font-medium">Ch {c.number}: {c.title}</span>
                          <span className="text-[10px] text-stone-400">{c.content.split(/\s+/).length} words</span>
                        </div>
                      ))}
                      {chapters.length === 0 && <p className="text-xs text-stone-400 italic">No chapters drafted yet.</p>}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Manuscript Preview</span>
                    <button 
                      onClick={handleCompileManuscript} 
                      disabled={isLoading || chapters.length === 0}
                      className="px-3 py-1 bg-stone-900 text-white rounded-lg text-[10px] font-bold flex items-center gap-2 hover:bg-stone-800 transition-colors disabled:bg-stone-200"
                    >
                      {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Layout className="w-3 h-3" /> Typeset Manuscript (Typesetter Agent)</>}
                    </button>
                  </div>
                  <div className="bg-stone-200 rounded-3xl p-8 min-h-[600px] overflow-y-auto max-h-[800px] custom-scrollbar">
                    <div className="kdp-preview shadow-xl">
                      {compiledManuscript ? (
                        <div className="prose prose-stone max-w-none">
                          <Markdown remarkPlugins={[remarkGfm]}>{compiledManuscript}</Markdown>
                        </div>
                      ) : chapters.length > 0 ? (
                        chapters.map((c, i) => (
                          <div key={i} className="mb-12">
                            <Markdown remarkPlugins={[remarkGfm]}>{c.content}</Markdown>
                          </div>
                        ))
                      ) : (
                        <div className="h-full flex items-center justify-center text-stone-400 italic py-20">Start drafting to see your manuscript.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'marketing' && (
            <section className="space-y-6">
              <header>
                <h2 className="text-2xl font-bold">Cover & Marketing</h2>
                <p className="text-stone-500">Design your front cover and write your back cover blurb.</p>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 space-y-6">
                  <h3 className="font-bold flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Front Cover Art</h3>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-stone-400">Art Style Prompt</label>
                    <textarea rows={3} value={coverPrompt} onChange={e => setCoverPrompt(e.target.value)} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none" placeholder="e.g. Minimalist noir, vibrant watercolor landscape..." />
                  </div>
                  <button onClick={handleGenerateMarketing} disabled={isLoading} className="w-full py-3 bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate Marketing Assets"}
                  </button>
                  {coverImage && (
                    <div className="aspect-[9/16] bg-stone-100 rounded-xl overflow-hidden border border-stone-200 shadow-inner">
                      <img src={coverImage} alt="Book Cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 space-y-6">
                  <h3 className="font-bold flex items-center gap-2"><FileText className="w-4 h-4" /> Back Cover Blurb</h3>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-stone-400">Marketing Hooks (from Spreadsheet)</label>
                    <textarea 
                      rows={3} 
                      value={marketingHooks} 
                      onChange={e => setMarketingHooks(e.target.value)} 
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none" 
                      placeholder="Paste hooks, target audience, or unique selling points from your 'Marketing' tab..." 
                    />
                  </div>
                  <div className="min-h-[200px] p-4 bg-stone-50 rounded-xl border border-stone-100 text-sm leading-relaxed italic text-stone-600">
                    {blurb || "Marketing blurb will appear here..."}
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'author' && (
            <section className="space-y-6">
              <div className="flex justify-between items-end">
                <header>
                  <h2 className="text-2xl font-bold">About the Author</h2>
                  <p className="text-stone-500">Generate a professional bio for Brett Sjoberg.</p>
                </header>
                <button onClick={handleGenerateAuthor} disabled={isLoading} className="px-6 py-2 bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-2">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate Bio"}
                </button>
              </div>
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200">
                <div className="flex items-start gap-8">
                  <div className="w-32 h-32 bg-stone-100 rounded-full flex items-center justify-center border border-stone-200 shrink-0">
                    <User className="w-12 h-12 text-stone-300" />
                  </div>
                  <div className="space-y-4 flex-1">
                    <h3 className="text-xl font-bold text-emerald-800">Brett Sjoberg</h3>
                    <div className="prose prose-stone max-w-none italic text-stone-600 leading-relaxed">
                      {authorBio || "Author bio will appear here..."}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'pricing' && (
            <section className="space-y-6">
              <header>
                <h2 className="text-2xl font-bold">Pricing & Export</h2>
                <p className="text-stone-500">Finalize your project for KDP upload.</p>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 space-y-6">
                  <h3 className="font-bold flex items-center gap-2"><DollarSign className="w-4 h-4" /> Pricing Recommendation</h3>
                  <button onClick={handleGetPricing} disabled={isLoading} className="w-full py-3 border-2 border-emerald-700 text-emerald-700 rounded-xl font-bold hover:bg-emerald-50 transition-colors">
                    Get Pricing Advice
                  </button>
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-sm text-emerald-900">
                    {pricing || "Pricing advice will appear here..."}
                  </div>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 space-y-6">
                  <h3 className="font-bold flex items-center gap-2"><Download className="w-4 h-4" /> Export Manuscript</h3>
                  <p className="text-sm text-stone-500">Download your complete manuscript as a formatted text file or a professional EPUB ebook.</p>
                  <div className="space-y-3">
                    <button onClick={exportManuscript} disabled={chapters.length === 0} className="w-full py-3 border-2 border-emerald-700 text-emerald-700 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-50 transition-all">
                      <Download className="w-4 h-4" /> Export .TXT Manuscript
                    </button>
                    <button onClick={exportEpub} disabled={isLoading || chapters.length === 0} className="w-full py-4 bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-emerald-700/20 hover:bg-emerald-800 transition-all">
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Download className="w-5 h-5" /> Export .EPUB Ebook</>}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'resources' && (
            <section className="space-y-6">
              <div className="flex justify-between items-end">
                <header>
                  <h2 className="text-2xl font-bold">KDP Resources</h2>
                  <p className="text-stone-500">External database of publishing resources and tools.</p>
                </header>
                <a 
                  href="https://docs.google.com/spreadsheets/d/195FbXcWV2B-QgyMmErjRSjuMV89HtMzLbcclrmq-wDA/edit#gid=1323942797" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2 border border-stone-200 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-50 transition-colors flex items-center gap-2"
                >
                  <Database className="w-3 h-3" />
                  Open Source Sheet
                </a>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden min-h-[800px]">
                <Sheet2SiteWidget />
              </div>
            </section>
          )}

        </div>
      </main>
    </div>
  );
}

function Sheet2SiteWidget() {
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Inject the script
    const script = document.createElement('script');
    script.src = "https://sheet2site.com/js/embedded.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup script if needed (optional, script might be needed for the div)
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div 
      ref={widgetRef}
      data-sheet2site="195FbXcWV2B-QgyMmErjRSjuMV89HtMzLbcclrmq-wDA&g=1&e=1"
      className="w-full h-full"
    >
      {/* The widget will be injected here by the script */}
      <div className="p-12 text-center text-stone-400 italic">
        Loading KDP Resources...
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
        active 
          ? 'bg-emerald-50 text-emerald-700 shadow-sm' 
          : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'
      }`}
    >
      <span className={active ? 'text-emerald-600' : 'text-stone-400'}>{icon}</span>
      {label}
    </button>
  );
}
