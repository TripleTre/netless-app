import type { SyncEvent } from "@netless/slide";
import type { Room, ScenePathType } from "white-web-sdk";
import type { DocsViewerPage } from "../DocsViewer";

import { SLIDE_EVENTS, Slide } from "@netless/slide";
import { clamp } from "./helpers";

/**
 * 因为 slide 的 `renderSlide()` 比较耗时，而切 scene 很快，这里让 scene 跟随 slide 的状态。
 *
 * 同时，UI 也应该和 slide 对齐。考虑到快速点击下一页的情况：slide 无法立刻切到下一页。我们应该记住当前的
 * "目标页"，slide 的 `renderEnd` 没触发前不再继续调用 `renderSlide()`。
 */
export function syncSceneWithSlide(room: Room, slide: Slide, baseScenePath: string) {
  const page = slide.slideState.currentSlideIndex;
  // 如果不存在 currentSlideIndex，可能没初始化完，此时什么都不做
  if (page == null) return;

  const scenePath = [baseScenePath, page].join("/");
  // 这里用 === none 而不是 !== page，是因为这个接口有 bug，最新的 sdk 才修掉
  if (room.scenePathType(scenePath) === ("none" as ScenePathType.None)) {
    // 如果不存在对应 scene，重新创建一遍
    room.removeScenes(baseScenePath);
    const count = slide.slideCount;
    const scenes: { name: string }[] = [];
    for (let i = 1; i <= count; ++i) scenes.push({ name: `${i}` });
    room.putScenes(baseScenePath, scenes);
  }

  room.setScenePath(scenePath);
}

export function createDocsViewerPages(slide: Slide): DocsViewerPage[] {
  const { width, height, slideCount, slideState } = slide;
  const { taskId, url } = slideState;
  const pages: DocsViewerPage[] = [];
  for (let i = 1; i <= slideCount; ++i) {
    pages.push({ width, height, thumbnail: `${url}/${taskId}/preview/${i}.png`, src: "ppt" });
  }
  return pages;
}

export class SlideController {
  readonly ready: Promise<this>;
  private resolveReady!: (slideController: this) => void;

  constructor(
    public readonly slide: Slide,
    readonly onPageChanged: (page: number) => void,
    readonly onTransitionStart: () => void,
    readonly onTransitionEnd: () => void,
    readonly onDispatchSyncEvent: (event: SyncEvent) => void,
    readonly initialState: Slide["slideState"] | null,
    readonly initialPage: number
  ) {
    slide.on(SLIDE_EVENTS.slideChange, onPageChanged);

    slide.on(SLIDE_EVENTS.renderStart, onTransitionStart);
    slide.on(SLIDE_EVENTS.renderEnd, onTransitionEnd);
    // slide.on(SLIDE_EVENTS.animateStart, onTransitionStart);
    // slide.on(SLIDE_EVENTS.animateEnd, onTransitionEnd);
    slide.on(SLIDE_EVENTS.mainSeqStepStart, onTransitionStart);
    slide.on(SLIDE_EVENTS.mainSeqStepEnd, onTransitionEnd);

    slide.on(SLIDE_EVENTS.syncDispatch, onDispatchSyncEvent);

    slide.on(SLIDE_EVENTS.renderError, ({ error }: { error: Error }) => {
      console.warn("[Slide] render error", error);
      onTransitionEnd();
    });

    if (initialState) {
      slide.setSlideState(initialState);
    } else {
      slide.renderSlide(initialPage);
    }

    this.ready = new Promise(resolve => {
      this.resolveReady = resolve;
    });

    this.pollReadyState();
  }

  private pollReadyState = () => {
    if (this.isReady()) {
      this.resolveReady(this);
    } else {
      setTimeout(this.pollReadyState, 500);
    }
  };

  receiveSyncEvent(event: SyncEvent) {
    this.slide.emit(SLIDE_EVENTS.syncReceive, event);
  }

  isReady() {
    return this.slide.slideCount > 0;
  }

  private targetingPage = -1;
  jumpToPage(page: number) {
    if (!this.isReady()) return;
    page = clamp(page, 1, this.slide.slideCount);
    if (page === this.targetingPage) return;
    this.targetingPage = page;
    this.slide.renderSlide(page);
  }

  destroy() {
    this.slide.destroy();
  }
}

export async function mountSlideController(
  anchor: HTMLDivElement,
  taskId: string,
  url: string,
  controller: boolean,
  initialState: Slide["slideState"] | null,
  initialPage: number,
  onPageChanged: (page: number) => void,
  onTransitionStart: () => void,
  onTransitionEnd: () => void,
  onDispatchSyncEvent: (event: SyncEvent) => void
) {
  const slide = new Slide({
    anchor,
    interactive: true,
    resize: true,
    controller,
  });

  if (import.meta.env.DEV) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).slide = slide;
  }

  slide.setResource(taskId, url);

  return new SlideController(
    slide,
    onPageChanged,
    onTransitionStart,
    onTransitionEnd,
    onDispatchSyncEvent,
    initialState,
    initialPage
  ).ready;
}