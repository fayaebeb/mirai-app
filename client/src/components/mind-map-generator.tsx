import React, { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BrainCircuit,
  RefreshCw,
  Download,
  ZoomIn,
  ZoomOut,
  Home,
  HelpCircle,
  Info
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import * as d3 from "d3";
import { hierarchy, tree } from "d3-hierarchy";
import { motion } from "framer-motion";
import { toPng } from "html-to-image";
import type { MindMapNode } from "@/types/MindMap";
import { Grid } from 'ldrs/react'
import 'ldrs/react/Grid.css'
import { cn } from "@/lib/utils";
import { Spotlight } from "./ui/spotlight";
/** ------------------------------------------------------------------------------------------------
 *  MindMapGenerator
 *  – Radial mind-map generator with dynamic node sizing, collision-free layout & zoom / pan.
 *  – Uses d3-hierarchy radial tree; radius scales with depth, node width scales with label length.
 *  – Tailwind - 100% responsive, dark-theme friendly.
 *  ------------------------------------------------------------------------------------------------*/
export function MindMapGenerator() {
  // ──────────────────────────────────────── state ────────────────────────────────────────────────
  const [topic, setTopic] = useState("");
  const [mindMapData, setMindMapData] = useState<MindMapNode[] | null>(null);
  const [hierarchicalData, setHierarchicalData] = useState<any>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<any>(null);

  // Color scheme based on node depth
  const nodeColors = {
    0: "#3b82f6", // Root - blue
    1: "#8b5cf6", // Level 1 - purple
    2: "#ec4899", // Level 2 - pink
    3: "#f97316", // Level 3 - orange
    4: "#14b8a6", // Level 4 - teal
    default: "#64748b" // Default - slate
  };

  // ─────────────────────────────────── generate mind map api ─────────────────────────────────────
  const generateMindMap = useMutation({
    mutationFn: async (topic: string) => {
      const res = await apiRequest("POST", "/api/mind-map", { topic });
      return res.json();
    },
    onSuccess: (data) => {
      setMindMapData(data.nodes);
    },
    onError: (err) => console.error("Error generating mind map:", err)
  });

  // ────────────────────────────────── build hierarchy from flat ──────────────────────────────────
  useEffect(() => {
    if (!mindMapData) return;

    const build = (nodes: MindMapNode[], parentId: string | null = null): MindMapNode[] =>
      nodes.filter(n => n.parentId === parentId).map(n => ({ ...n, children: build(nodes, n.id) }));

    const roots = build(mindMapData);
    if (roots.length) setHierarchicalData(roots[0]);
  }, [mindMapData]);

  // ──────────────────────────────── render / update the svg ──────────────────────────────────────
  useEffect(() => {
    if (!hierarchicalData || !svgRef.current) return;

    const svgEl = svgRef.current;
    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const width = svgEl.clientWidth;
    const height = svgEl.clientHeight;

    // root group that will zoom / pan
    const g = svg.append("g")
      .attr("class", "mindmap-container");

    // zoom / pan behaviour with better controls & initial centering
    const zoomBehaviour = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
      });

    // Store zoom in ref for external controls
    zoomRef.current = zoomBehaviour;

    // Center the mindmap initially
    const initialTransform = d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8);
    svg.call(zoomBehaviour as any).call(zoomBehaviour.transform as any, initialTransform);

    // radial tree layout
    const root = hierarchy(hierarchicalData);
    const maxDepth = root.height + 1; // +1 to include root ring
    const layerSpacing = 160; // px – space between concentric rings
    const radius = maxDepth * layerSpacing;

    const treeLayout = tree<typeof root>()
      .size([2 * Math.PI, radius])
      .separation((a, b) => (a.parent === b.parent ? 1.8 : 2.6)); // Increased separation

    const nodes = treeLayout(root);

    // Add circles at each depth level as a visual guide
    for (let i = 1; i <= maxDepth; i++) {
      g.append("circle")
        .attr("r", i * layerSpacing)
        .attr("fill", "none")
        .attr("stroke", "#94a3b8")
        .attr("stroke-opacity", 0.15)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");
    }

    // ─────────────────────────────────────────── links ────────────────────────────────────────────
    g.append("g")
      .attr("class", "links")
      .attr("fill", "none")
      .attr("stroke", "#94a3b8")
      .attr("stroke-opacity", 0.5)
      .attr("stroke-width", 1.5)
      .selectAll("path")
      .data(nodes.links())
      .join("path")
      .attr("class", "link")
      .attr("d", d3.linkRadial<any, any>()
        .angle(d => d.x)
        .radius(d => d.y) as any)
      .attr("stroke-dasharray", function () {
        const length = (this as SVGPathElement).getTotalLength();
        return `${length} ${length}`;
      })
      .attr("stroke-dashoffset", function () {
        return (this as SVGPathElement).getTotalLength();
      })
      .transition()
      .duration(800)
      .delay((_, i) => i * 15)
      .attr("stroke-dashoffset", 0);

    // ─────────────────────────────────────────── nodes ────────────────────────────────────────────
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes.descendants())
      .join("g")
      .attr("class", "node")
      .attr("id", d => `node-${d.data.id}`)
      .attr("transform", d => `translate(${Math.sin(d.x) * d.y},${-Math.cos(d.x) * d.y})`)
      .attr("cursor", "pointer")
      .attr("opacity", 0)
      .transition()
      .duration(600)
      .delay((d) => d.depth * 100)
      .attr("opacity", 1);

    // Helper functions
    const getNodeColor = (depth: number) => nodeColors[depth as keyof typeof nodeColors] || nodeColors.default;
    const rectWidth = (label: string) => Math.min(240, Math.max(80, label.length * 8 + 24));
    const rectHeight = 40;

    // Select all nodes for rendering
    const nodeSelection = g.selectAll(".node");

    // Add background pill shape for each node
    nodeSelection.append("rect")
      .attr("rx", 12).attr("ry", 12)
      .attr("x", d => -rectWidth(d.data.label) / 2)
      .attr("y", -rectHeight / 2)
      .attr("width", d => rectWidth(d.data.label))
      .attr("height", rectHeight)
      .attr("fill", d => getNodeColor(d.depth))
      .attr("stroke", "#1e293b")
      .attr("stroke-width", 1)
      .attr("opacity", 0.9)
      .classed("transition-all", true)
      .transition()
      .duration(300)
      .delay((d) => d.depth * 100);

    // Add text labels
    nodeSelection.append("text")
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .attr("fill", "#ffffff")
      .style("font-size", "13px")
      .style("font-weight", "500")
      .style("pointer-events", "none")
      .style("text-shadow", "0 1px 3px rgba(0,0,0,0.3)")
      .text(d => d.data.label.length > 28 ? `${d.data.label.slice(0, 25)}…` : d.data.label);

    // Add small decorative circle on left side of each node
    nodeSelection.append("circle")
      .attr("cx", d => -rectWidth(d.data.label) / 2 + 12)
      .attr("cy", 0)
      .attr("r", 3)
      .attr("fill", "#ffffff")
      .attr("opacity", 0.7);

    // Interactive events
    g.selectAll(".node").each(function (d: any) {
      const node = d3.select(this);

      // Add hover effects
      node.on("mouseover", function () {
        d3.select(this).select("rect")
          .transition().duration(150)
          .attr("transform", "scale(1.08)")
          .attr("filter", "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))");

        // Highlight connections
        g.selectAll(".link").attr("stroke-opacity", 0.15);
        highlightConnections(d, g);
      })
        .on("mouseout", function () {
          d3.select(this).select("rect")
            .transition().duration(150)
            .attr("transform", "scale(1)")
            .attr("filter", null);

          // Reset connections
          g.selectAll(".link").attr("stroke-opacity", 0.5);
        })
        .on("click", function (event, d: any) {
          // Set active node and focus
          setSelectedNode(d.data.id);

          // Focus on the clicked node
          const transform = d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(1.2)
            .translate(-Math.sin(d.x) * d.y, Math.cos(d.x) * d.y);

          svg.transition().duration(750)
            .call(zoomBehaviour.transform as any, transform);

          event.stopPropagation();
        });
    });

    // Function to highlight connections between nodes
    function highlightConnections(node: any, g: d3.Selection<SVGGElement, unknown, null, undefined>) {
      // Highlight the path from root to this node
      let current = node;
      while (current.parent) {
        // Find and highlight the link
        g.selectAll(".link")
          .filter(l => l.source === current.parent && l.target === current)
          .attr("stroke", getNodeColor(current.depth))
          .attr("stroke-opacity", 0.8)
          .attr("stroke-width", 2);

        // Move to parent
        current = current.parent;
      }
    }

    // Allow clicking on background to reset zoom
    svg.on("click", () => {
      svg.transition().duration(750)
        .call(zoomBehaviour.transform as any, initialTransform);
    });

  }, [hierarchicalData, nodeColors, selectedNode, setSelectedNode]);

  // ───────────────────────────────────────── form handlers ───────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim()) generateMindMap.mutate(topic);
  };

  const exportAsPng = async () => {
    if (!containerRef.current) return;

    try {
      /* 1️⃣  Capture the current mind-map node */
      const dataUrl = await toPng(containerRef.current, { quality: 1 });

      /* 2️⃣  Turn that data-URL into an <img> we can draw */
      const img = new Image();
      img.src = dataUrl;
      await img.decode();               // Wait until the image is ready

      /* 3️⃣  Create a canvas that is just a bit taller */
      const watermarkHeight = 48;       // px – change as you like
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height + watermarkHeight;
      const ctx = canvas.getContext("2d");

      /* 4️⃣  Draw the captured mind-map */
      ctx.drawImage(img, 0, 0);

      /* 5️⃣  Draw the watermark strip */
      ctx.fillStyle = "rgba(0,0,0,0.05)";          // faint stripe
      ctx.fillRect(0, img.height, canvas.width, watermarkHeight);

      /* 6️⃣  Render your watermark text (or swap for a logo) */
      const logo = new Image();
      logo.src = "/images/wm.png";
      await logo.decode();

      const scaledWidth = logo.width * 0.2;
      const scaledHeight = logo.height * 0.2;

      ctx.drawImage(
        logo,
        canvas.width - scaledWidth - 16,
        img.height + (watermarkHeight - scaledHeight) / 2,
        scaledWidth,
        scaledHeight
      );



      /* 7️⃣  Get a final PNG and download it */
      const finalUrl = canvas.toDataURL("image/png", 1);
      const link = document.createElement("a");
      link.download = `mindmap-${topic.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.png`;
      link.href = finalUrl;
      link.click();
    } catch (err) {
      console.error("Error exporting mind map:", err);
    }
  };


  // Zoom control helper functions
  const handleZoomIn = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = zoomRef.current;
    svg.transition().duration(300).call(zoom.scaleBy as any, 1.3);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = zoomRef.current;
    svg.transition().duration(300).call(zoom.scaleBy as any, 0.7);
  };

  const handleResetView = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = zoomRef.current;
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const initialTransform = d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8);
    svg.transition().duration(500).call(zoom.transform as any, initialTransform);
  };

  // ─────────────────────────────────────────── render ────────────────────────────────────────────
  return (
    <div className="flex flex-col w-full h-full">
      {/* ─────────────── controls */}
      <div className="p-4 bg-black border border-noble-black-900 text-noble-black-100 rounded-2xl mb-4">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 mb-4">
          <BrainCircuit className="h-5 w-5" />
          マインドマップ
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="topic">トピックを入力するか、メモを貼り付けてください</Label>
            <Textarea
              id="topic"
              placeholder="マインドマップとして視覚化するトピックや概念を入力してください…"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="h-24 resize-none text-noble-black-100 bg-noble-black-900 focus:outline-none border-0 outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button className="text-noble-black-900 bg-noble-black-100 hover:text-noble-black-100 rounded-full" type="submit" disabled={!topic.trim() || generateMindMap.isPending}>
              <BrainCircuit className="mr-2 h-4 w-4" />
              マインドマップを生成
            </Button>
            {mindMapData && (
              <>
                <Button className="bg-noble-black-900 text-noble-black-100 border border-noble-black-800 rounded-full" type="button" variant="outline" onClick={() => generateMindMap.mutate(topic)} disabled={generateMindMap.isPending}>
                  <RefreshCw className="mr-1 h-4 w-4" />
                  再生成
                </Button>
                <Button className="bg-noble-black-900 text-noble-black-100 border border-noble-black-800 rounded-full" type="button" variant="outline" onClick={exportAsPng} disabled={generateMindMap.isPending}>
                  <Download className="mr-1 h-4 w-4" />
                  エクスポート
                </Button>
                <Button
                  type="button"
                  className="bg-noble-black-900 text-noble-black-100 border border-noble-black-800 rounded-full"
                  variant="outline"
                  onClick={() => setShowLegend(!showLegend)}
                >
                  <Info className="mr-1 h-4 w-4" />
                  {showLegend ? '凡例を非表示' : '凡例を表示'}
                </Button>
              </>
            )}
          </div>
        </form>
      </div>

      {/* ─────────────── visualization */}
      <div ref={containerRef} className="flex-grow w-full overflow-hidden bg-black border border-noble-black-900 rounded-2xl relative">
        {generateMindMap.isPending ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center">


              <Grid
                size="60"
                speed="1.5"
                color="#f2f2f2"
              />
              <p className="text-sm text-noble-black-100">マインドマップを生成中...</p>
            </div>
          </div>
        ) : mindMapData ? (
          <motion.div
            className="w-full h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45 }}
          >
            {/* Zoom controls - fixed position */}
            <div className="absolute right-4 top-4 flex flex-col space-y-2 z-10">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" onClick={handleZoomIn} className="h-8 w-8 p-0 rounded-full bg-noble-black-100 text-noble-black-900 backdrop-blur-sm">
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>拡大</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" onClick={handleZoomOut} className="h-8 w-8 p-0 rounded-full bg-noble-black-100 text-noble-black-900 backdrop-blur-sm">
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>縮小</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" onClick={handleResetView} className="h-8 w-8 p-0 rounded-full bg-noble-black-100 text-noble-black-900 backdrop-blur-sm">
                      <Home className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>表示をリセット</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Color Legend */}
            {showLegend && (
              <motion.div
                className="absolute left-4 top-4 bg-card/90 backdrop-blur-sm p-3 rounded-2xl border border-border shadow-md z-10"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h4 className="text-sm font-medium mb-2">マインドマップの凡例</h4>
                <div className="space-y-1.5">
                  {[0, 1, 2, 3, 4].map(depth => (
                    <div key={depth} className="flex items-center">
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: nodeColors[depth as keyof typeof nodeColors] }}
                      />
                      <span className="text-xs">
                        {depth === 0 ? 'ルートノード' : `レベル ${depth} ノード`}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  <p>•ノードをクリックするとフォーカスします</p>
                  <p>• 背景をクリックすると表示がリセットされます</p>
                  <p>• ホバーすると接続がハイライトされます</p>
                </div>
              </motion.div>
            )}

            {/* Main SVG */}
            <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet" />
          </motion.div>
        ) : (
          // <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
          // <div className="relative flex h-[50rem] w-full items-center justify-center bg-black border border-noble-black-100 text-noble-black-100">
          <div className="h-full bg-black border border-noble-black-900 text-noble-black-100 rounded-2xl">
            <Spotlight />

            {/* Radial gradient for the container to give a faded look */}
            <div className="flex flex-col items-center justify-center h-full p-5 md:p-0">
              <BrainCircuit className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-medium mb-2">マインドマップを生成するにはトピックを入力してください</h3>
              <p className="text-muted-foreground max-w-md">
                上に概念、トピックを入力するかメモを貼り付けて、「マインドマップを生成」をクリックするとアイデアや関連を視覚化できます。
              </p>
            </div>
          </div>
          // </div>
          // </div>
        )}
      </div>
    </div>
  );
}