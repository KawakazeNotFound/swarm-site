import publishedArticles from "virtual:blog-articles";

async function responseJson(response) {
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "请求失败");
  return value;
}

export async function loadArticles() {
  return import.meta.env.DEV
    ? responseJson(await fetch("/__studio/articles"))
    : publishedArticles;
}

export async function saveArticle(article) {
  return responseJson(await fetch("/__studio/articles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(article),
  }));
}

export async function uploadMedia(file) {
  const { url } = await responseJson(await fetch("/__studio/media", {
    method: "POST", headers: { "Content-Type": file.type }, body: file,
  }));
  return url;
}
