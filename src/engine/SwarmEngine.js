import { createScene } from "../scene/CreateScene.js";
import {
  CursorColors,
  CursorNames,
  FlockCursorCount,
  InitialCursorCount,
  MaximumWorkerCount,
  MinimumWorkerCount,
} from "./CursorSettings.js";
import { CanvasWidth, LineEnd, LineStart, NavigationTop, RulerThickness } from "../scene/Theme.js";
import {
  clamp,
  easeInOutCubic,
  easeOutCubic,
  randomBetween,
  touchElement,
} from "./AnimationMath.js";
import { lineHeight, measureText } from "../scene/TextMetrics.js";
class SwarmEngine {
  constructor() {
    this.elements = new Map();
    this.elementList = [];
    this.tasks = [];
    this.tasksById = new Map();
    this.groups = new Map();
    this.cursors = [];
    this.viewport = {
      scrollY: 0,
      height: 800,
      width: 1280,
      scale: 1,
      left: 0,
    };
    this.started = false;
    this.frontier = 0;
    this.scrollVelocity = 0;
    this.tempo = 1;
    this.time = 0;
    this.rulers = {
      activeDrags: 0,
      opacity: 0,
      lastNeededAt: -10,
    };
    this.lastScroll = 0;
    this.nextId = 0;
    this.spawnCooldown = 0;
    this.flocking = false;
    this.lastMouseTarget = null;
    this.targetVelocity = {
      x: 0,
      y: 0,
    };
    this.mouse = null;
    this.guideDependencies = new Map();
    this.retiredWorkers = 0;
    const scene = createScene(
      () => this.cursors.filter((cursor) => cursor.worked).length + this.retiredWorkers,
    );
    this.height = scene.height;
    for (const element of scene.elements) {
      this.elements.set(element.id, element);
      this.elementList.push(element);
    }
    for (const definition of scene.tasks) {
      const task = {
        ...definition,
        state: "wait",
        doneAt: 0,
      };
      this.tasks.push(task);
      this.tasksById.set(definition.id, task);
      if (definition.spec.type === "text" && definition.spec.snapGuideId) {
        const dependents = this.guideDependencies.get(definition.spec.snapGuideId) ?? [];
        dependents.push(task);
        this.guideDependencies.set(definition.spec.snapGuideId, dependents);
      }
    }
    for (const group of scene.groups) {
      this.groups.set(group.id, group);
    }
    for (let index = 0; index < InitialCursorCount; index++) {
      const angle = (index / InitialCursorCount) * Math.PI * 2;
      const cursor = this.makeCursor(
        CanvasWidth / 2 + Math.cos(angle) * 160,
        400 + Math.sin(angle) * 160,
        index < MinimumWorkerCount
          ? {
              x: 0,
              y: 0,
            }
          : null,
      );
      cursor.follow = true;
      this.cursors.push(cursor);
    }
  }
  makeCursor(x, y, home = null) {
    const id = this.nextId++;
    return {
      id,
      x,
      y,
      home,
      name: CursorNames[id % CursorNames.length],
      color: CursorColors[id % CursorColors.length],
      shape: "arrow",
      press: 0,
      task: null,
      routine: null,
      overlay: null,
      idleFor: 0,
      leaving: false,
      worked: false,
      sticky: false,
      vx: 0,
      vy: 0,
      angle: 0,
      ...(Math.random() < 0.25
        ? {
            speed: randomBetween(1e3, 1500),
            force: randomBetween(3500, 6e3),
            spin: randomBetween(2.2, 3.4),
          }
        : {
            speed: randomBetween(300, 750),
            force: randomBetween(700, 1800),
            spin: randomBetween(0.8, 1.8),
          }),
      curl: randomBetween(-1, 1),
      phase: randomBetween(0, Math.PI * 2),
      orbit: randomBetween(70, 170),
      spin: 0,
      follow: false,
    };
  }
  get viewTop() {
    return this.viewport.scrollY / this.viewport.scale;
  }
  get viewBottom() {
    return (this.viewport.scrollY + this.viewport.height) / this.viewport.scale;
  }
  get stickyOffset() {
    return Math.max(
      0,
      this.viewTop + (RulerThickness * this.rulers.opacity) / this.viewport.scale - NavigationTop,
    );
  }
  isSticky(task) {
    var element;
    const spec = task.spec;
    const elementId =
      spec.type === "dup" ? this.groups.get(spec.group).elementIds[0] : spec.elementId;
    return !!((element = this.elements.get(elementId)) != null && element.sticky);
  }
  fromViewport(x, y) {
    return {
      x: (x - this.viewport.left) / this.viewport.scale,
      y: (this.viewport.scrollY + y) / this.viewport.scale,
    };
  }
  start() {
    if (!this.started) {
      this.started = true;
      for (const cursor of this.cursors) {
        cursor.follow = false;
        cursor.routine = null;
        cursor.angle = ((((cursor.angle + 180) % 360) + 360) % 360) - 180;
      }
    }
  }
  bounds(element) {
    if (element.kind === "text") {
      const metrics = measureText(
        element.displayedText || " ",
        element.textStyle,
        element.size,
        element.w,
      );
      return {
        x: element.x + element.dx,
        y: element.y + element.dy,
        w: element.w ?? Math.max(metrics.w, 2),
        h: Math.max(metrics.h, lineHeight(element.textStyle, element.size)),
      };
    }
    if (element.kind === "rect") {
      return {
        x: element.x + element.dx,
        y: element.y + element.dy,
        w: element.draw?.w ?? element.w,
        h: element.draw?.h ?? element.h,
      };
    }
    if (element.kind === "path") {
      const xCoordinates = element.points.map((point) => point.x);
      const yCoordinates = element.points.map((point) => point.y);
      return {
        x: Math.min(...xCoordinates),
        y: Math.min(...yCoordinates),
        w: Math.max(...xCoordinates) - Math.min(...xCoordinates),
        h: Math.max(...yCoordinates) - Math.min(...yCoordinates),
      };
    }
    return {
      x: element.position,
      y: 0,
      w: 0,
      h: 0,
    };
  }
  unionBounds(elementIds) {
    const bounds = elementIds.map((id) => this.bounds(this.elements.get(id)));
    const left = Math.min(...bounds.map((bounds) => bounds.x));
    const top = Math.min(...bounds.map((bounds) => bounds.y));
    return {
      x: left,
      y: top,
      w: Math.max(...bounds.map((bounds) => bounds.x + bounds.w)) - left,
      h: Math.max(...bounds.map((bounds) => bounds.y + bounds.h)) - top,
    };
  }
  textUnderline(element) {
    const metrics = measureText(
      element.displayedText || " ",
      element.textStyle,
      element.size,
      element.w,
    );
    const bounds = this.bounds(element);
    const width = metrics.lines[0] ?? 0;
    return {
      x: element.align === "center" && element.w ? bounds.x + (element.w - width) / 2 : bounds.x,
      y: bounds.y + lineHeight(element.textStyle, element.size) * 0.5 + element.size * 0.42,
      w: width,
      h: 0,
    };
  }
  selection(element, options = {}) {
    const bounds = this.bounds(element);
    return {
      t: "box",
      b: bounds,
      handles: true,
      badge: `${Math.round(bounds.w)} × ${Math.round(bounds.h)}`,
      rulerLines: true,
      underline: element.kind === "text" ? this.textUnderline(element) : undefined,
      ...options,
    };
  }
  setScroll(scrollY) {
    this.viewport.scrollY = scrollY;
    if (scrollY > 4) {
      this.start();
    }
  }
  step(deltaTime) {
    deltaTime = Math.min(deltaTime, 0.05);
    this.time += deltaTime;
    const scale = this.viewport.scale;
    const scrollSpeed =
      Math.abs(this.viewport.scrollY - this.lastScroll) / scale / Math.max(deltaTime, 0.001);
    this.lastScroll = this.viewport.scrollY;
    this.scrollVelocity = Math.max(
      this.scrollVelocity * Math.exp(-deltaTime * 1.2),
      this.scrollVelocity * 0.7 + scrollSpeed * 0.3,
    );
    if (this.started) {
      this.frontier = Math.max(this.frontier, this.viewBottom);
    }
    const availableTasks = this.started ? this.available() : [];
    const busyCount = this.cursors.filter((cursor) => cursor.task).length;
    this.tempo = clamp(
      2.1 +
        this.scrollVelocity / 900 +
        (availableTasks.length / Math.max(1, this.cursors.length)) * 0.5,
      2.1,
      4.5,
    );
    if (this.rulers.activeDrags > 0) {
      this.rulers.lastNeededAt = this.time;
    }
    const rulerTarget = this.time - this.rulers.lastNeededAt < 0.7 ? 1 : 0;
    this.rulers.opacity += (rulerTarget - this.rulers.opacity) * Math.min(1, deltaTime * 10);
    if (Math.abs(rulerTarget - this.rulers.opacity) < 0.002) {
      this.rulers.opacity = rulerTarget;
    }
    for (const guide of this.elementList) {
      if (guide.kind !== "guide" || !guide.visible) {
        continue;
      }
      if (guide.flash > 0) {
        guide.flash = Math.max(0, guide.flash - deltaTime * 1.5);
        touchElement(guide);
      }
      const dependents = this.guideDependencies.get(guide.id) ?? [];
      if (!guide.dragging && dependents.every((task) => task.state === "done")) {
        const completedAt = Math.max(...dependents.map((task) => task.doneAt));
        if (this.time - completedAt > 1.2 && guide.opacity > 0) {
          guide.opacity = Math.max(0, guide.opacity - deltaTime * 1.2);
          touchElement(guide);
        }
      }
    }
    if (!this.flocking && this.started && this.tasks.every((task) => task.state !== "wait")) {
      for (const cursor of this.cursors) {
        if (!(cursor.task || cursor.follow)) {
          cursor.follow = true;
          cursor.routine = null;
          cursor.leaving = false;
          cursor.overlay = null;
          cursor.shape = "arrow";
        }
      }
      if (this.cursors.every((cursor) => cursor.follow)) {
        this.flocking = true;
      }
    }
    if (this.flocking) {
      this.flock(deltaTime);
      return;
    }
    if (!this.started) {
      const center = this.fromViewport(this.viewport.width / 2, this.viewport.height / 2);
      if (this.follow(deltaTime, this.cursors, center, 0.7)) {
        this.start();
      }
      return;
    }
    if (this.cursors.some((cursor) => cursor.follow)) {
      this.follow(
        deltaTime,
        this.cursors.filter((cursor) => cursor.follow),
      );
    }
    this.spawnCooldown -= deltaTime;
    const desiredCount = clamp(
      MinimumWorkerCount +
        Math.floor(this.scrollVelocity / 50) +
        Math.floor(availableTasks.length / 3),
      MinimumWorkerCount,
      MaximumWorkerCount,
    );
    const activeCount = this.cursors.filter((cursor) => !cursor.leaving).length;
    if (
      this.started &&
      activeCount < desiredCount &&
      availableTasks.length > activeCount - busyCount &&
      this.spawnCooldown <= 0
    ) {
      const enterLeft = Math.random() < 0.5;
      const position = this.fromViewport(
        enterLeft ? -40 : this.viewport.width + 40,
        randomBetween(0.2, 0.8) * this.viewport.height,
      );
      this.cursors.push(this.makeCursor(position.x, position.y));
      this.spawnCooldown = 0.035;
    }
    for (const cursor of this.cursors) {
      if (cursor.task || cursor.leaving || cursor.follow || !this.started) {
        continue;
      }
      const task = this.pick(cursor, availableTasks);
      if (task) {
        availableTasks.splice(availableTasks.indexOf(task), 1);
        task.state = "active";
        cursor.task = task;
        cursor.worked = true;
        if (this.isSticky(task)) {
          cursor.sticky = true;
          cursor.y -= this.stickyOffset;
        }
        cursor.idleFor = 0;
        cursor.routine = this.run(cursor, task);
      }
    }
    for (const cursor of [...this.cursors]) {
      if (cursor.follow) {
        continue;
      }
      cursor.press = Math.max(0, cursor.press - deltaTime * 6);
      if (cursor.angle !== 0) {
        cursor.angle =
          Math.abs(cursor.angle) < 0.5 ? 0 : cursor.angle * (1 - Math.min(1, deltaTime * 10));
      }
      if (!cursor.task) {
        cursor.idleFor += deltaTime;
        if (
          !cursor.leaving &&
          this.started &&
          cursor.idleFor > 2.5 &&
          this.cursors.filter((candidate) => !candidate.leaving).length > MinimumWorkerCount &&
          !cursor.home
        ) {
          cursor.leaving = true;
          cursor.routine = this.leave(cursor);
        }
        if (!cursor.routine) {
          cursor.routine = this.idle(cursor);
        }
      }
      if (cursor.routine.next(deltaTime).done) {
        if (cursor.task) {
          cursor.task.state = "done";
          cursor.task.doneAt = this.time;
          cursor.task = null;
          cursor.overlay = null;
          if (cursor.sticky) {
            cursor.sticky = false;
            cursor.y += this.stickyOffset;
          }
          cursor.shape = "arrow";
        }
        cursor.routine = null;
        if (cursor.leaving) {
          if (cursor.worked) {
            this.retiredWorkers++;
          }
          this.cursors.splice(this.cursors.indexOf(cursor), 1);
        }
      }
    }
  }
  flockTarget() {
    if (this.mouse) {
      return this.fromViewport(this.mouse.x, this.mouse.y);
    }
    const time = this.time;
    return this.fromViewport(
      this.viewport.width * (0.5 + 0.28 * Math.sin(time * 0.37)),
      this.viewport.height * (0.5 + 0.25 * Math.sin(time * 0.53 + 1)),
    );
  }
  flock(deltaTime) {
    this.spawnCooldown -= deltaTime;
    if (this.cursors.length < FlockCursorCount && this.spawnCooldown <= 0) {
      const enterLeft = Math.random() < 0.5;
      const position = this.fromViewport(
        enterLeft ? -30 : this.viewport.width + 30,
        randomBetween(0.1, 0.9) * this.viewport.height,
      );
      const cursor = this.makeCursor(position.x, position.y);
      cursor.follow = true;
      this.cursors.push(cursor);
      this.spawnCooldown = 0.04;
    }
    this.follow(deltaTime, this.cursors);
  }
  follow(deltaTime, cursors, targetOverride, radiusScale = 1) {
    const mouseTarget = this.mouse ? this.fromViewport(this.mouse.x, this.mouse.y) : null;
    const target = targetOverride ?? this.flockTarget();
    const time = this.time;
    if (mouseTarget && this.lastMouseTarget && deltaTime > 0) {
      const smoothing = Math.min(1, deltaTime * 18);
      this.targetVelocity.x +=
        ((mouseTarget.x - this.lastMouseTarget.x) / deltaTime - this.targetVelocity.x) * smoothing;
      this.targetVelocity.y +=
        ((mouseTarget.y - this.lastMouseTarget.y) / deltaTime - this.targetVelocity.y) * smoothing;
    }
    this.lastMouseTarget = mouseTarget;
    const orbitRadius = 135 * radiusScale * (1 + 0.18 * Math.sin(time * 0.55));
    const rotationDirection = Math.tanh(Math.cos(time * 0.11) * 3);
    const velocities = [];
    for (const cursor of cursors) {
      const offsetX = cursor.x - target.x;
      const offsetY = cursor.y - target.y;
      const distance = Math.hypot(offsetX, offsetY) || 0.01;
      const normalX = offsetX / distance;
      const normalY = offsetY / distance;
      const angle = Math.atan2(offsetY, offsetX);
      const orbitOffset = (cursor.orbit - 120) * 0.55 * radiusScale;
      const desiredRadius =
        orbitRadius * (1 + 0.3 * Math.sin(3 * angle + time * 0.7)) + orbitOffset;
      const tangentialSpeed = 300 * (0.7 + cursor.spin * 0.2) * rotationDirection;
      const radialSpeed = clamp((desiredRadius - distance) * 4, -2600, 1400);
      const curlWeight = Math.min(1, Math.max(0, (distance - desiredRadius) / 600));
      velocities.push([
        -normalY * tangentialSpeed +
          normalX * radialSpeed -
          normalY * cursor.curl * 400 * curlWeight,
        normalX * tangentialSpeed +
          normalY * radialSpeed +
          normalX * cursor.curl * 400 * curlWeight,
      ]);
    }
    for (let index = 0; index < cursors.length; index++) {
      const cursor = cursors[index];
      let neighborVelocityX = 0;
      let neighborVelocityY = 0;
      let neighborWeight = 0;
      for (let neighborIndex = 0; neighborIndex < cursors.length; neighborIndex++) {
        if (neighborIndex === index) {
          continue;
        }
        const neighbor = cursors[neighborIndex];
        const distance = Math.hypot(neighbor.x - cursor.x, neighbor.y - cursor.y);
        if (distance > 90) {
          continue;
        }
        const weight = 1 - distance / 90;
        neighborVelocityX += neighbor.vx * weight;
        neighborVelocityY += neighbor.vy * weight;
        neighborWeight += weight;
      }
      let [velocityX, velocityY] = velocities[index];
      if (neighborWeight > 0) {
        velocityX = velocityX * 0.7 + (neighborVelocityX / neighborWeight) * 0.3;
        velocityY = velocityY * 0.7 + (neighborVelocityY / neighborWeight) * 0.3;
      }
      const excessDistance = Math.max(
        0,
        Math.hypot(cursor.x - target.x, cursor.y - target.y) - 180 * radiusScale,
      );
      const maximumSpeed = cursor.speed * (1.3 + Math.min(3.2, excessDistance / 90));
      const speed = Math.hypot(velocityX, velocityY);
      if (speed > maximumSpeed) {
        velocityX *= maximumSpeed / speed;
        velocityY *= maximumSpeed / speed;
      }
      let accelerationX = (velocityX - cursor.vx) * 6;
      let accelerationY = (velocityY - cursor.vy) * 6;
      const maximumForce = cursor.force * (1.4 + Math.min(5, excessDistance / 50));
      const force = Math.hypot(accelerationX, accelerationY);
      if (force > maximumForce) {
        accelerationX *= maximumForce / force;
        accelerationY *= maximumForce / force;
      }
      cursor.vx += accelerationX * deltaTime;
      cursor.vy += accelerationY * deltaTime;
      cursor.x += cursor.vx * deltaTime;
      cursor.y += cursor.vy * deltaTime;
    }
    const mouseRadius = 48;
    let mouseCollision = false;
    if (mouseTarget) {
      for (const cursor of cursors) {
        const offsetX = cursor.x - mouseTarget.x;
        const offsetY = cursor.y - mouseTarget.y;
        const distance = Math.hypot(offsetX, offsetY) || 0.01;
        if (distance >= mouseRadius) {
          continue;
        }
        mouseCollision = true;
        const normalX = offsetX / distance;
        const normalY = offsetY / distance;
        cursor.x = mouseTarget.x + normalX * mouseRadius;
        cursor.y = mouseTarget.y + normalY * mouseRadius;
        const relativeVelocity =
          (cursor.vx - this.targetVelocity.x) * normalX +
          (cursor.vy - this.targetVelocity.y) * normalY;
        if (relativeVelocity < 0) {
          cursor.vx -= normalX * relativeVelocity * 1.6;
          cursor.vy -= normalY * relativeVelocity * 1.6;
        }
        cursor.vx += normalX * 260;
        cursor.vy += normalY * 260;
      }
    }
    for (const cursor of cursors) {
      const velocityX = cursor.vx;
      const velocityY = cursor.vy;
      if (Math.hypot(velocityX, velocityY) < 30) {
        continue;
      }
      const angleDelta =
        (((Math.atan2(velocityY, velocityX) * 180) / Math.PI + 128 - cursor.angle + 540) % 360) -
        180;
      cursor.angle += angleDelta * Math.min(1, deltaTime * 8);
      cursor.press = Math.max(0, cursor.press - deltaTime * 6);
    }
    return mouseCollision;
  }
  available() {
    const tasks = [];
    for (const task of this.tasks) {
      if (!(task.state !== "wait" || task.y > this.frontier)) {
        if (
          task.dependencies.every((dependencyId) => {
            return this.tasksById.get(dependencyId)?.state === "done";
          })
        ) {
          tasks.push(task);
        }
      }
    }
    return tasks;
  }
  pick(cursor, tasks) {
    let bestTask = null;
    let bestScore = 1 / 0;
    const top = this.viewTop - 40;
    const bottom = this.viewBottom;
    for (const task of tasks) {
      const priority = task.y >= top && task.y <= bottom ? 0 : task.y < top ? 1 : 2;
      const score =
        priority * 1e6 +
        (priority === 1 ? top - task.y : task.y) * 0.6 +
        Math.abs(task.y - cursor.y) * 0.4;
      if (score < bestScore) {
        bestScore = score;
        bestTask = task;
      }
    }
    return bestTask;
  }
  *wait(duration) {
    let elapsed = 0;
    for (; elapsed < duration;) {
      elapsed += (yield) * this.tempo;
    }
  }
  *moveTo(cursor, target, options = {}) {
    var initialStep;
    var movingStep;
    var finalStep;
    const getTarget = typeof target == "function" ? target : () => target;
    const startX = cursor.x;
    const startY = cursor.y;
    const initialTarget = getTarget();
    const distance = Math.hypot(initialTarget.x - startX, initialTarget.y - startY);
    if (distance < 0.5) {
      cursor.x = initialTarget.x;
      cursor.y = initialTarget.y;
      if (!((initialStep = options.onStep) == null)) {
        initialStep.call(options);
      }
      return;
    }
    const duration = clamp(0.12 + Math.sqrt(distance) * 0.021, 0.14, 0.9) / (options.speed ?? 1);
    const bend =
      (options.bend ?? (Math.random() < 0.5 ? -1 : 1) * randomBetween(0.04, 0.14)) *
      Math.min(distance, 600);
    let elapsed = 0;
    for (; elapsed < duration;) {
      elapsed += (yield) * this.tempo;
      const progress = Math.min(1, elapsed / duration);
      const easedProgress =
        options.drag || progress < 0.15 ? easeInOutCubic(progress) : easeOutCubic(progress);
      const destination = getTarget();
      const offsetX = destination.x - startX;
      const offsetY = destination.y - startY;
      const distance = Math.hypot(offsetX, offsetY) || 1;
      const curveOffset = Math.sin(Math.PI * easedProgress) * bend;
      cursor.x = startX + offsetX * easedProgress + (-offsetY / distance) * curveOffset;
      cursor.y = startY + offsetY * easedProgress + (offsetX / distance) * curveOffset;
      if (!((movingStep = options.onStep) == null)) {
        movingStep.call(options);
      }
    }
    const finalTarget = getTarget();
    cursor.x = finalTarget.x;
    cursor.y = finalTarget.y;
    if (!((finalStep = options.onStep) == null)) {
      finalStep.call(options);
    }
  }
  *click(cursor) {
    cursor.press = 1;
    yield* this.wait(0.07);
  }
  *type(element, text, replace = false) {
    for (let index = 0; index < text.length; index++) {
      if (index === 0 && replace) {
        element.displayedText = "";
      }
      element.displayedText += text[index];
      element.selectAll = false;
      touchElement(element);
      let delay = randomBetween(0.012, 0.04);
      if (text[index] === " ") {
        delay += randomBetween(0, 0.03);
      }
      if (
        text[index] ===
        `
`
      ) {
        delay += 0.1;
      }
      if (Math.random() < 0.025) {
        delay += randomBetween(0.08, 0.2);
      }
      yield* this.wait(delay);
    }
  }
  *idle(cursor) {
    if (!this.started && cursor.home) {
      const home = cursor.home;
      const phase = randomBetween(0, 6);
      for (; !this.started;) {
        const time = this.time;
        cursor.x = home.x + Math.sin(time * 1.3 + phase) * 3;
        cursor.y = home.y + Math.cos(time * 1.7 + phase) * 2.5;
        yield;
      }
    }
    for (;;) {
      const top = this.viewTop;
      const bottom = this.viewBottom;
      const target = {
        x: randomBetween(220, 1060),
        y: randomBetween(top + (bottom - top) * 0.2, top + (bottom - top) * 0.8),
      };
      yield* this.moveTo(cursor, target, {
        speed: 0.35,
      });
      let pause = randomBetween(0.4, 1.4);
      for (
        ;
        pause > 0 && ((pause -= yield), !(cursor.y < this.viewTop || cursor.y > this.viewBottom));
      ) {}
    }
  }
  *leave(cursor) {
    const exitRight = cursor.x > CanvasWidth / 2;
    yield* this.moveTo(
      cursor,
      () =>
        this.fromViewport(
          exitRight ? this.viewport.width + 60 : -60,
          (cursor.y - this.viewTop) * this.viewport.scale,
        ),
      {
        speed: 0.8,
      },
    );
  }
  run(cursor, task) {
    const spec = task.spec;
    switch (spec.type) {
      case "path":
        return this.drawPath(cursor, this.elements.get(spec.elementId));
      case "rect":
        return this.drawRect(cursor, this.elements.get(spec.elementId));
      case "text":
        return this.drawText(
          cursor,
          this.elements.get(spec.elementId),
          spec.snapGuideId ? this.elements.get(spec.snapGuideId) : null,
          !!spec.animateSize,
        );
      case "guide":
        return this.dragGuide(cursor, this.elements.get(spec.elementId));
      case "dup":
        return this.duplicate(cursor, this.groups.get(spec.group), spec.copyIndex);
      case "edit":
        return this.editText(cursor, this.elements.get(spec.elementId));
    }
  }
  anchor(point) {
    return point.x <= LineStart
      ? () => ({
          x: this.fromViewport(6, 0).x,
          y: point.y,
        })
      : point.x >= LineEnd
        ? () => ({
            x: this.fromViewport(this.viewport.width - 6, 0).x,
            y: point.y,
          })
        : point;
  }
  *drawPath(cursor, element) {
    if (element.d) {
      return yield* this.drawLogo(cursor, element);
    }
    cursor.shape = element.add ? "pen-add" : "pen";
    yield* this.moveTo(cursor, this.anchor(element.points[0]));
    yield* this.click(cursor);
    element.visible = true;
    element.editingPath = true;
    element.placed = 1;
    element.owner = cursor.id;
    touchElement(element);
    cursor.shape = "pen";
    for (let index = 1; index < element.points.length; index++) {
      yield* this.moveTo(cursor, this.anchor(element.points[index]), {
        bend: randomBetween(-0.03, 0.03),
      });
      yield* this.click(cursor);
      element.placed = index + 1;
      touchElement(element);
      yield* this.wait(randomBetween(0.04, 0.12));
    }
    if (element.closed) {
      cursor.shape = "pen-close";
      yield* this.moveTo(cursor, element.points[0], {
        bend: randomBetween(-0.03, 0.03),
      });
      yield* this.click(cursor);
      element.pathClosed = true;
      touchElement(element);
    }
    element.owner = null;
    touchElement(element);
    cursor.shape = "pen";
    yield* this.moveTo(
      cursor,
      {
        x: cursor.x + randomBetween(14, 30),
        y: cursor.y + randomBetween(10, 24),
      },
      {
        speed: 1.4,
      },
    );
    yield* this.wait(0.3);
    element.editingPath = false;
    if (element.fill) {
      element.fillVisible = true;
    }
    touchElement(element);
  }
  *drawLogo(cursor, element) {
    cursor.shape = "pen";
    yield* this.moveTo(cursor, this.anchor(element.points[0]));
    element.visible = true;
    element.placed = 1;
    touchElement(element);
    for (let index = 1; index <= element.points.length; index++) {
      yield* this.moveTo(cursor, element.points[index % element.points.length], {
        speed: 1.6,
      });
      element.placed = index + 1;
      touchElement(element);
    }
    element.pathClosed = true;
    element.fillVisible = true;
    touchElement(element);
    yield* this.moveTo(
      cursor,
      {
        x: cursor.x + randomBetween(14, 30),
        y: cursor.y + randomBetween(10, 24),
      },
      {
        speed: 1.4,
      },
    );
  }
  *drawRect(cursor, element) {
    cursor.shape = "cross";
    yield* this.moveTo(cursor, {
      x: element.x,
      y: element.y,
    });
    cursor.press = 1;
    element.visible = true;
    element.draw = {
      w: 0,
      h: 0,
    };
    touchElement(element);
    cursor.overlay = () => [this.selection(element)];
    yield* this.moveTo(
      cursor,
      {
        x: element.x + element.w,
        y: element.y + element.h,
      },
      {
        speed: 0.75,
        drag: true,
        bend: 0,
        onStep: () => {
          element.draw = {
            w: Math.max(0, cursor.x - element.x),
            h: Math.max(0, cursor.y - element.y),
          };
          touchElement(element);
        },
      },
    );
    element.draw = null;
    touchElement(element);
    cursor.shape = "arrow";
    yield* this.wait(randomBetween(0.18, 0.3));
    element.styled = true;
    touchElement(element);
    yield* this.wait(0.35);
    cursor.overlay = null;
  }
  *drawText(cursor, element, guide, grow) {
    if (element.dynamicText) {
      element.text = element.dynamicText();
    }
    if (guide) {
      if (guide.axis === "x") {
        element.dx = randomBetween(28, 64);
        element.dy = randomBetween(-8, 8);
      } else {
        element.dx = randomBetween(-8, 8);
        element.dy = randomBetween(18, 34) * (Math.random() < 0.5 ? -1 : 1);
      }
    }
    if (grow) {
      element.size = 18;
    }
    const startX = element.x + element.dx;
    const startY = element.y + element.dy;
    cursor.shape = "cross";
    yield* this.moveTo(cursor, {
      x: startX,
      y: startY,
    });
    if (element.w == null) {
      yield* this.click(cursor);
      element.visible = true;
      element.editing = true;
      touchElement(element);
    } else {
      cursor.press = 1;
      const selectionBox = {
        kind: "rect",
        id: "",
        revision: 0,
        visible: true,
        dx: 0,
        dy: 0,
        x: startX,
        y: startY,
        w: 0,
        h: 0,
        r: 0,
        fill: "",
        draw: null,
        styled: true,
      };
      const height = lineHeight(element.textStyle, element.size);
      cursor.overlay = () => [this.selection(selectionBox)];
      yield* this.moveTo(
        cursor,
        {
          x: startX + element.w,
          y: startY + height,
        },
        {
          speed: 0.9,
          drag: true,
          bend: 0,
          onStep: () => {
            selectionBox.w = Math.max(0, cursor.x - startX);
            selectionBox.h = Math.max(0, cursor.y - startY);
          },
        },
      );
      element.visible = true;
      element.editing = true;
      touchElement(element);
    }
    cursor.shape = "ibeam";
    cursor.overlay = () => [
      {
        t: "box",
        b: this.bounds(element),
      },
    ];
    yield* this.moveTo(
      cursor,
      {
        x: cursor.x + randomBetween(-30, 10),
        y: cursor.y + randomBetween(10, 30),
      },
      {
        speed: 1.5,
      },
    );
    yield* this.type(element, element.text);
    yield* this.wait(0.12);
    element.editing = false;
    touchElement(element);
    cursor.shape = "arrow";
    cursor.overlay = () => [this.selection(element)];
    if (grow) {
      const sizes = [24, 32, 40, 48, 56, 64, 72].filter((size) => size < element.textStyle.size);
      for (const size of [...sizes, element.textStyle.size]) {
        yield* this.wait(0.06);
        element.size = size;
        touchElement(element);
      }
      yield* this.wait(0.15);
    }
    if (guide) {
      const guideTask = this.tasksById.get("g:" + guide.id);
      for (; guideTask.state !== "done";) {
        yield;
      }
      const bounds = this.bounds(element);
      const dragStart = {
        x: bounds.x + Math.min(bounds.w * 0.4, 60) + randomBetween(-6, 6),
        y: bounds.y + Math.min(bounds.h * 0.5, 22),
      };
      yield* this.moveTo(cursor, dragStart);
      cursor.press = 1;
      const snapPoint = {
        x: dragStart.x - element.dx,
        y: dragStart.y - element.dy,
      };
      const nearSnapPoint = {
        x: snapPoint.x + (guide.axis === "x" ? -randomBetween(2, 5) : randomBetween(-6, 6)),
        y: snapPoint.y + (guide.axis === "y" ? -randomBetween(2, 5) : randomBetween(-3, 3)),
      };
      const updateOffset = () => {
        let offsetX = cursor.x - snapPoint.x;
        let offsetY = cursor.y - snapPoint.y;
        if (guide.axis === "x" && Math.abs(offsetX) < 9) {
          if (offsetX !== 0 && element.dx !== 0) {
            guide.flash = 1;
          }
          offsetX = 0;
        }
        if (guide.axis === "y" && Math.abs(offsetY) < 9) {
          if (offsetY !== 0 && element.dy !== 0) {
            guide.flash = 1;
          }
          offsetY = 0;
        }
        element.dx = offsetX;
        element.dy = offsetY;
        touchElement(element);
        touchElement(guide);
      };
      yield* this.moveTo(cursor, nearSnapPoint, {
        speed: 0.6,
        drag: true,
        onStep: updateOffset,
      });
      yield* this.wait(0.1);
      yield* this.moveTo(cursor, snapPoint, {
        speed: 2,
        onStep: updateOffset,
      });
      element.dx = 0;
      element.dy = 0;
      touchElement(element);
      yield* this.wait(0.25);
    } else {
      yield* this.wait(0.2);
    }
    cursor.overlay = null;
  }
  *dragGuide(cursor, guide) {
    this.rulers.activeDrags++;
    try {
      const offset = randomBetween(-0.15, 0.15);
      const rulerPoint = () =>
        guide.axis === "x"
          ? this.fromViewport(10, this.viewport.height * (0.45 + offset))
          : this.fromViewport(
              this.viewport.left +
                (guide.position > 0 ? 400 : 300) * this.viewport.scale +
                offset * 200,
              10,
            );
      for (
        cursor.shape = "arrow", yield* this.moveTo(cursor, rulerPoint);
        this.rulers.opacity < 0.95;
      ) {
        yield;
      }
      yield* this.moveTo(cursor, rulerPoint, {
        speed: 3,
      });
      cursor.press = 1;
      cursor.shape = guide.axis === "x" ? "ew" : "ns";
      guide.visible = true;
      guide.dragging = true;
      guide.opacity = 1;
      const updateGuide = () => {
        guide.current = guide.axis === "x" ? cursor.x : cursor.y;
        touchElement(guide);
      };
      updateGuide();
      const targetPoint = () => {
        const start = rulerPoint();
        return guide.axis === "x"
          ? {
              x: guide.position,
              y: start.y + 40,
            }
          : {
              x: start.x + 30,
              y: guide.position,
            };
      };
      yield* this.moveTo(cursor, targetPoint, {
        speed: 0.55,
        drag: true,
        onStep: updateGuide,
      });
      guide.current = guide.position;
      guide.dragging = false;
      touchElement(guide);
      cursor.shape = "arrow";
      yield* this.wait(0.25);
    } finally {
      this.rulers.activeDrags--;
    }
  }
  *duplicate(cursor, group, copyIndex) {
    const copy = group.copies[copyIndex];
    const sources = [
      {
        dx: 0,
        dy: 0,
        elementIds: group.elementIds,
      },
      ...group.copies.filter((candidate, index) => {
        return this.tasksById.get(`d:${group.id}:${index}`)?.state === "done";
      }),
    ];
    let source = sources[0];
    for (const candidate of sources) {
      if (
        Math.hypot(candidate.dx - copy.dx, candidate.dy - copy.dy) <
        Math.hypot(source.dx - copy.dx, source.dy - copy.dy)
      ) {
        source = candidate;
      }
    }
    const sourceBounds = this.unionBounds(source.elementIds);
    cursor.shape = "arrow";
    const dragStart = {
      x: sourceBounds.x + Math.min(sourceBounds.w * 0.45, 70) + randomBetween(-8, 8),
      y: sourceBounds.y + Math.min(sourceBounds.h * 0.45, 30) + randomBetween(-4, 4),
    };
    yield* this.moveTo(cursor, dragStart);
    yield* this.click(cursor);
    cursor.overlay = () => [
      {
        t: "box",
        b: sourceBounds,
        handles: true,
        badge: `${Math.round(sourceBounds.w)} × ${Math.round(sourceBounds.h)}`,
      },
    ];
    yield* this.wait(randomBetween(0.15, 0.3));
    cursor.shape = "dup";
    yield* this.wait(0.12);
    cursor.press = 1;
    const offsetX = source.dx - copy.dx;
    const offsetY = source.dy - copy.dy;
    copy.elementIds.forEach((id, index) => {
      const element = this.elements.get(id);
      const original = this.elements.get(group.elementIds[index]);
      element.visible = true;
      element.dx = offsetX;
      element.dy = offsetY;
      if (element.kind === "text" && original.kind === "text") {
        element.displayedText = original.text;
      }
      if (element.kind === "rect") {
        element.styled = true;
      }
      touchElement(element);
    });
    const dragEnd = {
      x: dragStart.x - offsetX,
      y: dragStart.y - offsetY,
    };
    cursor.overlay = () => {
      const bounds = this.unionBounds(copy.elementIds);
      const overlays = [
        {
          t: "box",
          b: sourceBounds,
          color: "red",
        },
        {
          t: "box",
          b: bounds,
          color: "red",
        },
      ];
      const measurement = this.spacing(sourceBounds, bounds);
      if (measurement) {
        overlays.push(measurement);
      }
      return overlays;
    };
    yield* this.moveTo(cursor, dragEnd, {
      speed: 0.6,
      drag: true,
      onStep: () => {
        copy.elementIds.forEach((id) => {
          const element = this.elements.get(id);
          element.dx = cursor.x - dragEnd.x;
          element.dy = cursor.y - dragEnd.y;
          touchElement(element);
        });
      },
    });
    yield* this.wait(0.1);
    cursor.shape = "arrow";
    cursor.overlay = () => {
      const bounds = this.unionBounds(copy.elementIds);
      return [
        {
          t: "box",
          b: bounds,
          handles: true,
          badge: `${Math.round(bounds.w)} × ${Math.round(bounds.h)}`,
        },
      ];
    };
    yield* this.wait(0.35);
  }
  spacing(first, second) {
    const overlapY = Math.min(first.y + first.h, second.y + second.h) - Math.max(first.y, second.y);
    const overlapX = Math.min(first.x + first.w, second.x + second.w) - Math.max(first.x, second.x);
    if (overlapY > 0) {
      const centerY = Math.max(first.y, second.y) + overlapY / 2;
      const [left, right] = first.x < second.x ? [first, second] : [second, first];
      const gap = right.x - (left.x + left.w);
      if (gap > 0) {
        return {
          t: "measure",
          a: {
            x: left.x + left.w,
            y: centerY,
          },
          b: {
            x: right.x,
            y: centerY,
          },
          label: String(Math.round(gap)),
        };
      }
    } else if (overlapX > 0) {
      const centerX = Math.max(first.x, second.x) + overlapX / 2;
      const [top, bottom] = first.y < second.y ? [first, second] : [second, first];
      const gap = bottom.y - (top.y + top.h);
      if (gap > 0) {
        return {
          t: "measure",
          a: {
            x: centerX,
            y: top.y + top.h,
          },
          b: {
            x: centerX,
            y: bottom.y,
          },
          label: String(Math.round(gap)),
        };
      }
    }
    return null;
  }
  *editText(cursor, element) {
    cursor.shape = "arrow";
    const bounds = this.bounds(element);
    const width =
      measureText(element.displayedText, element.textStyle, element.size, element.w).lines[0] ??
      bounds.w;
    const left =
      element.align === "center" && element.w ? bounds.x + (element.w - width) / 2 : bounds.x;
    yield* this.moveTo(cursor, {
      x: left + Math.min(width * 0.5, 50) + randomBetween(-5, 5),
      y: bounds.y + lineHeight(element.textStyle, element.size) * 0.55,
    });
    yield* this.click(cursor);
    yield* this.wait(0.08);
    yield* this.click(cursor);
    element.editing = true;
    element.selectAll = true;
    touchElement(element);
    cursor.shape = "ibeam";
    cursor.overlay = () => [
      {
        t: "box",
        b: this.bounds(element),
      },
    ];
    yield* this.wait(randomBetween(0.2, 0.35));
    yield* this.type(element, element.text, true);
    yield* this.wait(0.12);
    element.editing = false;
    touchElement(element);
    cursor.shape = "arrow";
    cursor.overlay = () => [this.selection(element)];
    yield* this.wait(0.3);
  }
}
export { SwarmEngine };
