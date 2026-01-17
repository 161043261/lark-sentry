import type { IBreadcrumbItem } from "@lark-sentry/types";

import { MinHeap, sentry } from "@lark-sentry/utils";

export class Breadcrumb extends MinHeap<IBreadcrumbItem> {
  static #instance: Breadcrumb;

  public static get instance() {
    if (!Breadcrumb.#instance) {
      Breadcrumb.#instance = new Breadcrumb();
    }
    return Breadcrumb.#instance;
  }

  override push(data: IBreadcrumbItem) {
    const { onBeforePushBreadcrumb } = sentry.options;
    if (onBeforePushBreadcrumb) {
      data = onBeforePushBreadcrumb(data);
    }
    return super.push(data);
  }
}

const breadcrumb = Breadcrumb.instance;

export default breadcrumb;
