import { useEffect, useRef, useState } from "react";
import { BlockDocument } from "./BlockDocument.jsx";
import { DomMotionController } from "../motion/DomMotionController.js";
import { flattenBlocks } from "./ArticleModel.js";

export function ArticleView({ article, motionEnabled = true, focusBlock = "" }) {
  const [documentRoot, setDocumentRoot] = useState(null);
  const [replay, setReplay] = useState(0);
  const [progress, setProgress] = useState({ total: 0, done: 0, active: 0 });
  const [error, setError] = useState("");
  const controller = useRef(null);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animate = motionEnabled && article.motion.enabled && !reducedMotion;
  useEffect(() => {
    if (!documentRoot || !animate) return;
    setError("");
    controller.current = new DomMotionController(documentRoot, article, setProgress, setError);
    return () => controller.current.stop();
  }, [documentRoot, animate, replay, article]);
  useEffect(() => {
    if (!documentRoot || !focusBlock) return;
    for (const element of documentRoot.querySelectorAll("[data-id]")) {
      if (element.dataset.id === focusBlock) element.scrollIntoView({ block: "center" });
    }
  }, [documentRoot, focusBlock, replay]);
  return (
    <article className="article-page">
      <header className="article-heading">
        <a className="eyebrow" href="#/">← 全部文章</a>
        <div className="article-meta"><span>{new Date(article.createdAt).toLocaleDateString("zh-CN")}</span><span>{article.tags.join(" / ")}</span><span>{flattenBlocks(article.blocks).length} 个区块</span></div>
        <h1>{article.title}</h1>
        <p className="article-excerpt">{article.excerpt}</p>
        <div className="article-controls">
          <span className="status-dot">{reducedMotion ? "已尊重系统减少动态效果设置" : animate ? `光标 ${progress.active} / 完成 ${progress.done} · ${progress.total}` : "静态阅读"}</span>
          {animate && <button className="text-button" onClick={() => setReplay((value) => value + 1)}>重播动画 ↻</button>}
          {import.meta.env.DEV && <a className="text-button" href={`#/studio/${article.id}`}>编辑文章 ↗</a>}
        </div>
        {error && <p className="error-message" role="alert">动画配置：{error}</p>}
      </header>
      <BlockDocument key={`${article.id}-${article.updatedAt}`} article={article} onReady={(root) => setDocumentRoot(root)} />
      <footer className="article-end"><span>END OF NOTE</span><a href="#/">返回文章目录 ↗</a></footer>
    </article>
  );
}
