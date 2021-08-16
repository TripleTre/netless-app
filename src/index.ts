import styles from "./style.scss?inline";

import type { NetlessApp } from "@netless/window-manager";
import { StaticDocsViewer } from "./StaticDocsViewer";
import type { DocsViewerPage } from "./DocsViewer";

export type { DocsViewerPage } from "./DocsViewer";

export interface NetlessAppStaticDocsViewerAttributes {
    /** ScrollTop base on the real page size */
    pageScrollTop?: number;
    pages?: DocsViewerPage[];
}

const NetlessAppDocsViewer: NetlessApp<NetlessAppStaticDocsViewerAttributes> = {
    kind: "DocsViewer",
    setup(context): void {
        const box = context.getBox();
        if (!box) {
            throw new Error(
                "[DocsViewer]: Missing `box` after `create` event."
            );
        }

        box.mountStyles(styles);

        const attrs = context.getAttributes() || {};
        const pages = attrs.pages || [];

        if (pages.length <= 0) {
            throw new Error("[DocsViewer]: Missing pages.");
        }

        const pagesSize = {
            width: pages[0].width,
            height: pages.reduce(
                (height, page) =>
                    height + page.height * (pages[0].width / page.width),
                0
            ),
        };

        const whiteboardView = context.getView();
        whiteboardView.disableCameraTransform = true;

        const docsViewer = new StaticDocsViewer({
            whiteboardView,
            readonly: box.readonly,
            box,
            pages: attrs.pages || [],
            pagesSize,
            pageScrollTop: attrs.pageScrollTop,
            onUserScroll: (pageScrollTop) => {
                if (
                    context.getAttributes()?.pageScrollTop !== pageScrollTop &&
                    !box.readonly
                ) {
                    context.updateAttributes(["pageScrollTop"], pageScrollTop);
                }
            },
        }).mount();

        if (import.meta.env.DEV) {
            (window as any).docsViewer = docsViewer;
        }

        context.emitter.on("attributesUpdate", (attributes) => {
            if (attributes) {
                if (attributes.pageScrollTop != null) {
                    docsViewer.syncPageScrollTop(attributes.pageScrollTop);
                }
            }
        });

        box.events.on("readonly", (readonly) => {
            docsViewer.setReadonly(readonly);
        });
    },
};

export default NetlessAppDocsViewer;