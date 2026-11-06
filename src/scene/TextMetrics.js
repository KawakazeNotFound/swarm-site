const measureContext = document.createElement("canvas").getContext("2d");
const textMetricsCache = new Map();
const fontFamily = (style) =>
  style.font === "mono"
    ? '"JetBrains Mono", ui-monospace, monospace'
    : "Inter, system-ui, sans-serif";
const lineHeight = (style, size = style.size) => Math.round(size * style.lineHeight);
function measureText(text, style, size, width) {
  const cacheKey = `${text}|${style.font}|${style.weight}|${size}|${style.letterSpacing ?? 0}|${width ?? -1}`;
  const cached = textMetricsCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  measureContext.font = `${style.weight} ${size}px ${fontFamily(style)}`;
  measureContext.letterSpacing = `${(style.letterSpacing ?? 0) * size}px`;
  const lines = [];
  for (const paragraph of text.split(`
`)) {
    if (width == null || style.preformatted) {
      lines.push(measureContext.measureText(paragraph).width);
      continue;
    }
    const words = paragraph.split(" ");
    let line = "";
    for (const word of words) {
      const candidate = line ? line + " " + word : word;
      if (line && measureContext.measureText(candidate).width > width) {
        lines.push(measureContext.measureText(line).width);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(measureContext.measureText(line).width);
  }
  const measuredWidth = width ?? Math.max(0, ...lines);
  const metrics = {
    w: Math.ceil(measuredWidth),
    h: lines.length * lineHeight(style, size),
    lines,
  };
  textMetricsCache.set(cacheKey, metrics);
  return metrics;
}
export { measureContext, textMetricsCache, fontFamily, lineHeight, measureText };
