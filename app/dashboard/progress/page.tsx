"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MoreHorizontal, Search, Plus, Folder, Star, Grid } from "lucide-react";
import Link from "next/link";
import { cn, formatDate, truncate } from "@/lib/utils";
import { AudioPlayer, type AudioData } from "@/components/playground/AudioPlayer";
import { SlideCarousel, type SlideData } from "@/components/playground/SlideCarousel";
import { getArena } from "@/lib/arenas";
import type { Creation, Project, OutputType, Profile } from "@/types";

const TYPE_META: Record<OutputType, { label: string; icon: string; color: string }> = {
  text:   { label: "Text",   icon: "T",   color: "border-white/[0.12] bg-white/[0.08] text-[#00D4FF]"  },
  json:   { label: "JSON",   icon: "{}",  color: "border-white/[0.12] bg-white/[0.08] text-[#FF6B2B]"  },
  image:  { label: "Image",  icon: "Img", color: "border-[#00D4FF]/35 bg-[#00D4FF]/12 text-[#7AEFFF]"  },
  audio:  { label: "Audio",  icon: "♪",   color: "border-[#FF2D78]/35 bg-[#FF2D78]/12 text-[#FF8FB8]"  },
  slides: { label: "Slides", icon: "▦",   color: "border-[#7C3AED]/40 bg-[#7C3AED]/18 text-[#C4B5FD]"  },
  video:  { label: "Video",  icon: "▶",   color: "border-white/[0.1] bg-white/[0.05] text-white/40"    },
};

export default function ProgressPage() {
  const [creations,      setCreations]      = useState<Creation[]>([]);
  const [projects,       setProjects]       = useState<Project[]>([]);
  const [activeFilter,   setActiveFilter]   = useState<string>("all");
  const [search,         setSearch]         = useState("");
  const [loading,        setLoading]        = useState(true);
  const [sort,           setSort]           = useState<"recent" | "oldest">("recent");
  const [newProjectName, setNewProjectName] = useState("");
  const [addingProject,  setAddingProject]  = useState(false);
  const [profile,        setProfile]        = useState<Profile | null>(null);

  useEffect(() => {
    fetch("/api/profile").then(r => r.ok ? r.json() : { profile: null })
      .then(({ profile }) => setProfile(profile)).catch(() => {});
  }, []);

  const arena = getArena(profile?.active_arena ?? 1);

  const fetchCreations = useCallback((filter = activeFilter, q = search, s = sort) => {
    const params = new URLSearchParams();
    if (filter === "unorganized")           params.set("project_id", "unorganized");
    else if (filter.startsWith("project:")) params.set("project_id", filter.replace("project:", ""));
    else if (filter !== "all" && filter !== "favourites") params.set("output_type", filter);
    if (q) params.set("search", q);

    fetch(`/api/creations?${params}`)
      .then(r => r.json())
      .then(({ creations }) => {
        let list: Creation[] = creations ?? [];
        if (filter === "favourites") list = list.filter(c => c.is_favourite);
        if (s === "oldest") list = [...list].reverse();
        setCreations(list);
        setLoading(false);
      });
  }, [activeFilter, search, sort]);

  const fetchProjects = useCallback(() => {
    fetch("/api/projects").then(r => r.json()).then(({ projects }) => setProjects(projects ?? []));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/creations").then(r => r.json()),
      fetch("/api/projects").then(r => r.json()),
    ]).then(([{ creations }, { projects }]) => {
      setCreations(creations ?? []);
      setProjects(projects ?? []);
      setLoading(false);
    });
  }, []); // eslint-disable-line

  useEffect(() => { fetchCreations(activeFilter, search, sort); }, [activeFilter, sort]); // eslint-disable-line

  const handleSearch = (q: string) => { setSearch(q); fetchCreations(activeFilter, q, sort); };

  const toggleFav = async (c: Creation) => {
    await fetch("/api/creations", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, is_favourite: !c.is_favourite }),
    });
    setCreations(prev => prev.map(x => x.id === c.id ? { ...x, is_favourite: !x.is_favourite } : x));
  };

  const deleteCreation = async (id: string) => {
    await fetch("/api/creations", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setCreations(prev => prev.filter(c => c.id !== id));
  };

  const moveToProject = async (id: string, projectId: string) => {
    setCreations(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, project_id: projectId } : c);
      if (activeFilter.startsWith("project:")) {
        const pid = activeFilter.replace("project:", "");
        return updated.filter(c => c.project_id === pid);
      }
      if (activeFilter === "unorganized") return updated.filter(c => !c.project_id);
      return updated;
    });
    await fetch("/api/creations", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, project_id: projectId }),
    });
    fetchCreations(activeFilter, search, sort);
    fetchProjects();
  };

  const createProject = async () => {
    if (!newProjectName.trim()) { setAddingProject(false); return; }
    const res = await fetch("/api/projects", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newProjectName.trim() }),
    });
    const { project } = await res.json();
    if (project) setProjects(prev => [project, ...prev]);
    setNewProjectName(""); setAddingProject(false);
  };

  const navItems = [
    { id: "all",         label: "All Creations", icon: <Grid size={13}/> },
    { id: "unorganized", label: "Unorganized",   icon: <Folder size={13}/> },
    { id: "favourites",  label: "Favourites",    icon: <Star size={13}/> },
  ];

  return (
    <div className="relative flex min-h-0 flex-1 text-white" style={{ height: "100dvh", minHeight: 0 }}>

      {/* ── Left sidebar ── */}
      <aside
        className="relative z-10 hidden md:flex w-56 border-r flex-col py-5 flex-shrink-0"
        style={{
          background:   "rgba(8,8,15,0.55)",
          backdropFilter: "blur(24px)",
          borderColor:  "rgba(255,255,255,0.07)",
        }}
      >
        <div className="px-4 mb-5">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Library</p>
          <nav className="flex flex-col gap-1">
            {navItems.map(item => (
              <button key={item.id} onClick={() => setActiveFilter(item.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-display font-bold transition-all text-left",
                  activeFilter === item.id ? "text-[#08080F]" : "text-white/40 hover:text-white hover:bg-white/[0.06]"
                )}
                style={activeFilter === item.id ? {
                  background: arena.accent,
                  boxShadow:  `0 0 16px ${arena.accentGlow}`,
                } : {}}>
                {item.icon} {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="px-4 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">My Projects</p>
            <button onClick={() => setAddingProject(true)}
              className="w-5 h-5 rounded flex items-center justify-center text-white/30 hover:text-white transition-all">
              <Plus size={12}/>
            </button>
          </div>

          {addingProject && (
            <input autoFocus value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") createProject();
                if (e.key === "Escape") { setAddingProject(false); setNewProjectName(""); }
              }}
              onBlur={createProject}
              placeholder="Project name…"
              className="w-full px-3 py-1.5 rounded-lg text-xs focus:outline-none mb-2 bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25"
              style={{ borderColor: arena.accent + "60" }}
            />
          )}

          <div className="flex flex-col gap-1">
            {projects.map((p, pi) => (
              <button key={p.id} onClick={() => setActiveFilter(`project:${p.id}`)}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-xl text-sm font-display font-bold transition-all",
                  activeFilter === `project:${p.id}` ? "text-[#08080F]" : "text-white/40 hover:text-white hover:bg-white/[0.06]"
                )}
                style={activeFilter === `project:${p.id}` ? {
                  background: arena.accent,
                  boxShadow:  `0 0 14px ${arena.accentGlow}`,
                } : {}}>
                <span className="flex items-center gap-2 truncate">
                  <Folder size={13} className="flex-shrink-0"/>
                  <span className="truncate">{p.name}</span>
                </span>
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1",
                  activeFilter === `project:${p.id}` ? "bg-black/20 text-[#08080F]" : "bg-white/10 text-white/40"
                )}>
                  {p.creation_count ?? 0}
                </span>
              </button>
            ))}
            {projects.length === 0 && !addingProject && (
              <p className="text-xs text-white/25 px-1 py-1">No projects yet</p>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <div
          className="border-b px-6 py-3 flex items-center gap-3 flex-shrink-0"
          style={{
            background:    "rgba(8,8,15,0.50)",
            backdropFilter: "blur(20px)",
            borderColor:   "rgba(255,255,255,0.07)",
          }}
        >
          <div className="relative max-w-xs w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"/>
            <input value={search} onChange={e => handleSearch(e.target.value)}
              placeholder="Search your library..."
              className="w-full pl-9 pr-4 py-2 rounded-xl text-sm focus:outline-none bg-white/[0.06] border border-white/[0.09] text-white placeholder:text-white/25 transition-all"
              style={{ borderColor: search ? arena.accent + "60" : undefined }}
            />
          </div>

          <button onClick={() => setAddingProject(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-display font-bold text-sm border border-white/[0.09] text-white/50 hover:text-white hover:bg-white/[0.06] transition-all flex-shrink-0">
            <Plus size={14}/> New Project
          </button>

          <div className="ml-auto">
            <select value={sort} onChange={e => setSort(e.target.value as "recent" | "oldest")}
              className="text-xs font-display font-bold rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer border border-white/[0.09] bg-white/[0.06] text-white/60">
              <option value="recent">Recent First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        {/* Heading */}
        <div className="px-6 pt-5 pb-3 flex-shrink-0">
          <h1 className="font-display font-black text-2xl text-white">My Creations</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {loading ? "Loading…" : `${creations.length} creation${creations.length !== 1 ? "s" : ""} in your library`}
          </p>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="rounded-2xl border border-white/[0.06] h-52 animate-pulse"
                  style={{ background: "rgba(255,255,255,0.03)" }}/>
              ))}
            </div>
          ) : creations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="text-6xl mb-4 animate-float">🎨</div>
              <h3 className="font-display font-black text-lg text-white mb-1">Nothing here yet!</h3>
              <p className="text-white/45 text-sm max-w-sm">Save AI responses from the playground to build your library.</p>
              <Link href="/dashboard/playground"
                className="mt-6 inline-flex items-center justify-center font-display font-extrabold text-sm px-6 py-3 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]"
                style={{
                  background: arena.accent,
                  color: "#08080F",
                  boxShadow: `0 0 28px ${arena.accentGlow}`,
                }}>
                Open Playground
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {creations.map((creation, i) => (
                <CreationCard key={creation.id} creation={creation} index={i}
                  projects={projects}
                  onToggleFav={() => toggleFav(creation)}
                  onDelete={() => deleteCreation(creation.id)}
                  onMoveToProject={(pid) => moveToProject(creation.id, pid)}
                />
              ))}
            </div>
          )}
        </div>

        <div
          className="text-center py-3 text-xs text-white/20 border-t"
          style={{ background: "rgba(8,8,15,0.50)", borderColor: "rgba(255,255,255,0.06)" }}
        >
          Keep creating! Every interaction is a step toward mastering AI.
        </div>
      </div>
    </div>
  );
}

// ─── Creation Preview ─────────────────────────────────────────────────────────
function CreationPreview({ creation }: { creation: Creation }) {
  const { output_type, content } = creation;
  if (output_type === "image" && /^https?:\/\//i.test(content.trim())) {
    return (
      <div className="flex-1 overflow-hidden">
        <img src={content.trim()} alt={creation.title} className="w-full h-full object-cover"/>
      </div>
    );
  }
  if (output_type === "audio") {
    try {
      const data = JSON.parse(content) as AudioData;
      if (data?.url) return (
        <div className="flex-1 flex items-center px-2 py-1 overflow-hidden scale-90 origin-top">
          <div className="w-full"><AudioPlayer data={data}/></div>
        </div>
      );
    } catch { /* fall through */ }
  }
  if (output_type === "slides") {
    try {
      const data = JSON.parse(content) as SlideData;
      if (data?.sections) return (
        <div className="flex-1 w-full overflow-hidden scale-[0.82] origin-top-left" style={{ width: "122%" }}>
          <SlideCarousel data={data}/>
        </div>
      );
    } catch { /* fall through */ }
  }
  return (
    <p className="text-xs text-white/35 leading-relaxed line-clamp-3 p-1">
      {truncate(content.replace(/[#*`]/g, ""), 140)}
    </p>
  );
}

// ─── Creation Card ────────────────────────────────────────────────────────────
function CreationCard({
  creation, index, projects, onToggleFav, onDelete, onMoveToProject,
}: {
  creation: Creation; index: number; projects: Project[];
  onToggleFav: () => void; onDelete: () => void;
  onMoveToProject: (pid: string) => void;
}) {
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [moveOpen,   setMoveOpen]   = useState(false);
  const [projSearch, setProjSearch] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const meta = TYPE_META[creation.output_type] ?? TYPE_META.text;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false); setMoveOpen(false); setProjSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(projSearch.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className={cn(
        "rounded-2xl border border-white/[0.08] backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group relative",
        creation.output_type === "image"
          ? "hover:-translate-y-0.5 hover:border-[#00D4FF]/45 hover:shadow-[0_16px_48px_-12px_rgba(0,212,255,0.28)]"
          : creation.output_type === "audio"
            ? "hover:-translate-y-0.5 hover:border-[#FF2D78]/40 hover:shadow-[0_16px_48px_-12px_rgba(255,45,120,0.22)]"
            : creation.output_type === "slides"
              ? "hover:-translate-y-0.5 hover:border-[#7C3AED]/50 hover:shadow-[0_16px_48px_-12px_rgba(124,58,237,0.28)]"
              : "hover:-translate-y-0.5 hover:border-[rgba(124,58,237,0.35)] hover:shadow-[0_12px_40px_-12px_rgba(124,58,237,0.15)]"
      )}
      style={{ background: "rgba(255,255,255,0.04)" }}
    >
      {/* Preview area */}
      <div className="min-h-36 border-b border-white/[0.08] p-3 flex flex-col gap-2 relative"
        style={{ background: "rgba(8,8,15,0.45)" }}>
        {/* Type badge + menu */}
        <div className="flex items-center justify-between p-3 flex-shrink-0">
          <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border backdrop-blur-md", meta.color)}>
            <span className="font-mono">{meta.icon}</span> {meta.label}
          </span>

          <div className="relative" ref={menuRef}>
            <button onClick={() => { setMenuOpen(!menuOpen); setMoveOpen(false); }}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/[0.08] bg-black/30 text-white/50 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100 backdrop-blur-md">
              <MoreHorizontal size={14}/>
            </button>

            <AnimatePresence>
              {menuOpen && !moveOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1 bg-[#161625]/95 rounded-xl shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6)] border border-white/[0.1] py-1 z-50 w-48 backdrop-blur-xl">
                  <button onClick={() => { navigator.clipboard.writeText(creation.content); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
                    Copy content
                  </button>
                  <button onClick={() => setMoveOpen(true)}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center justify-between">
                    <span className="flex items-center gap-2"><Folder size={12}/> Move to project</span>
                    <span className="text-white/20">›</span>
                  </button>
                  <div className="border-t border-white/[0.07] mt-1 pt-1">
                    <button onClick={() => { onDelete(); setMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors">
                      Delete
                    </button>
                  </div>
                </motion.div>
              )}

              {menuOpen && moveOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1 bg-[#161625]/95 rounded-xl shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6)] border border-white/[0.1] z-50 w-56 backdrop-blur-xl">
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.07]">
                    <button onClick={() => setMoveOpen(false)} className="text-white/30 hover:text-white">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                    <span className="text-xs font-bold text-white/60">Move to project</span>
                  </div>
                  <div className="px-3 py-2 border-b border-white/[0.07]">
                    <div className="relative">
                      <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30"/>
                      <input autoFocus value={projSearch} onChange={e => setProjSearch(e.target.value)}
                        placeholder="Search projects..."
                        className="w-full pl-6 pr-2 py-1.5 text-xs rounded-lg border border-white/10 bg-white/[0.06] text-white placeholder:text-white/25 focus:outline-none"/>
                    </div>
                  </div>
                  <div className="py-1 max-h-40 overflow-y-auto">
                    <button onClick={() => { onMoveToProject(""); setMenuOpen(false); setMoveOpen(false); setProjSearch(""); }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M5 2v6M2 5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </div>
                      Move to My Creations
                    </button>
                    {filteredProjects.map(p => (
                      <button key={p.id} onClick={() => { onMoveToProject(p.id); setMenuOpen(false); setMoveOpen(false); setProjSearch(""); }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-2">
                        <div className={cn(
                          "w-5 h-5 rounded-md flex items-center justify-center",
                          ["bg-[#7C3AED]/25","bg-[#00D4FF]/15","bg-[#FF6B2B]/20","bg-[#00FF94]/12","bg-[#FF2D78]/15"][projects.indexOf(p) % 5]
                        )}>
                          <Folder size={10} className={["text-[#C4B5FD]","text-[#7AEFFF]","text-[#FFB38A]","text-[#7BFFC4]","text-[#FF8FB8]"][projects.indexOf(p) % 5]}/>
                        </div>
                        {p.name}
                        <span className="ml-auto text-[10px] text-white/30">{p.creation_count ?? 0}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <CreationPreview creation={creation}/>
      </div>

      {/* Footer */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-display font-bold text-sm text-white leading-snug truncate">{creation.title}</h3>
          <button onClick={onToggleFav}
            className={cn("flex-shrink-0 transition-all mt-0.5",
              creation.is_favourite ? "text-red-400" : "text-white/20 hover:text-red-400")}>
            <Heart size={14} fill={creation.is_favourite ? "currentColor" : "none"}/>
          </button>
        </div>
        <p className="text-[10px] text-white/30 mb-2">{formatDate(creation.created_at)}</p>
        {creation.prompt_used && (
          <div className="rounded-lg p-2 border border-white/[0.06]"
            style={{ background: "rgba(255,255,255,0.02)" }}>
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-wide mb-0.5">Prompt</p>
            <p className="text-[11px] text-white/35 leading-relaxed line-clamp-2">
              {truncate(creation.prompt_used, 80)}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
