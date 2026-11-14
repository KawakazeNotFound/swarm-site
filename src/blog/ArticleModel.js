export const ArticleFormatVersion = 1;

export const DefaultMotion = {
  preset: "auto",
  duration: 650,
  delay: 0,
  trigger: "enter",
  after: "",
};

export function flattenBlocks(blocks) {
  return blocks.flatMap((block) => [block, ...flattenBlocks(block.children ?? [])]);
}

export function blockText(block) {
  if (typeof block.content === "string") return block.content;
  if (!Array.isArray(block.content)) return block.props?.caption ?? block.type;
  return block.content.map((part) => part.text ?? blockText({ content: part.content })).join("");
}

export function createArticle() {
  const id = crypto.randomUUID();
  return {
    formatVersion: ArticleFormatVersion,
    id,
    slug: `post-${id.slice(0, 8)}`,
    title: "未命名文章",
    excerpt: "",
    tags: [],
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    blocks: [{ id: crypto.randomUUID(), type: "paragraph", content: "" }],
    motion: { enabled: true, workers: 3, defaults: { ...DefaultMotion }, blocks: {} },
  };
}

export function validateArticle(article) {
  if (article.formatVersion !== ArticleFormatVersion) throw new Error("文章格式版本不匹配");
  if (!/^[a-z0-9-]+$/.test(article.id ?? "")) throw new Error("文章 ID 格式错误");
  if (!/^[a-z0-9-]+$/.test(article.slug ?? "")) throw new Error("地址仅使用小写英文、数字和连字符");
  if (!article.title?.trim()) throw new Error("请填写文章标题");
  if (!["draft", "published"].includes(article.status)) throw new Error("文章状态错误");
  if (!Array.isArray(article.blocks) || !article.blocks.length) throw new Error("文章至少保留一个区块");
  const blocks = flattenBlocks(article.blocks);
  const ids = new Set(blocks.map((block) => block.id));
  if (ids.size !== blocks.length || blocks.some((block) => !block.id)) throw new Error("区块 ID 必须存在且唯一");
  const configs = article.motion?.blocks ?? {};
  for (const block of blocks) {
    const config = { ...DefaultMotion, ...article.motion?.defaults, ...configs[block.id] };
    if (!Number.isFinite(config.duration) || config.duration < 0 || config.duration > 30000) throw new Error("动画时长范围为 0–30000 毫秒");
    if (!Number.isFinite(config.delay) || config.delay < 0 || config.delay > 30000) throw new Error("动画延迟范围为 0–30000 毫秒");
    if (!["enter", "load"].includes(config.trigger)) throw new Error("动画触发方式错误");
    const visited = new Set([block.id]);
    let after = config.after;
    while (after) {
      if (!ids.has(after)) throw new Error("动画依赖的区块已被移除，请重新选择");
      if (visited.has(after)) throw new Error("动画依赖存在循环");
      visited.add(after);
      after = { ...article.motion?.defaults, ...configs[after] }.after;
    }
    if (config.preset === "custom" && (!Array.isArray(config.keyframes) || config.keyframes.length < 2)) throw new Error("自定义动画至少需要两个关键帧");
  }
  if (!Number.isInteger(article.motion?.workers) || article.motion.workers < 1 || article.motion.workers > 8) throw new Error("光标数量范围为 1–8");
  return article;
}
