import { ArrowPath } from "../components/Cursor.jsx";
import { CursorColors } from "../engine/CursorSettings.js";
import { DefaultMotion, flattenBlocks } from "../blog/ArticleModel.js";
import { resolvePreset } from "./MotionPresets.js";

export class DomMotionController {
  constructor(root, article, onChange, onError) {
    this.root = root;
    this.article = article;
    this.onChange = onChange;
    this.onError = onError;
    this.disposed = false;
    this.animations = new Set();
    this.frames = new Map();
    this.timers = new Set();
    this.overlay = document.createElement("div");
    this.overlay.className = "motion-overlay";
    this.overlay.setAttribute("aria-hidden", "true");
    document.body.append(this.overlay);
    this.workers = Array.from({ length: article.motion.workers }, (_, index) => {
      const cursor = document.createElement("div");
      cursor.className = "motion-worker";
      cursor.style.color = CursorColors[index % CursorColors.length];
      cursor.innerHTML = `<svg width="28" height="28" viewBox="0 0 28 28"><path d="${ArrowPath}" fill="currentColor" stroke="white" stroke-width="1.5"/></svg>`;
      const outline = document.createElement("div");
      outline.className = "motion-outline";
      outline.style.color = cursor.style.color;
      this.overlay.append(cursor, outline);
      return { cursor, outline, busy: false, x: -40, y: 80 + index * 45 };
    });
    const elements = new Map();
    for (const outer of root.querySelectorAll("[data-id]")) {
      const content = outer.querySelector(".bn-block-content");
      if (content) elements.set(outer.dataset.id, content);
    }
    this.tasks = flattenBlocks(article.blocks).map((block) => ({
      block,
      element: elements.get(block.id),
      config: { ...DefaultMotion, ...article.motion.defaults, ...article.motion.blocks[block.id] },
      state: "waiting",
      ready: false,
    })).filter((task) => task.element);
    this.byElement = new Map(this.tasks.map((task) => [task.element, task]));
    this.byId = new Map(this.tasks.map((task) => [task.block.id, task]));
    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) this.byElement.get(entry.target).ready = true;
      this.pump();
    }, { threshold: 0, rootMargin: "0px 0px -24px 0px" });
    for (const task of this.tasks) {
      task.ready = task.config.trigger === "load";
      if (task.config.preset === "none") task.state = "done";
      this.observer.observe(task.element);
    }
    this.pump();
  }

  report() {
    if (!this.disposed) this.onChange({ total: this.tasks.length, done: this.tasks.filter((task) => task.state === "done").length, active: this.workers.filter((worker) => worker.busy).length });
  }

  pump() {
    if (this.disposed) return;
    for (const worker of this.workers) {
      if (worker.busy) continue;
      const task = this.tasks.find((candidate) => candidate.state === "waiting" && candidate.ready && (!candidate.config.after || this.byId.get(candidate.config.after)?.state === "done"));
      if (!task) continue;
      task.state = "active";
      worker.busy = true;
      this.play(task, worker).catch((error) => { if (!this.disposed) this.onError(error.message); }).finally(() => {
        task.state = "done";
        worker.busy = false;
        worker.cursor.style.opacity = "0";
        worker.outline.style.opacity = "0";
        this.pump();
      });
    }
    this.report();
  }

  progress(duration, update) {
    return new Promise((resolve) => {
      const start = performance.now();
      const token = {};
      const frame = (time) => {
        if (this.disposed) return resolve();
        const progress = duration === 0 ? 1 : Math.min(1, (time - start) / duration);
        update(progress);
        if (progress < 1) this.frames.set(token, { id: requestAnimationFrame(frame), resolve });
        else { this.frames.delete(token); resolve(); }
      };
      this.frames.set(token, { id: requestAnimationFrame(frame), resolve });
    });
  }

  position(worker, x, y) {
    worker.x = x;
    worker.y = y;
    worker.cursor.style.transform = `translate(${x - 5}px, ${y - 4}px)`;
  }

  frameOutline(worker, rect) {
    Object.assign(worker.outline.style, { opacity: "1", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  }

  async play(task, worker) {
    const { element, config, block } = task;
    const preset = resolvePreset(block, config);
    if (config.delay) await new Promise((resolve) => {
      const id = setTimeout(() => { this.timers.delete(id); resolve(); }, config.delay);
      this.timers.add(id);
    });
    if (this.disposed) return;
    worker.cursor.style.opacity = "1";
    const startX = worker.x;
    const startY = worker.y;
    await this.progress(220, (progress) => {
      const rect = element.getBoundingClientRect();
      const eased = 1 - (1 - progress) ** 3;
      this.position(worker, startX + (rect.left - startX) * eased, startY + (rect.top - startY) * eased);
    });
    if (this.disposed) return;
    if (preset.id === "typewriter") {
      const originalClip = element.style.clipPath;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let node;
      while ((node = walker.nextNode())) nodes.push(node);
      const text = nodes.map((item) => item.textContent).join("");
      const boundaries = [0];
      for (const character of text) boundaries.push(boundaries.at(-1) + character.length);
      try {
        await this.progress(config.duration, (progress) => {
          const rect = element.getBoundingClientRect();
          this.frameOutline(worker, rect);
          let offset = boundaries[Math.floor(progress * (boundaries.length - 1))];
          if (!nodes.length || offset === 0) { element.style.clipPath = "inset(0 100% 100% 0)"; return; }
          let index = 0;
          while (index < nodes.length - 1 && offset > nodes[index].length) offset -= nodes[index++].length;
          const range = document.createRange();
          range.setStart(nodes[0], 0);
          range.setEnd(nodes[index], offset);
          const line = [...range.getClientRects()].at(-1);
          if (!line) return;
          const x = Math.min(rect.width, Math.max(0, line.right - rect.left));
          const top = Math.max(0, line.top - rect.top);
          const bottom = Math.min(rect.height, line.bottom - rect.top);
          element.style.clipPath = `polygon(0 0,100% 0,100% ${top}px,${x}px ${top}px,${x}px ${bottom}px,0 ${bottom}px)`;
          this.position(worker, line.right, line.bottom);
        });
      } finally { element.style.clipPath = originalClip; }
    } else {
      const animation = element.animate(preset.frames(config), { duration: config.duration, easing: config.easing ?? "cubic-bezier(.2,.7,.2,1)", fill: "none" });
      this.animations.add(animation);
      try {
        await Promise.all([animation.finished, this.progress(config.duration, (progress) => {
          const rect = element.getBoundingClientRect();
          this.frameOutline(worker, rect);
          this.position(worker, rect.left + rect.width * progress, rect.top + rect.height * progress);
        })]);
      } finally { animation.cancel(); this.animations.delete(animation); }
    }
  }

  stop() {
    this.disposed = true;
    this.observer.disconnect();
    for (const animation of this.animations) animation.cancel();
    for (const { id, resolve } of this.frames.values()) { cancelAnimationFrame(id); resolve(); }
    for (const id of this.timers) clearTimeout(id);
    this.overlay.remove();
  }
}
