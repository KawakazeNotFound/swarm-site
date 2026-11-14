import { lazy, Suspense, useEffect, useState } from "react";
import { loadArticles } from "./blog/ArticleStore.js";
import { BlogHome } from "./blog/BlogHome.jsx";
import "./BlogStyles.css";

const ArticlePage = lazy(() => import("./blog/ArticleView.jsx").then((module) => ({ default: module.ArticleView })));
const OriginalDemo = lazy(() => import("./App.jsx").then((module) => ({ default: module.App })));
const StudioPage = import.meta.env.DEV ? lazy(() => import("./editor/StudioPage.jsx").then((module) => ({ default: module.StudioPage }))) : null;

function currentRoute() {
  const hash = window.location.hash;
  return hash.startsWith("#/") ? hash.slice(1) : "/";
}

export function BlogApp() {
  const [route, setRoute] = useState(currentRoute);
  const [articles, setArticles] = useState(null);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(() => localStorage.getItem("journal-motion") !== "off");
  useEffect(() => {
    loadArticles().then(setArticles).catch((failure) => setError(failure.message));
    const change = () => { setRoute(currentRoute()); setDirty(false); if (window.location.hash !== "#articles") window.scrollTo(0, 0); };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const saveLocalArticle = (article) => setArticles((existing) => [...existing.filter((item) => item.id !== article.id), article]);
  const slug = route.startsWith("/post/") ? route.slice(6) : "";
  const article = articles?.find((item) => item.slug === slug && (import.meta.env.DEV || item.status === "published"));
  useEffect(() => { document.title = article ? `${article.title} — Swarm Journal` : route.startsWith("/studio") ? "写作工作台 — Swarm Journal" : "Swarm Journal — 思考与构建"; }, [route, article]);
  const guardNavigation = (event) => {
    const link = event.target.closest("a[href^='#/']");
    if (dirty && link && link.hash !== window.location.hash && !window.confirm("当前有尚未保存的修改，仍要离开吗？")) event.preventDefault();
  };
  return (
    <div className={route.startsWith("/studio") ? "journal-shell studio-shell" : "journal-shell"} onClickCapture={guardNavigation}>
      <header className="journal-nav"><a className="journal-brand" href="#/"><span className="brand-mark">S</span><strong>Swarm<span>Journal</span></strong></a><nav aria-label="主导航"><a href="#/" aria-current={route === "/" ? "page" : undefined}>文章</a><a href="#/demo" aria-current={route === "/demo" ? "page" : undefined}>原始演示</a>{import.meta.env.DEV && <a className="studio-link" href="#/studio">写作工作台 ↗</a>}</nav><button className="motion-switch" aria-pressed={motionEnabled} onClick={() => setMotionEnabled((enabled) => { localStorage.setItem("journal-motion", enabled ? "off" : "on"); return !enabled; })}><span />动效 {motionEnabled ? "开" : "关"}</button></header>
      <Suspense fallback={<div className="empty-state">正在准备页面…</div>}>
        {error ? <div className="error-message" role="alert">{error}</div> : !articles ? <div className="empty-state">正在读取文章…</div> : route === "/" ? <BlogHome articles={articles} /> : route === "/demo" ? <OriginalDemo /> : route.startsWith("/studio") ? StudioPage ? <StudioPage key={route} articles={articles} articleId={route.split("/")[2]} onSaved={saveLocalArticle} onDirty={setDirty} /> : <div className="empty-state">写作工作台仅在本地开发服务中开放。运行 npm run dev 后编辑文章，再重新构建发布。</div> : article ? <ArticlePage key={`${article.id}-${article.updatedAt}`} article={article} motionEnabled={motionEnabled} /> : <div className="empty-state">这篇记录还没有发布。<a href="#/">返回目录</a></div>}
      </Suspense>
      {!route.startsWith("/studio") && <footer className="journal-footer"><a className="journal-brand" href="#/"><strong>Swarm Journal</strong></a><span>记录想法，也记录它们成为现实的过程。</span><span>BUILT WITH BLOCKS & CURIOSITY</span></footer>}
    </div>
  );
}
