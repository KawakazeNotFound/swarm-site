import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { validateArticle } from "../src/blog/ArticleModel.js";

const VirtualId = "virtual:blog-articles";
const ResolvedId = "\0" + VirtualId;
const MediaExtensions = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "audio/mpeg": "mp3", "application/pdf": "pdf" };

export function localBlog() {
  let root;
  const listArticles = async () => {
    const directory = resolve(root, "content");
    const files = (await readdir(directory)).filter((file) => file.endsWith(".json"));
    return Promise.all(files.map(async (file) => JSON.parse(await readFile(join(directory, file), "utf8"))));
  };
  return {
    name: "local-blog",
    configResolved(config) { root = config.root; },
    resolveId(id) { if (id === VirtualId) return ResolvedId; },
    async load(id) {
      if (id === ResolvedId) {
        const articles = (await listArticles()).filter((article) => article.status === "published");
        for (const article of articles) validateArticle(article);
        const slugs = articles.map((article) => article.slug);
        if (new Set(slugs).size !== slugs.length) throw new Error("文章地址重复");
        return `export default ${JSON.stringify(articles)};`;
      }
    },
    handleHotUpdate({ file }) { if (file.startsWith(resolve(root, "content"))) return []; },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url, "http://localhost").pathname;
        if (!pathname.startsWith("/__studio/")) return next();
        const send = (status, value) => {
          response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
          response.end(JSON.stringify(value));
        };
        try {
          if (request.method === "GET" && pathname === "/__studio/articles") return send(200, await listArticles());
          if (request.method !== "POST") return send(405, { error: "请求方法错误" });
          if (request.headers.origin !== `http://${request.headers.host}`) return send(403, { error: "仅接受本地编辑器的同源保存请求" });
          const chunks = [];
          let size = 0;
          for await (const chunk of request) {
            size += chunk.length;
            if (size > 20 * 1024 * 1024) return send(413, { error: "单次保存或上传上限为 20 MB" });
            chunks.push(chunk);
          }
          const body = Buffer.concat(chunks);
          if (pathname === "/__studio/articles") {
            const article = validateArticle(JSON.parse(body.toString("utf8")));
            const articles = await listArticles();
            if (articles.some((existing) => existing.id !== article.id && existing.slug === article.slug)) throw new Error("文章地址已被其他文章使用");
            await writeFile(resolve(root, "content", `${article.id}.json`), JSON.stringify(article, null, 2) + "\n");
            return send(200, article);
          }
          if (pathname === "/__studio/media") {
            const extension = MediaExtensions[request.headers["content-type"]];
            if (!extension) throw new Error("请选择 PNG、JPG、WebP、GIF、MP4、MP3 或 PDF 文件");
            const directory = resolve(root, "public", "Media");
            await mkdir(directory, { recursive: true });
            const filename = `${randomUUID()}.${extension}`;
            await writeFile(join(directory, filename), body);
            return send(200, { url: `./Media/${filename}` });
          }
          send(404, { error: "接口不存在" });
        } catch (error) { send(400, { error: error.message }); }
      });
    },
  };
}
