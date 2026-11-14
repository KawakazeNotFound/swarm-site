import { useMemo, useState } from "react";

export function BlogHome({ articles }) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const published = articles.filter((article) => article.status === "published").sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const tags = [...new Set(published.flatMap((article) => article.tags))];
  const visible = useMemo(() => published.filter((article) => (!tag || article.tags.includes(tag)) && `${article.title} ${article.excerpt} ${article.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [published, tag, query]);
  return (
    <main className="blog-home">
      <section className="journal-hero">
        <div className="hero-copy"><p className="eyebrow"><span className="tiny-cross">+</span> FIELD NOTES / 思考与构建</p><h1>把想法写下来，<br />让它们<span>发生。</span></h1><p className="hero-description">关于设计、代码，以及那些值得慢慢完成的事情。<br />一些记录，一些实验，和几位忙碌的光标。</p><a className="primary-button" href="#articles">翻开最新记录 <span>↗</span></a></div>
        <div className="hero-diagram" aria-hidden="true"><div className="diagram-corner corner-top">+</div><div className="diagram-corner corner-bottom">+</div><span className="diagram-label">A SMALL SYSTEM FOR BIG IDEAS</span><div className="diagram-node node-content">一段想法<span>CONTENT / 01</span></div><div className="diagram-line" /><div className="diagram-node node-blocks">有序的区块<span>BLOCKS / 02</span></div><div className="diagram-node node-motion">恰好的动效<span>MOTION / 03</span></div><div className="diagram-cursor cursor-green">↖<small>writer</small></div><div className="diagram-cursor cursor-orange">↖<small>builder</small></div><span className="diagram-footnote">WRITE. ARRANGE. BRING TO LIFE.</span></div>
      </section>
      <section className="journal-index" id="articles">
        <div className="section-heading"><div><p className="eyebrow">THE JOURNAL</p><h2>最近的记录<span>{String(published.length).padStart(2, "0")}</span></h2></div><label className="search-field"><span>⌕</span><input type="search" placeholder="搜索标题、摘要或标签" aria-label="搜索文章" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
        <div className="tag-filter"><button className={!tag ? "selected" : ""} onClick={() => setTag("")}>全部</button>{tags.map((name) => <button key={name} className={tag === name ? "selected" : ""} onClick={() => setTag(name)}>{name}</button>)}</div>
        <div className="post-grid">{visible.map((article, index) => <a key={article.id} className="post-card" href={`#/post/${article.slug}`}><div className="card-art" data-variant={index % 2}><span className="card-art-index">NOTE / {String(index + 1).padStart(3, "0")}</span><div className="card-art-lines"><i /><i /><i /></div><span className="card-art-cursor">↖</span><span className="card-art-label">{article.tags[0]}</span></div><div className="post-card-copy"><div className="post-card-meta"><span>{new Date(article.createdAt).toLocaleDateString("zh-CN")}</span><span>{article.tags.slice(0, 2).join(" · ")}</span></div><h3>{article.title}</h3><p>{article.excerpt}</p><span className="read-link">读这篇记录 <span>↗</span></span></div></a>)}</div>
        {!visible.length && <div className="empty-state">没有匹配的文章。试试其他关键词。</div>}
      </section>
      <section className="journal-about"><p className="eyebrow">A NOTE ON THIS PLACE</p><h2>内容先行，<br />一点点生动。</h2><div><p>文章不必是一张静止的纸，也不必是一场等待结束的动画。你可以安静地阅读，也可以看光标把一个区块慢慢搭建出来。</p><a className="text-button" href="#/demo">看看一切开始的地方 ↗</a></div></section>
    </main>
  );
}
