<script setup>
import { computed } from "vue";
import { withBase } from "vitepress";

const props = defineProps({ lang: { type: String, default: "en" } });

const COPY = {
  en: {
    statement:
      "Load NRRD and DICOM volumes in the browser, scrub the stack, paint mask layers over it, and read them back as voxels.",
    primary: "Read the NrrdTools guide",
    primaryLink: "/guide/nrrd-tools",
    secondary: "Browse the API",
    secondaryLink: "/apidist/modules",
    install: "npm i copper3d three",
    links: [
      { to: "/guide/upgrading-to-4", name: "Upgrading to 4.0", note: "three is a peer dependency now" },
      { to: "/guide/nrrd-tools", name: "NrrdTools", note: "The segmentation engine, end to end" },
      { to: "/guide/segmentation-module", name: "Segmentation module", note: "Architecture and internals" },
      { to: "/guide/load-callbacks", name: "Loading volumes", note: "Progress, errors, axes, cancellation" },
      { to: "/guide/camera-framing", name: "Camera framing", note: "Fitting, pose transitions, controls" },
      { to: "/guide/mcp-server", name: "AI coding assistants", note: "Give your agent the real API" },
    ],
  },
  zh: {
    statement:
      "在浏览器里加载 NRRD 与 DICOM 体数据，翻看切片，在上面绘制多层 mask，再把它们按体素读回来。",
    primary: "阅读 NrrdTools 指南",
    primaryLink: "/zh/guide/nrrd-tools",
    secondary: "查看 API",
    secondaryLink: "/apidist/modules",
    install: "npm i copper3d three",
    links: [
      { to: "/zh/guide/upgrading-to-4", name: "升级到 4.0", note: "three 现在是对等依赖" },
      { to: "/zh/guide/nrrd-tools", name: "NrrdTools", note: "分割引擎，从头到尾" },
      { to: "/zh/guide/segmentation-module", name: "分割模块", note: "架构与内部实现" },
      { to: "/zh/guide/load-callbacks", name: "加载体数据", note: "进度、错误、轴、取消" },
      { to: "/zh/guide/camera-framing", name: "相机取景", note: "取景、位姿过渡、控制器" },
      { to: "/zh/guide/mcp-server", name: "AI 编程助手", note: "把真实 API 交给你的 agent" },
    ],
  },
};

const t = computed(() => COPY[props.lang] ?? COPY.en);
</script>

<template>
  <div class="home">
    <section class="hero">
      <h1 class="mark">copper3d</h1>
      <p class="statement">{{ t.statement }}</p>

      <div class="actions">
        <a class="go" :href="withBase(t.primaryLink)">{{ t.primary }}</a>
        <a class="go alt" :href="withBase(t.secondaryLink)">{{ t.secondary }}</a>
      </div>

      <code class="install">{{ t.install }}</code>
    </section>

    <nav class="index">
      <a v-for="l in t.links" :key="l.to" class="row" :href="withBase(l.to)">
        <span class="name">{{ l.name }}</span>
        <span class="note">{{ l.note }}</span>
      </a>
    </nav>
  </div>
</template>

<style scoped>
.home {
  --emerald: #10b981;
  --rule: color-mix(in srgb, var(--vp-c-text-1) 12%, transparent);

  max-width: 940px;
  margin: 0 auto;
  padding: clamp(3.5rem, 11vw, 8rem) 24px clamp(4rem, 10vw, 7rem);
}

/* ── hero ──────────────────────────────────────────────── */
.mark {
  font-family: Archivo, ui-sans-serif, system-ui, sans-serif;
  font-weight: 800;
  font-stretch: 115%;
  font-size: clamp(3.5rem, 13vw, 8.5rem);
  line-height: 0.82;
  letter-spacing: -0.05em;
  margin: 0;
  color: var(--vp-c-text-1);
}

.statement {
  margin: 1.7rem 0 0;
  max-width: 34ch;
  font-size: clamp(1.1rem, 2.1vw, 1.5rem);
  line-height: 1.5;
  color: var(--vp-c-text-2);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  margin-top: 2.4rem;
}

.go {
  display: inline-block;
  padding: 0.66rem 1.2rem;
  border-radius: 2px;
  border: 1px solid var(--emerald);
  background: var(--emerald);
  color: #04120c;
  font-weight: 650;
  font-size: 0.95rem;
  text-decoration: none;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.go:hover { background: #0ea371; border-color: #0ea371; }

.go.alt {
  background: transparent;
  color: var(--vp-c-text-1);
  border-color: var(--rule);
}
.go.alt:hover { border-color: var(--emerald); color: var(--emerald); background: transparent; }

.go:focus-visible, .row:focus-visible {
  outline: 2px solid var(--emerald);
  outline-offset: 3px;
}

.install {
  display: inline-block;
  margin-top: 1.9rem;
  padding: 0.42rem 0.7rem;
  border: 1px dashed var(--rule);
  border-radius: 2px;
  font-size: 0.88rem;
  color: var(--vp-c-text-2);
  background: transparent;
}

/* ── index ─────────────────────────────────────────────── */
/* A plain list, not cards: these are destinations, and the only structure
   they need is the rule that separates one from the next. */
.index {
  margin-top: clamp(3.5rem, 9vw, 6rem);
  border-top: 1px solid var(--rule);
}

.row {
  display: grid;
  grid-template-columns: minmax(10rem, 15rem) 1fr;
  gap: 0.25rem 2rem;
  padding: 1.05rem 0.25rem;
  border-bottom: 1px solid var(--rule);
  text-decoration: none;
  color: inherit;
  transition: padding-left 0.18s ease;
}
.row:hover { padding-left: 0.85rem; }

.name {
  font-weight: 620;
  font-size: 1.02rem;
  color: var(--vp-c-text-1);
}
.row:hover .name { color: var(--emerald); }

.note {
  font-size: 0.93rem;
  color: var(--vp-c-text-3);
  align-self: center;
}

@media (max-width: 640px) {
  .row { grid-template-columns: 1fr; gap: 0.2rem; }
  .note { align-self: start; }
}

@media (prefers-reduced-motion: reduce) {
  .go, .row { transition: none; }
  .row:hover { padding-left: 0.25rem; }
}
</style>
