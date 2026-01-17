import type { IBreadcrumbItem, IReportData } from "./common.js";

import type { EventType } from "./enums.js";

export interface IOptions {
  // 数据上报的地址
  dsn: string;
  // 前端项目的 ID
  projectId: string;
  // 是否禁用 SDK
  disabled: boolean;
  // 用户 ID
  userId: string;
  // 是否监听 XMLHttpRequest 请求
  enableXhr: boolean;
  // 是否监听 fetch 请求
  enableFetch: boolean;
  // 是否监听 click 点击事件
  enableClick: boolean;
  // 是否监听 error 错误
  enableError: boolean;
  // 是否监听 unhandledrejection 事件 (Web API, 异步错误)
  enableUnhandledRejection: boolean;
  // 是否监听 hashchange 事件 (Web API, 路由 hash 模式)
  enableHashChange: boolean;
  // 是否监听 history 模式 (路由 history 模式)
  enableHistory: boolean;
  // 是否计算页面性能指标
  enablePerformance: boolean;
  // 是否开启屏幕录制
  enableScreenRecord: boolean;
  // 是否开启白屏检测
  enableWhiteScreen: boolean;
  // 是否使用图片上报
  useImageReport: boolean;
  // 单次屏幕录制时长
  screenRecordDurationMs: number;
  screenRecordEventTypes: EventType[];
  // 白屏时, 是否有骨架屏
  hasSkeleton: boolean;
  rootCssSelectors: string[];
  // click 点击事件的节流时长
  clickThrottleDelay: number;
  // 请求的超时时长
  requestTimeoutMilliseconds: number;
  // 存储用户行为的堆容量
  maxBreadcrumbs: number;
  // 是否重复上报源代码错误
  repeatCodeError: boolean;
  // 排除的接口
  excludeApis: (RegExp | string)[];
  // 入堆前的 hook
  onBeforePushBreadcrumb?: (data: IBreadcrumbItem) => IBreadcrumbItem;
  // 数据上报前的 hook
  onBeforeReportData?: (data: IReportData) => Promise<IReportData>;
  // 处理 http 错误的回调函数
  handleHttpError?: <T>(data: T) => boolean;
}
