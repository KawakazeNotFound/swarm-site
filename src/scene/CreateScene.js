import {
  Colors,
  ContentLeft,
  ContentRight,
  LineEnd,
  LineStart,
  LogoPaths,
  TextLeft,
  TextStyles,
  monoStyle,
  sansStyle,
} from "./Theme.js";
import { measureText } from "./TextMetrics.js";
function createScene(workerCount) {
  const elements = [];
  const tasks = [];
  const groups = [];
  const elementsById = new Map();
  let defaultDependencies = [];
  const addElement = (element) => {
    elements.push(element);
    elementsById.set(element.id, element);
    return element;
  };
  const addTask = (id, y, spec, dependencies = defaultDependencies) => {
    tasks.push({
      id,
      y,
      spec,
      dependencies,
    });
    return id;
  };
  function addPath(id, points, options = {}) {
    addElement({
      kind: "path",
      id,
      revision: 0,
      visible: false,
      dx: 0,
      dy: 0,
      points,
      closed: !!options.closed,
      stroke: options.stroke ?? Colors.line,
      strokeWidth: options.strokeWidth ?? 1,
      fill: options.fill,
      d: options.d,
      transform: options.transform,
      add: options.add ?? true,
      placed: 0,
      pathClosed: false,
      editingPath: false,
      owner: null,
      fillVisible: false,
    });
    return addTask(
      "p:" + id,
      Math.min(...points.map((point) => point.y)),
      {
        type: "path",
        elementId: id,
      },
      options.dependencies ?? [],
    );
  }
  function addRectangle(id, x, y, width, height, options = {}) {
    addElement({
      kind: "rect",
      id,
      revision: 0,
      visible: false,
      dx: 0,
      dy: 0,
      x,
      y,
      w: width,
      h: height,
      r: options.r ?? 0,
      fill: options.fill ?? Colors.card,
      stroke: options.stroke,
      draw: null,
      styled: false,
    });
    return addTask(
      "r:" + id,
      y,
      {
        type: "rect",
        elementId: id,
      },
      options.dependencies ?? [],
    );
  }
  function addText(id, x, y, text, style, options = {}) {
    const content = style.upper ? text.toUpperCase() : text;
    addElement({
      kind: "text",
      id,
      revision: 0,
      visible: false,
      dx: 0,
      dy: 0,
      x,
      y,
      w: options.w,
      align: options.align ?? "left",
      text: content,
      displayedText: "",
      textStyle: style,
      size: style.size,
      editing: false,
      selectAll: false,
      dynamicText: options.dynamicText,
    });
    return addTask(
      "t:" + id,
      y,
      {
        type: "text",
        elementId: id,
        snapGuideId: options.snapGuideId,
        animateSize: options.animateSize,
      },
      options.dependencies ?? [],
    );
  }
  function addGuide(id, axis, position, taskY) {
    addElement({
      kind: "guide",
      id,
      revision: 0,
      visible: false,
      dx: 0,
      dy: 0,
      axis,
      position,
      current: position,
      opacity: 1,
      flash: 0,
      dragging: false,
    });
    return addTask(
      "g:" + id,
      taskY,
      {
        type: "guide",
        elementId: id,
      },
      [],
    );
  }
  function duplicateGroup(id, elementIds, copies) {
    const group = {
      id,
      elementIds,
      copies: [],
    };
    const dependencies = tasks
      .filter((task) => "elementId" in task.spec && elementIds.includes(task.spec.elementId))
      .map((task) => task.id);
    const copyTasks = [];
    copies.forEach((copy, copyIndex) => {
      const copyIds = [];
      let textIndex = 0;
      for (const elementId of elementIds) {
        const source = elementsById.get(elementId);
        const copyId = `${elementId}~${copyIndex + 1}`;
        copyIds.push(copyId);
        if (source.kind === "text") {
          const replacement = source.textStyle.upper
            ? copy.edits[textIndex]?.toUpperCase()
            : copy.edits[textIndex];
          addElement({
            ...source,
            id: copyId,
            x: source.x + copy.dx,
            y: source.y + copy.dy,
            text: replacement ?? source.text,
          });
          textIndex++;
        } else {
          if (source.kind === "rect") {
            addElement({
              ...source,
              id: copyId,
              x: source.x + copy.dx,
              y: source.y + copy.dy,
            });
          }
        }
      }
      group.copies.push({
        dx: copy.dx,
        dy: copy.dy,
        elementIds: copyIds,
      });
      const taskY = Math.min(...copyIds.map((elementId) => elementsById.get(elementId).y));
      copyTasks.push(
        addTask(
          `d:${id}:${copyIndex}`,
          taskY,
          {
            type: "dup",
            group: id,
            copyIndex,
          },
          dependencies,
        ),
      );
    });
    group.copies.forEach((copy) =>
      copy.elementIds.forEach((copyId, index) => {
        const copyElement = elementsById.get(copyId);
        const sourceElement = elementsById.get(elementIds[index]);
        if (
          copyElement.kind === "text" &&
          sourceElement.kind === "text" &&
          copyElement.text !== sourceElement.text
        ) {
          addTask(
            "e:" + copyId,
            copyElement.y,
            {
              type: "edit",
              elementId: copyId,
            },
            copyTasks,
          );
        }
      }),
    );
    groups.push(group);
  }
  function addSection(id, top, bottom, reverse = false) {
    defaultDependencies = [];
    const endpoints = reverse ? [LineEnd, LineStart] : [LineStart, LineEnd];
    addPath("rule-" + id, [
      {
        x: endpoints[0],
        y: bottom,
      },
      {
        x: endpoints[1],
        y: bottom,
      },
    ]);
    addPath("left-" + id, [
      {
        x: ContentLeft,
        y: top,
      },
      {
        x: ContentLeft,
        y: bottom,
      },
    ]);
    addPath("right-" + id, [
      {
        x: ContentRight,
        y: bottom,
      },
      {
        x: ContentRight,
        y: top,
      },
    ]);
  }
  const verticalLine = (id, x, top, bottom, dependencies) =>
    addPath(
      id,
      [
        {
          x,
          y: top,
        },
        {
          x,
          y: bottom,
        },
      ],
      {
        dependencies,
      },
    );
  const horizontalLine = (id, y, left = LineStart, right = LineEnd, dependencies) =>
    addPath(
      id,
      [
        {
          x: left,
          y,
        },
        {
          x: right,
          y,
        },
      ],
      {
        dependencies,
      },
    );
  const textWidth = (text, style) => measureText(text, style, style.size).w;
  const addLogo = (id, x, y, height) => {
    const transform = {
      x,
      y,
      scale: height / 140,
    };
    LogoPaths.forEach((logoPath, pathIndex) =>
      addPath(
        `${id}${pathIndex}`,
        logoPath.anchors.map(([anchorX, anchorY]) => ({
          x: x + anchorX * transform.scale,
          y: y + anchorY * transform.scale,
        })),
        {
          closed: true,
          stroke: Colors.ink,
          fill: Colors.ink,
          add: false,
          d: logoPath.d,
          transform,
        },
      ),
    );
  };
  defaultDependencies = [];
  const navigationStart = elements.length;
  addPath(
    "rule-top",
    [
      {
        x: LineStart,
        y: 24,
      },
      {
        x: LineEnd,
        y: 24,
      },
    ],
    {
      add: false,
    },
  );
  addSection("nav", 24, 88, true);
  addLogo("mark", ContentLeft + 24, 45, 22);
  addText("brand", ContentLeft + 52, 44, "Swarm", TextStyles.brand);
  addText("nav0", 540, 46, "Product", TextStyles.nav);
  duplicateGroup(
    "nav",
    ["nav0"],
    [
      {
        dx: 96,
        dy: 0,
        edits: ["Agents"],
      },
      {
        dx: 192,
        dy: 0,
        edits: ["Docs"],
      },
      {
        dx: 288,
        dy: 0,
        edits: ["Pricing"],
      },
    ],
  );
  verticalLine("nav-div", ContentRight - 176, 24, 88);
  addRectangle("nav-btn", ContentRight - 156, 36, 136, 40, {
    r: 8,
    fill: Colors.ink,
  });
  addText("nav-btn-t", ContentRight - 156, 46, "Get access", TextStyles.btn, {
    w: 136,
    align: "center",
    dependencies: ["r:nav-btn"],
  });
  elements.slice(navigationStart).forEach((element) => (element.sticky = true));
  addSection("hero", 88, 660);
  verticalLine("hero-div", 740, 88, 660);
  addGuide("g-hero", "x", TextLeft, 120);
  addGuide("g-hero-r", "x", 776, 120);
  addText(
    "h-title",
    TextLeft,
    192,
    `Run a thousand
agents as one.`,
    TextStyles.h1,
    {
      w: 580,
      snapGuideId: "g-hero",
      animateSize: true,
    },
  );
  addText(
    "h-lead",
    TextLeft,
    356,
    "Swarm schedules, routes and supervises AI agents across your stack, and runs their work in parallel.",
    TextStyles.lead,
    {
      w: 500,
      snapGuideId: "g-hero",
    },
  );
  addRectangle("h-btn1", TextLeft, 488, 184, 48, {
    r: 8,
    fill: Colors.ink,
  });
  addText("h-btn1-t", TextLeft, 501, "Start building", TextStyles.btn, {
    w: 184,
    align: "center",
    dependencies: ["r:h-btn1"],
  });
  addRectangle("h-btn2", TextLeft + 196, 488, 156, 48, {
    r: 8,
    fill: Colors.card,
    stroke: Colors.line,
  });
  addText("h-btn2-t", TextLeft + 196, 501, "Read the docs", TextStyles.btnDark, {
    w: 156,
    align: "center",
    dependencies: ["r:h-btn2"],
  });
  addRectangle("g-disp", 776, 162, 388, 64, {
    r: 10,
    fill: Colors.ink,
  });
  addText("g-disp-t", 800, 172, "swarm.dispatch(task)", TextStyles.nodeWhite, {
    dependencies: ["r:g-disp"],
  });
  addText("g-disp-s", 800, 194, "orchestrator · 18 tasks queued", monoStyle(12, "#8F949B"), {
    dependencies: ["r:g-disp"],
  });
  const graphStemTask = addPath(
    "g-stem",
    [
      {
        x: 970,
        y: 226,
      },
      {
        x: 970,
        y: 258,
      },
    ],
    {
      stroke: "#9DA2A9",
      dependencies: ["r:g-disp"],
    },
  );
  addPath(
    "g-bus",
    [
      {
        x: 866,
        y: 290,
      },
      {
        x: 866,
        y: 258,
      },
      {
        x: 1074,
        y: 258,
      },
      {
        x: 1074,
        y: 290,
      },
    ],
    {
      stroke: "#9DA2A9",
      dependencies: [graphStemTask],
    },
  );
  addRectangle("w0", 776, 290, 180, 64, {
    r: 10,
    fill: Colors.card,
    stroke: Colors.line,
  });
  addText("w0-n", 796, 301, "agent/research", TextStyles.nodeName, {
    dependencies: ["r:w0"],
  });
  addText("w0-s", 796, 323, "● 12 replicas", monoStyle(12, Colors.accent), {
    dependencies: ["r:w0"],
  });
  duplicateGroup(
    "workers",
    ["w0", "w0-n", "w0-s"],
    [
      {
        dx: 208,
        dy: 0,
        edits: ["agent/writer", "● 4 replicas"],
      },
      {
        dx: 0,
        dy: 104,
        edits: ["agent/review", "● 2 replicas"],
      },
      {
        dx: 208,
        dy: 104,
        edits: ["agent/deploy", "○ waiting"],
      },
    ],
  );
  addPath(
    "g-l1",
    [
      {
        x: 866,
        y: 354,
      },
      {
        x: 866,
        y: 394,
      },
    ],
    {
      stroke: "#9DA2A9",
      dependencies: ["d:workers:2"],
    },
  );
  addPath(
    "g-l2",
    [
      {
        x: 1074,
        y: 354,
      },
      {
        x: 1074,
        y: 394,
      },
    ],
    {
      stroke: "#9DA2A9",
      dependencies: ["d:workers:2"],
    },
  );
  addRectangle("g-track", 776, 540, 388, 6, {
    r: 3,
    fill: "#E1E3E6",
  });
  addRectangle("g-fill", 776, 540, 252, 6, {
    r: 3,
    fill: Colors.accent,
    dependencies: ["r:g-track"],
  });
  addText("g-stat", 776, 562, "4 agents · 18 tasks in flight · 0 conflicts", TextStyles.small, {
    snapGuideId: "g-hero-r",
  });
  addSection("logos", 660, 772, true);
  addText("l-label", TextLeft, 699, "Used by teams at", TextStyles.small, {
    w: 230,
  });
  for (let index = 0; index < 5; index++) {
    verticalLine("l-div" + index, 360 + index * 168, 660, 772);
  }
  addText("logo0", 388, 703, "Northwind", TextStyles.logo);
  duplicateGroup(
    "logos",
    ["logo0"],
    ["Halcyon", "Parallax", "Meridian", "Kestrel"].map((name, index) => ({
      dx: 168 * (index + 1),
      dy: 0,
      edits: [name],
    })),
  );
  addSection("fhead", 772, 960);
  addGuide("g-feat", "x", TextLeft, 790);
  addGuide("g-feat-r", "x", 760, 790);
  addText(
    "f-title",
    TextLeft,
    834,
    `Built for running agents
in production.`,
    TextStyles.h2,
    {
      w: 580,
      snapGuideId: "g-feat",
      animateSize: true,
    },
  );
  addText(
    "f-lead",
    760,
    840,
    "Routing, memory, supervision, fan-out, tracing and guardrails all come with the orchestrator.",
    TextStyles.body,
    {
      w: 380,
      snapGuideId: "g-feat-r",
    },
  );
  addSection("fgrid", 960, 1440, true);
  horizontalLine("f-mid", 1200);
  verticalLine("f-v1", 453, 960, 1440);
  verticalLine("f-v2", 826, 960, 1440);
  addGuide("g-cell", "x", ContentLeft + 36, 975);
  addGuide("g-cell-y", "y", 1e3, 975);
  addText("fc-title", ContentLeft + 36, 1e3, "Smart routing", TextStyles.h3, {
    snapGuideId: "g-cell-y",
  });
  addText(
    "fc-body",
    ContentLeft + 36,
    1036,
    "Send every task to the agent best equipped for it, based on skills, cost and live load.",
    TextStyles.body,
    {
      w: 296,
      snapGuideId: "g-cell",
    },
  );
  duplicateGroup(
    "features",
    ["fc-title", "fc-body"],
    [
      {
        dx: 373,
        dy: 0,
        edits: [
          "Shared memory",
          "Agents read and write one consistent context, so nobody does the same work twice.",
        ],
      },
      {
        dx: 746,
        dy: 0,
        edits: [
          "Supervisors",
          "Retry, escalate or hand off automatically when an agent gets stuck or drifts.",
        ],
      },
      {
        dx: 0,
        dy: 240,
        edits: [
          "Fan-out, fan-in",
          "Split big jobs across hundreds of workers and merge the results deterministically.",
        ],
      },
      {
        dx: 373,
        dy: 240,
        edits: [
          "Live traces",
          "Watch every decision as it happens, with replays down to a single tool call.",
        ],
      },
      {
        dx: 746,
        dy: 240,
        edits: [
          "Guardrails",
          "Budgets, approvals and policies that every agent in the swarm respects by default.",
        ],
      },
    ],
  );
  addSection("code", 1440, 1920);
  verticalLine("c-div", 600, 1440, 1920);
  addGuide("g-code", "x", TextLeft, 1460);
  addGuide("g-code-y", "y", 1772, 1600);
  addText(
    "c-title",
    TextLeft,
    1522,
    `One file describes
the whole swarm.`,
    TextStyles.h2,
    {
      w: 440,
      snapGuideId: "g-code",
      animateSize: true,
    },
  );
  addText(
    "c-body",
    TextLeft,
    1630,
    "One declarative file sets your agents, how work is routed between them, and what they’re allowed to spend. Review it in a pull request like any other code.",
    TextStyles.body,
    {
      w: 400,
      snapGuideId: "g-code",
    },
  );
  addText("c-link", TextLeft, 1772, "Read the spec", monoStyle(13, Colors.ink, 500), {
    snapGuideId: "g-code-y",
  });
  const codeWindowTask = addRectangle("c-win", 640, 1488, 520, 384, {
    r: 12,
    fill: Colors.code,
  });
  for (let index = 0; index < 3; index++) {
    addRectangle("c-dot" + index, 664 + index * 18, 1507, 10, 10, {
      r: 5,
      fill: "#30343A",
      dependencies: [codeWindowTask],
    });
  }
  addText(
    "c-file",
    1136 - textWidth("swarm.yaml", TextStyles.codeDim),
    1503,
    "swarm.yaml",
    TextStyles.codeDim,
    {
      dependencies: [codeWindowTask],
    },
  );
  addPath(
    "c-sep",
    [
      {
        x: 640,
        y: 1536,
      },
      {
        x: 1160,
        y: 1536,
      },
    ],
    {
      stroke: "#25282D",
      dependencies: [codeWindowTask],
    },
  );
  [
    "# swarm.yaml",
    "swarm: launch-week",
    "agents:",
    "  research: { model: fast, replicas: 12 }",
    "  writer:   { model: smart, replicas: 4 }",
    "  reviewer: { model: smart, replicas: 2 }",
    "routing:",
    "  strategy: skills-first",
    "  fallback: reviewer",
    "budget:",
    "  max_spend: $40/day",
    "  on_exceed: pause",
  ].forEach((line, index) =>
    addText("c-ln" + index, 664, 1556 + index * 23, line, TextStyles.code, {
      dependencies: [codeWindowTask],
    }),
  );
  addSection("stats", 1920, 2120, true);
  for (const x of [360, 640, 920]) {
    verticalLine("s-div" + x, x, 1920, 2120);
  }
  addGuide("g-stats", "y", 1960, 1930);
  addGuide("g-stats-x", "x", ContentLeft + 36, 1930);
  addText("st-n", ContentLeft + 36, 1960, "10k+", TextStyles.stat, {
    snapGuideId: "g-stats",
  });
  addText("st-l", ContentLeft + 36, 2028, "agents in a single swarm", TextStyles.body, {
    w: 220,
    snapGuideId: "g-stats-x",
  });
  duplicateGroup(
    "stats",
    ["st-n", "st-l"],
    [
      {
        dx: 280,
        dy: 0,
        edits: ["38ms", "median agent-to-agent handoff"],
      },
      {
        dx: 560,
        dy: 0,
        edits: ["99.99%", "orchestrator uptime, last 12 months"],
      },
      {
        dx: 840,
        dy: 0,
        edits: ["0", "tasks dropped last quarter"],
      },
    ],
  );
  addSection("steps", 2120, 2640);
  addGuide("g-steps", "x", TextLeft, 2140);
  addGuide("g-steps-c", "x", ContentLeft + 36, 2330);
  addText(
    "p-title",
    TextLeft,
    2194,
    `How a task moves
through Swarm.`,
    TextStyles.h2,
    {
      w: 640,
      snapGuideId: "g-steps",
      animateSize: true,
    },
  );
  const stepsDividerTask = horizontalLine("p-mid", 2320);
  verticalLine("p-v1", 453, 2320, 2640, [stepsDividerTask]);
  verticalLine("p-v2", 826, 2320, 2640, [stepsDividerTask]);
  addText("ps-t", ContentLeft + 36, 2364, "Define", sansStyle(26, 600, 1.2, Colors.ink, -0.02), {
    snapGuideId: "g-steps-c",
  });
  addText(
    "ps-b",
    ContentLeft + 36,
    2404,
    "Declare agents, skills and budgets in one file, versioned right next to your code.",
    TextStyles.body,
    {
      w: 296,
      snapGuideId: "g-steps-c",
    },
  );
  duplicateGroup(
    "steps",
    ["ps-t", "ps-b"],
    [
      {
        dx: 373,
        dy: 0,
        edits: [
          "Dispatch",
          "Swarm fans tasks out to the best agents and keeps every handoff ordered and observable.",
        ],
      },
      {
        dx: 746,
        dy: 0,
        edits: [
          "Converge",
          "Results stream back, get checked by supervisors, and land as one coherent change.",
        ],
      },
    ],
  );
  addSection("pricing", 2640, 3280, true);
  addGuide("g-price", "x", TextLeft, 2660);
  addGuide("g-price-r", "x", 760, 2660);
  addGuide("g-plan", "x", 144, 2860);
  addText(
    "$-title",
    TextLeft,
    2714,
    `Priced by the size
of your swarm.`,
    TextStyles.h2,
    {
      w: 520,
      snapGuideId: "g-price",
      animateSize: true,
    },
  );
  addText(
    "$-lead",
    760,
    2730,
    "Every plan includes the full orchestrator. You only pay more when your swarm gets bigger.",
    TextStyles.body,
    {
      w: 380,
      snapGuideId: "g-price-r",
    },
  );
  const planDependencies = [
    addRectangle("pc", 116, 2850, 330, 398, {
      r: 14,
      fill: Colors.card,
      stroke: Colors.line,
    }),
  ];
  addText("pc-name", 144, 2878, "Hive", sansStyle(16, 600, 1.3), {
    dependencies: planDependencies,
    snapGuideId: "g-plan",
  });
  addText("pc-price", 144, 2912, "$0", TextStyles.price, {
    dependencies: planDependencies,
    snapGuideId: "g-plan",
  });
  addText("pc-per", 144, 2966, "free forever", TextStyles.small, {
    dependencies: planDependencies,
  });
  addText(
    "pc-desc",
    144,
    3e3,
    "For tinkering with your first swarm on a weekend.",
    TextStyles.body,
    {
      w: 274,
      dependencies: planDependencies,
      snapGuideId: "g-plan",
    },
  );
  addRectangle("pc-rule", 144, 3070, 274, 1, {
    fill: Colors.line,
    dependencies: planDependencies,
  });
  addText("pc-f1", 144, 3088, "✓  Up to 10 agents", TextStyles.item, {
    dependencies: planDependencies,
  });
  addText("pc-f2", 144, 3116, "✓  Community support", TextStyles.item, {
    dependencies: planDependencies,
  });
  addText("pc-f3", 144, 3144, "✓  7-day trace history", TextStyles.item, {
    dependencies: planDependencies,
  });
  addRectangle("pc-btn", 144, 3176, 274, 44, {
    r: 8,
    fill: Colors.ink,
    dependencies: planDependencies,
  });
  addText("pc-btn-t", 144, 3187, "Start free", TextStyles.btn, {
    w: 274,
    align: "center",
    dependencies: ["r:pc-btn"],
  });
  duplicateGroup(
    "plans",
    [
      "pc",
      "pc-name",
      "pc-price",
      "pc-per",
      "pc-desc",
      "pc-rule",
      "pc-f1",
      "pc-f2",
      "pc-f3",
      "pc-btn",
      "pc-btn-t",
    ],
    [
      {
        dx: 355,
        dy: 0,
        edits: [
          "Colony",
          "$49",
          "per month, billed monthly",
          "For teams running agents in production, every day.",
          "✓  Up to 500 agents",
          "✓  Shared memory + supervisors",
          "✓  30-day trace history",
          "Get Colony",
        ],
      },
      {
        dx: 710,
        dy: 0,
        edits: [
          "Swarm",
          "Let’s talk",
          "annual contract",
          "For fleets that never sleep and never stop shipping.",
          "✓  Unlimited agents",
          "✓  SSO, audit logs, VPC",
          "✓  Dedicated orchestrator",
          "Contact sales",
        ],
      },
    ],
  );
  addSection("cta", 3280, 3690);
  verticalLine("cta-div", 800, 3280, 3690);
  addGuide("g-cta", "x", TextLeft, 3300);
  addGuide("g-cta-r", "x", 840, 3300);
  addText(
    "x-title",
    TextLeft,
    3352,
    `Let the swarm
build it.`,
    TextStyles.h1,
    {
      w: 560,
      snapGuideId: "g-cta",
      animateSize: true,
    },
  );
  addText(
    "x-lead",
    TextLeft,
    3506,
    "Start with ten agents for free. Scale to ten thousand when you’re ready.",
    TextStyles.lead,
    {
      w: 460,
      snapGuideId: "g-cta",
    },
  );
  addRectangle("x-btn", TextLeft, 3596, 184, 48, {
    r: 8,
    fill: Colors.ink,
  });
  addText("x-btn-t", TextLeft, 3609, "Start building", TextStyles.btn, {
    w: 184,
    align: "center",
    dependencies: ["r:x-btn"],
  });
  addText("x-count", 840, 3352, "", monoStyle(13, Colors.accent, 500), {
    w: 320,
    snapGuideId: "g-cta-r",
    dynamicText: () => `This page was built by ${workerCount()} agents while you scrolled.`,
  });
  addText(
    "x-note",
    840,
    3414,
    "Every line, guide and word above was placed by a cursor working alongside the others.",
    TextStyles.body,
    {
      w: 320,
      snapGuideId: "g-cta-r",
    },
  );
  addSection("footer", 3690, 3970, true);
  addGuide("g-foot", "x", 560, 3700);
  addLogo("fmark", ContentLeft + 36, 3735, 22);
  addText("f-brand", ContentLeft + 62, 3734, "Swarm", TextStyles.brand);
  addText("f-copy", ContentLeft + 36, 3916, "© 2026 Swarm Labs, Inc.", TextStyles.small);
  addText("fc-h", 560, 3738, "Product", sansStyle(14.5, 600, 1.4, Colors.ink), {
    snapGuideId: "g-foot",
  });
  addText("fc-1", 560, 3772, "Agents", TextStyles.item, {
    snapGuideId: "g-foot",
  });
  addText("fc-2", 560, 3802, "Routing", TextStyles.item);
  addText("fc-3", 560, 3832, "Pricing", TextStyles.item);
  duplicateGroup(
    "fcols",
    ["fc-h", "fc-1", "fc-2", "fc-3"],
    [
      {
        dx: 200,
        dy: 0,
        edits: ["Company", "About", "Careers", "Blog"],
      },
      {
        dx: 400,
        dy: 0,
        edits: ["Developers", "Docs", "API reference", "Status"],
      },
    ],
  );
  return {
    elements,
    tasks,
    groups,
    height: 4060,
  };
}
export { createScene };
