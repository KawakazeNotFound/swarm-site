import { useEffect, useMemo, useRef, useState } from "react";
import { ArticleView } from "../blog/ArticleView.jsx";
import { BlockDocument } from "../blog/BlockDocument.jsx";
import { createArticle, DefaultMotion, flattenBlocks, blockText, validateArticle } from "../blog/ArticleModel.js";
import { saveArticle } from "../blog/ArticleStore.js";
import { MotionPresets, resolvePreset } from "../motion/MotionPresets.js";

const InitialKeyframes = '[\n  { "opacity": 0, "transform": "translateY(24px) rotate(-2deg)" },\n  { "opacity": 1, "transform": "translateY(0) rotate(0deg)" }\n]';

function MotionInspector({ article, block, onChange, onPreview, onInvalid }) {
  const config = { ...DefaultMotion, ...article.motion.defaults, ...article.motion.blocks[block.id] };
  const [keyframeText, setKeyframeText] = useState(() => config.keyframes ? JSON.stringify(config.keyframes, null, 2) : InitialKeyframes);
  const [error, setError] = useState("");
  useEffect(() => () => onInvalid(false), []);
  const update = (patch) => onChange({ ...config, ...patch });
  const blocks = flattenBlocks(article.blocks);
  const previous = blocks.slice(0, blocks.findIndex((item) => item.id === block.id));
  return (
    <aside className="motion-inspector">
      <div className="panel-heading"><span className="eyebrow">BLOCK MOTION</span><h3>区块动画</h3></div>
      <div className="selected-block"><span>{block.type}</span><p>{blockText(block).slice(0, 100) || "空白区块"}</p><code>{block.id}</code></div>
      <label className="field">动画方式<select value={config.preset} onChange={(event) => { const preset = event.target.value; update({ preset, ...(preset === "custom" ? { keyframes: JSON.parse(InitialKeyframes) } : {}) }); if (preset === "custom") setKeyframeText(InitialKeyframes); setError(""); onInvalid(false); }}>{MotionPresets.filter((preset) => preset.supports(block)).map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label>
      <div className="field-row"><label className="field">时长 / ms<input type="number" min="0" max="30000" step="50" value={config.duration} onChange={(event) => update({ duration: Number(event.target.value) })} /></label><label className="field">延迟 / ms<input type="number" min="0" max="30000" step="50" value={config.delay} onChange={(event) => update({ delay: Number(event.target.value) })} /></label></div>
      <label className="field">触发时机<select value={config.trigger} onChange={(event) => update({ trigger: event.target.value })}><option value="enter">进入视口时</option><option value="load">页面加载后</option></select></label>
      <label className="field">等待哪个区块完成<select value={config.after} onChange={(event) => update({ after: event.target.value })}><option value="">不等待，自动并行</option>{previous.map((item) => <option key={item.id} value={item.id}>{blockText(item).slice(0, 22) || item.type}</option>)}</select></label>
      {config.preset === "custom" && <label className="field">关键帧 JSON<textarea className="keyframe-editor" spellCheck={false} rows={10} value={keyframeText} onChange={(event) => {
        setKeyframeText(event.target.value);
        try {
          const keyframes = JSON.parse(event.target.value);
          if (!Array.isArray(keyframes) || keyframes.length < 2) throw new Error("至少填写两个关键帧");
          const probe = new KeyframeEffect(null, keyframes, { duration: config.duration });
          probe.getKeyframes();
          update({ keyframes }); setError(""); onInvalid(false);
        } catch (failure) { setError(failure.message); onInvalid(true); }
      }} /><small>使用 opacity、transform、filter、clipPath 等浏览器动画属性；填写数据，不执行脚本。</small></label>}
      {error && <p className="error-message" role="alert">{error}</p>}
      <button className="secondary-button full-width" disabled={Boolean(error)} onClick={onPreview}>预览此区块 ↗</button>
      <p className="inspector-note">同一动画可以用于不同区块。自动模式按区块能力选择效果，调度器为它分配空闲光标。文字揭示保留原有富文本与换行布局。</p>
      <div className="panel-heading global-motion-heading"><span className="eyebrow">ARTICLE SETTINGS</span><h3>整篇文章</h3></div>
    </aside>
  );
}

export function StudioPage({ articles, articleId, onSaved, onDirty }) {
  const [article, setArticle] = useState(() => articles.find((item) => item.id === articleId) ?? articles[0] ?? createArticle());
  const [selectedId, setSelectedId] = useState(article.blocks[0].id);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [invalidMotion, setInvalidMotion] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewOnly, setPreviewOnly] = useState("");
  const [documentVersion, setDocumentVersion] = useState(0);
  const editor = useRef(null);
  const blocks = flattenBlocks(article.blocks);
  const selected = blocks.find((block) => block.id === selectedId) ?? blocks[0];
  const update = (patch) => { setArticle((current) => ({ ...current, ...patch })); setDirty(true); setMessage(""); };
  useEffect(() => { onDirty(dirty); }, [dirty]);
  useEffect(() => {
    const warn = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const previewArticle = useMemo(() => !previewOnly ? article : {
    ...article,
    motion: { ...article.motion, enabled: true, blocks: Object.fromEntries(blocks.map((block) => [block.id, block.id === previewOnly ? { ...article.motion.defaults, ...article.motion.blocks[block.id], trigger: "load", after: "" } : { preset: "none" }])) },
  }, [article, previewOnly]);
  const check = (value) => {
    if (invalidMotion) throw new Error("请先修正自定义关键帧 JSON");
    validateArticle(value);
    for (const block of flattenBlocks(value.blocks)) resolvePreset(block, { ...DefaultMotion, ...value.motion.defaults, ...value.motion.blocks[block.id] });
    return value;
  };
  const save = async () => {
    setError(""); setSaving(true);
    try {
      const value = check({ ...article, blocks: editor.current?.document ?? article.blocks, updatedAt: new Date().toISOString() });
      const saved = await saveArticle(value);
      setArticle(saved); onSaved(saved); setDirty(false); setMessage(saved.status === "published" ? "已写入项目文件；重新构建后可发布" : "草稿已写入项目文件");
    } catch (failure) { setError(failure.message); } finally { setSaving(false); }
  };
  const showPreview = (blockId = "") => {
    try { check(article); setPreviewOnly(blockId); setPreview(true); setError(""); window.scrollTo(0, 0); }
    catch (failure) { setError(failure.message); }
  };
  const newArticle = () => {
    if (dirty && !window.confirm("当前有尚未保存的修改，仍要新建吗？")) return;
    const value = createArticle(); setArticle(value); setSelectedId(value.blocks[0].id); setDocumentVersion((version) => version + 1); setDirty(true); setPreview(false); setError(""); setMessage("");
  };
  const exportArticle = () => {
    try {
      const value = check(article);
      const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = `${value.slug}.json`; link.click(); URL.revokeObjectURL(url);
    } catch (failure) { setError(failure.message); }
  };
  const importArticle = async (file) => {
    if (!file) return;
    try {
      if (dirty && !window.confirm("导入将替换当前尚未保存的编辑，继续吗？")) return;
      const value = validateArticle(JSON.parse(await file.text()));
      setArticle(value); setSelectedId(value.blocks[0].id); setDocumentVersion((version) => version + 1); setDirty(true); setPreview(false); setError(""); setMessage("已导入到编辑器，保存后写入项目");
    } catch (failure) { setError(failure.message); }
  };
  return (
    <main className="studio-page">
      <div className="studio-toolbar"><div><p className="eyebrow">LOCAL WRITING STUDIO</p><strong>{preview ? "阅读预览" : "写作工作台"}</strong><span className="save-state">{dirty ? "未保存" : "已保存"}</span></div><div className="toolbar-actions"><button className="text-button" onClick={exportArticle}>导出 JSON</button><label className="text-button import-button">导入<input type="file" accept="application/json,.json" onChange={(event) => { importArticle(event.target.files[0]); event.target.value = ""; }} /></label><button className="secondary-button" onClick={() => preview ? setPreview(false) : showPreview()}>{preview ? "← 继续编辑" : "预览整篇 ↗"}</button><button className="primary-button" disabled={saving || invalidMotion} onClick={save}>{saving ? "正在保存…" : "保存到项目"}</button></div></div>
      {error && <p className="studio-notice error-message" role="alert">{error}</p>}{message && <p className="studio-notice success-message" role="status">{message}</p>}
      {preview ? <ArticleView key={`${article.id}-${previewOnly}`} article={previewArticle} focusBlock={previewOnly} /> : <div className="studio-layout">
        <aside className="article-library"><div className="panel-heading"><span className="eyebrow">LIBRARY / {articles.length}</span><button className="secondary-button full-width" onClick={newArticle}>＋ 新建文章</button></div>{articles.map((item) => <a key={item.id} href={`#/studio/${item.id}`} className={item.id === article.id ? "library-item selected" : "library-item"}><span>{item.status === "published" ? "已发布" : "草稿"}</span><strong>{item.title}</strong><small>{item.slug}</small></a>)}<p className="library-note">内容保存至项目的 content 目录。这里没有远端写入接口；上线时只包含已发布文章。</p></aside>
        <section className="writing-canvas"><div className="article-fields"><label className="field title-field">文章标题<input aria-label="文章标题" value={article.title} onChange={(event) => update({ title: event.target.value })} /></label><div className="field-row"><label className="field">文章地址<input aria-label="文章地址" value={article.slug} onChange={(event) => update({ slug: event.target.value })} /></label><label className="field">状态<select aria-label="文章状态" value={article.status} onChange={(event) => update({ status: event.target.value })}><option value="draft">草稿 · 仅本地</option><option value="published">已发布 · 加入构建</option></select></label></div><label className="field">文章摘要<textarea rows={2} value={article.excerpt} onChange={(event) => update({ excerpt: event.target.value })} /></label><label className="field">标签 · 用逗号分隔<input value={article.tags.join(", ")} onChange={(event) => update({ tags: event.target.value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) })} /></label></div><div className="editor-caption"><span>正文 / 输入 “/” 插入区块</span><span>点击区块，在右侧设置动画 ↗</span></div><BlockDocument key={`${article.id}-${documentVersion}`} article={article} editable onChange={(document) => update({ blocks: document })} onSelection={setSelectedId} onReady={(_, instance) => { editor.current = instance; }} /></section>
        <div className="inspector-column"><MotionInspector key={selected.id} article={article} block={selected} onInvalid={setInvalidMotion} onPreview={() => showPreview(selected.id)} onChange={(config) => update({ motion: { ...article.motion, blocks: { ...article.motion.blocks, [selected.id]: config } } })} /><div className="article-motion-settings"><label className="checkbox-field"><input type="checkbox" checked={article.motion.enabled} onChange={(event) => update({ motion: { ...article.motion, enabled: event.target.checked } })} />启用文章动效</label><label className="field">并行光标数量<input type="number" min="1" max="8" value={article.motion.workers} onChange={(event) => update({ motion: { ...article.motion, workers: Number(event.target.value) } })} /></label><label className="field">默认动画<select value={article.motion.defaults.preset} onChange={(event) => update({ motion: { ...article.motion, defaults: { ...article.motion.defaults, preset: event.target.value } } })}>{MotionPresets.filter((preset) => !["custom", "typewriter"].includes(preset.id)).map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label><p className="inspector-note">区块的手动设置优先于整篇默认设置。依赖只提供前面的区块，避免形成循环。</p></div></div>
      </div>}
    </main>
  );
}
