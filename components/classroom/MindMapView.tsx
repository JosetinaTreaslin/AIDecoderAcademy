"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ZoomIn, ZoomOut, Maximize2, X, BookOpen } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MindMapNode {
  id:            string;
  label:         string;
  explanation?:  string;
  imageUrl?:     string;
  children?:     MindMapNode[];
}

interface LayoutEntry {
  node:        MindMapNode;
  x:           number;
  y:           number;
  depth:       number;       // 0=center,1=branch,2=topic,3=leaf
  parentId:    string | null;
  branchIndex: number;
  angle:       number;
}

interface EdgeEntry {
  id:          string;
  x1: number; y1: number;
  x2: number; y2: number;
  color:       string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const BRANCH_COLORS = [
  { primary: "#60A5FA", bg: "#DBEAFE", text: "#1E40AF", stroke: "#93C5FD" },
  { primary: "#34D399", bg: "#D1FAE5", text: "#065F46", stroke: "#6EE7B7" },
  { primary: "#FB923C", bg: "#FFEDD5", text: "#9A3412", stroke: "#FDBA74" },
  { primary: "#A78BFA", bg: "#EDE9FE", text: "#5B21B6", stroke: "#C4B5FD" },
  { primary: "#F472B6", bg: "#FCE7F3", text: "#9D174D", stroke: "#F9A8D4" },
  { primary: "#FBBF24", bg: "#FEF3C7", text: "#92400E", stroke: "#FCD34D" },
];

const R_BRANCH = 165;
const R_TOPIC  = 295;
const R_LEAF   = 415;

const NODE_W: Record<number, number> = { 0: 120, 1: 132, 2: 114, 3: 104 };
const NODE_H: Record<number, number> = { 0: 120, 1: 40,  2: 35,  3: 32  };

// ── Layout ─────────────────────────────────────────────────────────────────────

function computeLayout(root: MindMapNode): { nodes: LayoutEntry[]; edges: EdgeEntry[] } {
  const nodes: LayoutEntry[] = [];
  const edges: EdgeEntry[] = [];

  nodes.push({ node: root, x: 0, y: 0, depth: 0, parentId: null, branchIndex: -1, angle: 0 });

  const branches = root.children ?? [];
  const N = branches.length;

  branches.forEach((branch, bi) => {
    const color = BRANCH_COLORS[bi % BRANCH_COLORS.length];
    const angle = (2 * Math.PI / N) * bi - Math.PI / 2;
    const bx = Math.cos(angle) * R_BRANCH;
    const by = Math.sin(angle) * R_BRANCH;

    nodes.push({ node: branch, x: bx, y: by, depth: 1, parentId: root.id, branchIndex: bi, angle });
    edges.push({ id: `${root.id}-${branch.id}`, x1: 0, y1: 0, x2: bx, y2: by, color: color.stroke });

    const topics = branch.children ?? [];
    const M = topics.length;
    const topicSpread = M > 1 ? Math.min(Math.PI * 0.60, (M - 1) * 0.52) : 0;

    topics.forEach((topic, ti) => {
      const ta = angle + (M > 1 ? -topicSpread / 2 + topicSpread * ti / (M - 1) : 0);
      const tx = Math.cos(ta) * R_TOPIC;
      const ty = Math.sin(ta) * R_TOPIC;

      nodes.push({ node: topic, x: tx, y: ty, depth: 2, parentId: branch.id, branchIndex: bi, angle: ta });
      edges.push({ id: `${branch.id}-${topic.id}`, x1: bx, y1: by, x2: tx, y2: ty, color: color.stroke });

      const leaves = topic.children ?? [];
      const L = leaves.length;
      const leafSpread = L > 1 ? Math.min(Math.PI * 0.20, (L - 1) * 0.22) : 0;

      leaves.forEach((leaf, li) => {
        const la = ta + (L > 1 ? -leafSpread / 2 + leafSpread * li / (L - 1) : 0);
        const lx = Math.cos(la) * R_LEAF;
        const ly = Math.sin(la) * R_LEAF;

        nodes.push({ node: leaf, x: lx, y: ly, depth: 3, parentId: topic.id, branchIndex: bi, angle: la });
        edges.push({ id: `${topic.id}-${leaf.id}`, x1: tx, y1: ty, x2: lx, y2: ly, color: color.stroke });
      });
    });
  });

  return { nodes, edges };
}

function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return `M ${x1} ${y1} C ${x1 + dx * 0.45} ${y1 + dy * 0.1} ${x2 - dx * 0.45} ${y2 - dy * 0.1} ${x2} ${y2}`;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  topic:   string;
  root:    MindMapNode;
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function MindMapView({ topic, root, onClose }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const [scale,    setScale]    = useState(0.85);
  const [pan,      setPan]      = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const [expanded,     setExpanded]     = useState<Set<string>>(new Set());
  const [focusBranch,  setFocusBranch]  = useState<number | null>(null);

  // Leaf info card — shown as a centered overlay when a leaf is clicked
  const [activeLeaf,    setActiveLeaf]    = useState<{ node: MindMapNode; color: typeof BRANCH_COLORS[number] } | null>(null);

  const { nodes, edges } = computeLayout(root);

  // Centre view on mount
  useEffect(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    setPan({ x: width / 2, y: height / 2 });
  }, []);

  // Visible node ids
  const visibleIds = new Set<string>();
  nodes.forEach(n => {
    if (n.depth === 0 || n.depth === 1) { visibleIds.add(n.node.id); return; }
    if (n.parentId && expanded.has(n.parentId)) visibleIds.add(n.node.id);
  });

  // Edge visibility: child node must be visible
  const edgeVisible = (e: EdgeEntry): boolean => {
    const childNode = nodes.find(n => Math.abs(n.x - e.x2) < 1 && Math.abs(n.y - e.y2) < 1);
    return childNode ? visibleIds.has(childNode.node.id) : false;
  };

  // ── Interactions ────────────────────────────────────────────────────────────

  const handleNodeClick = (entry: LayoutEntry) => {
    const { node, depth, branchIndex } = entry;

    // Show info card for any terminal node (depth 3, or depth 2 with no children)
    const isTerminal = depth === 3 || (depth === 2 && (node.children?.length ?? 0) === 0);
    if (isTerminal && node.explanation) {
      const color = BRANCH_COLORS[branchIndex % BRANCH_COLORS.length];
      setActiveLeaf({ node, color });
      return;
    }
    if (depth === 3) {
      const color = BRANCH_COLORS[branchIndex % BRANCH_COLORS.length];
      setActiveLeaf({ node, color });
      return;
    }

    if (depth === 1) {
      setFocusBranch(prev => prev === branchIndex ? null : branchIndex);
    }

    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(node.id)) {
        const toRemove = new Set<string>();
        const collect = (id: string) => {
          toRemove.add(id);
          nodes.forEach(n => { if (n.parentId === id) collect(n.node.id); });
        };
        collect(node.id);
        toRemove.forEach(id => next.delete(id));
      } else {
        next.add(node.id);
      }
      return next;
    });
  };

  // ── Pan & Zoom ──────────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor   = e.deltaY < 0 ? 1.12 : 0.9;
    const newScale = Math.max(0.25, Math.min(3, scale * factor));
    const rect     = containerRef.current!.getBoundingClientRect();
    const cx       = e.clientX - rect.left;
    const cy       = e.clientY - rect.top;
    setPan(prev => ({
      x: cx - (cx - prev.x) * (newScale / scale),
      y: cy - (cy - prev.y) * (newScale / scale),
    }));
    setScale(newScale);
  }, [scale]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({
      x: dragStart.current.px + e.clientX - dragStart.current.mx,
      y: dragStart.current.py + e.clientY - dragStart.current.my,
    });
  }, [dragging]);

  const handleMouseUp = () => setDragging(false);

  const resetView = () => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    setPan({ x: width / 2, y: height / 2 });
    setScale(1);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex flex-col"
      style={{ zIndex: 60, background: "rgba(4,6,20,0.94)", backdropFilter: "blur(14px)" }}
    >
      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 20 }}>🧠</span>
          <div>
            <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, fontWeight: 700,
              color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              MIND MAP
            </p>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 16, color: "#fff", lineHeight: 1.2 }}>
              {topic}
            </h2>
          </div>
        </div>
        <button onClick={onClose}
          className="flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          style={{ width: 32, height: 32, color: "rgba(255,255,255,0.5)" }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Canvas ── */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden select-none"
        style={{
          cursor: dragging ? "grabbing" : "grab",
          background: "radial-gradient(ellipse at center, #0d1535 0%, #060916 100%)",
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Dot-grid background */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }} />

        {/* World transform */}
        <div style={{
          position: "absolute", left: 0, top: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: "0 0",
        }}>
          {/* SVG curves */}
          <svg style={{
            position: "absolute", left: -1200, top: -900, width: 2400, height: 1800,
            pointerEvents: "none", overflow: "visible",
          }}>
            <AnimatePresence>
              {edges.map(edge => {
                if (!edgeVisible(edge)) return null;
                return (
                  <motion.path
                    key={edge.id}
                    d={bezierPath(edge.x1, edge.y1, edge.x2, edge.y2)}
                    stroke={edge.color}
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 0.75 }}
                    exit={{ pathLength: 0, opacity: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                  />
                );
              })}
            </AnimatePresence>
          </svg>

          {/* Nodes */}
          <AnimatePresence>
            {nodes.map(entry => {
              if (!visibleIds.has(entry.node.id)) return null;

              const { node, x, y, depth, branchIndex } = entry;
              const color      = depth === 0 ? null : BRANCH_COLORS[branchIndex % BRANCH_COLORS.length];
              const hasChildren = (node.children?.length ?? 0) > 0;
              const isExpanded  = expanded.has(node.id);
              const dimmed      = focusBranch !== null && depth > 0 && branchIndex !== focusBranch;
              const w = NODE_W[depth] ?? 110;
              const h = NODE_H[depth] ?? 36;

              return (
                <motion.div
                  key={node.id}
                  data-node="true"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: dimmed ? 0.85 : 1, opacity: dimmed ? 0.25 : 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22 }}
                  onClick={(e) => { e.stopPropagation(); handleNodeClick(entry); }}
                  style={{
                    position: "absolute",
                    left: x - w / 2,
                    top:  y - (depth === 0 ? w / 2 : h / 2),
                    width: w,
                    height: depth === 0 ? w : h,
                    cursor: "pointer",
                    zIndex: depth === 0 ? 10 : 5,
                  }}
                >
                  {/* Center node */}
                  {depth === 0 && (
                    <div style={{
                      width: w, height: w, borderRadius: "50%",
                      background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)",
                      border: "3px solid rgba(96,165,250,0.6)",
                      boxShadow: "0 0 30px rgba(96,165,250,0.35), 0 0 60px rgba(96,165,250,0.15)",
                      display: "flex", alignItems: "center", justifyContent: "center", padding: 12, textAlign: "center",
                    }}>
                      <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 11, color: "#fff", lineHeight: 1.3 }}>
                        {node.label}
                      </span>
                    </div>
                  )}

                  {/* Branch node */}
                  {depth === 1 && color && (
                    <motion.div
                      animate={hasChildren && !isExpanded ? { scale: [1, 1.04, 1] } : {}}
                      transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                      style={{
                        width: "100%", height: "100%", borderRadius: 100,
                        background: color.bg,
                        border: `2.5px solid ${color.primary}`,
                        boxShadow: `0 4px 18px ${color.primary}40`,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "0 10px",
                      }}>
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 11, color: color.text, lineHeight: 1.2, textAlign: "center" }}>
                        {node.label}
                      </span>
                      {hasChildren && (
                        <span style={{ fontSize: 11, color: color.primary, flexShrink: 0, fontWeight: 900 }}>
                          {isExpanded ? "−" : "+"}
                        </span>
                      )}
                    </motion.div>
                  )}

                  {/* Topic node */}
                  {depth === 2 && color && (
                    <div style={{
                      width: "100%", height: "100%", borderRadius: 100,
                      background: "rgba(255,255,255,0.06)",
                      border: `1.5px solid ${color.primary}80`,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "0 10px",
                    }}>
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 10, color: "#e2e8f0", lineHeight: 1.2, textAlign: "center" }}>
                        {node.label}
                      </span>
                      {hasChildren && (
                        <span style={{ fontSize: 9, color: color.primary, flexShrink: 0, fontWeight: 900 }}>
                          {isExpanded ? "−" : "+"}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Leaf node — sticky-note style with "tap to read" hint */}
                  {depth === 3 && color && (
                    <motion.div
                      whileHover={{ scale: 1.1, boxShadow: `0 6px 20px ${color.primary}60` }}
                      whileTap={{ scale: 0.95 }}
                      style={{
                        width: "100%", height: "100%", borderRadius: 8,
                        background: color.bg,
                        border: `2px solid ${color.primary}`,
                        boxShadow: `2px 3px 10px rgba(0,0,0,0.3), 0 0 0 0 ${color.primary}`,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "0 8px",
                        cursor: "pointer",
                      }}>
                      <BookOpen style={{ width: 9, height: 9, color: color.primary, flexShrink: 0 }} />
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 9.5, color: color.text, lineHeight: 1.2, textAlign: "center" }}>
                        {node.label}
                      </span>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* ── Navigation Controls ── */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1.5" style={{ zIndex: 20 }}>
          {[
            { icon: <ZoomIn className="w-3.5 h-3.5" />,    action: () => setScale(s => Math.min(3, s * 1.2)) },
            { icon: <ZoomOut className="w-3.5 h-3.5" />,   action: () => setScale(s => Math.max(0.25, s / 1.2)) },
            { icon: <Maximize2 className="w-3.5 h-3.5" />, action: resetView },
          ].map(({ icon, action }, i) => (
            <button key={i} onClick={action} data-node="true"
              className="flex items-center justify-center rounded-xl hover:bg-white/15 transition-all"
              style={{
                width: 32, height: 32, color: "rgba(255,255,255,0.6)",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                backdropFilter: "blur(8px)",
              }}>
              {icon}
            </button>
          ))}
        </div>

        {/* ── Hint ── */}
        <div className="absolute bottom-4 left-4" style={{ zIndex: 20, pointerEvents: "none" }}>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "rgba(255,255,255,0.22)" }}>
            Click branches to expand · Click <BookOpen style={{ display: "inline", width: 9, height: 9 }} /> leaf nodes for details · Drag to pan · Scroll to zoom
          </p>
        </div>

        {/* ── Leaf Info Card — centered modal overlay ── */}
        <AnimatePresence>
          {activeLeaf && (
            <>
              {/* Backdrop — click outside to dismiss */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setActiveLeaf(null)}
                style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(0,0,0,0.5)" }}
              />

              {/* Centering shell — flex, no transform conflict with Framer Motion */}
              <div style={{
                position: "absolute", inset: 0, zIndex: 31,
                display: "flex", alignItems: "center", justifyContent: "center",
                pointerEvents: "none",
              }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.88, y: 24 }}
                  animate={{ opacity: 1, scale: 1,    y: 0  }}
                  exit={{   opacity: 0, scale: 0.88, y: 24  }}
                  transition={{ type: "spring", stiffness: 320, damping: 26 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    pointerEvents: "auto",
                    width: "min(440px, 88vw)",
                    borderRadius: 20,
                    overflow: "hidden",
                    background: `linear-gradient(160deg, ${activeLeaf.color.bg} 0%, #ffffff 65%)`,
                    border: `2px solid ${activeLeaf.color.primary}`,
                    boxShadow: `0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px ${activeLeaf.color.primary}40`,
                  }}
                >
                {/* Card header stripe */}
                <div style={{
                  height: 6,
                  background: `linear-gradient(90deg, ${activeLeaf.color.primary}, ${activeLeaf.color.stroke})`,
                }} />

                {/* Concept illustration — pre-generated server-side */}
                {activeLeaf.node.imageUrl && (
                  <div style={{ width: "100%", aspectRatio: "16/7", overflow: "hidden", background: activeLeaf.color.bg }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeLeaf.node.imageUrl}
                      alt={activeLeaf.node.label}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  </div>
                )}

                <div style={{ padding: "20px 22px 24px" }}>
                  {/* Icon + label */}
                  <div className="flex items-start gap-3 mb-4">
                    <div style={{
                      width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                      background: activeLeaf.color.primary,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: `0 4px 14px ${activeLeaf.color.primary}55`,
                    }}>
                      <BookOpen style={{ width: 18, height: 18, color: "#fff" }} />
                    </div>
                    <div>
                      <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, fontWeight: 700,
                        color: activeLeaf.color.primary, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>
                        Concept
                      </p>
                      <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 18,
                        color: activeLeaf.color.text, lineHeight: 1.25, margin: 0 }}>
                        {activeLeaf.node.label}
                      </h3>
                    </div>
                    {/* Close */}
                    <button
                      onClick={() => setActiveLeaf(null)}
                      data-node="true"
                      style={{
                        marginLeft: "auto", flexShrink: 0, width: 28, height: 28,
                        borderRadius: "50%", border: `1px solid ${activeLeaf.color.primary}50`,
                        background: "rgba(255,255,255,0.7)", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: activeLeaf.color.text,
                      }}>
                      <X style={{ width: 13, height: 13 }} />
                    </button>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: `${activeLeaf.color.primary}25`, marginBottom: 16 }} />

                  {/* Explanation */}
                  <p style={{
                    fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 450,
                    color: "#1e293b", lineHeight: 1.75, margin: 0,
                  }}>
                    {activeLeaf.node.explanation ?? "No explanation available for this concept."}
                  </p>
                </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
