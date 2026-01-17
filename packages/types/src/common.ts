import type { BreadcrumbType, EventType, HttpMethod, Status } from "./enums.js";

import type { Metric } from "web-vitals";
import type { IOptions } from "./options.js";

export interface ISentry {
  codeErrors: Set<string>;
  whiteScreenTimer: number | null;
  options: IOptions;
  shouldRecordScreen: boolean;
  deviceInfo: IDeviceInfo;
  setOptions: (newOptions: Partial<IOptions>) => void;
}

export interface IBreadcrumbItem extends IBaseData {
  userAction: BreadcrumbType;
}

export interface IDeviceInfo {
  browserName: string; // 例如 chrome
  browserVersion: string; // 浏览器版本
  osName: string; // 操作系统
  osVersion: string; // 操作系统版本
  userAgent: string; // 用户代理
  deviceType: string; // 设备种类, 例如 PC
  deviceModel: string; // 设备描述
}

export interface IBaseData<T = unknown> {
  id: string;
  type: EventType;
  name: string;
  time: string;
  timestamp: number;
  message: string;
  status: Status;
  payload?: T;
}

export interface IHttpData<Req = unknown, Res = unknown> extends IBaseData {
  method: HttpMethod | string;
  // 接口地址
  api: string;
  // 请求时长
  elapsedTime: number;
  // http 状态码
  statusCode: number;
  requestData?: Req;
  responseData?: Res;
}

export interface IResourceError extends IBaseData {
  src: string;
  href: string;
}

interface IPerformanceMetricData extends IBaseData {
  value: Metric["value"];
  rating?: Metric["rating"]; // "good" | "needs-improvement" | "poor"
}

interface IPerformanceResourceListData extends IBaseData {
  resourceList: (PerformanceResourceTiming & {
    fromCache: boolean;
  })[];
}
interface IPerformanceLongTaskData extends IBaseData {
  longTasks: PerformanceEntry[];
}

interface IPerformanceMemoryData extends IBaseData {
  memory: unknown;
}
export type IPerformanceData =
  | IPerformanceMetricData
  | IPerformanceResourceListData
  | IPerformanceLongTaskData
  | IPerformanceMemoryData;

export interface ICodeError extends IBaseData {
  column: number;
  line: number;
}

export interface IScreenRecordData extends IBaseData {
  event: string;
}

export interface IRouteData extends IBaseData {
  from: string;
  to: string;
}

export type TWhiteScreenData = IBaseData;

export type TReportPayload =
  | TWhiteScreenData
  | IHttpData
  | IResourceError
  | IPerformanceData
  | ICodeError
  | IScreenRecordData
  | IRouteData;

export type TOnReportWhiteScreenData = (data: TWhiteScreenData) => void;

export type TOnReportPerformanceData = (data: IPerformanceData) => void;

export interface IReportData<
  T extends TReportPayload = TReportPayload,
> extends IBaseData {
  // 页面的地址
  url: string;
  // 用户 ID
  userId: string;
  // 前端项目的 ID
  projectId: string;
  // SDK 版本
  sdkVersion: string;
  breadcrumbs?: IBreadcrumbItem[];
  deviceInfo: IDeviceInfo;
  payload: T;
}

export interface IDataReporter {
  send(payload: TReportPayload): Promise<void>;
}

export interface IExtendedErrorEvent extends ErrorEvent {
  target: EventTarget & {
    src: string;
    href: string;
    localName: string;
  };
}

export type TUnknownError = IExtendedErrorEvent | Error /** React */ | unknown;

export type WithSentry<T, S extends IBaseData = IBaseData> = T & {
  __sentry__: S;
};

export abstract class SentryPlugin {
  public type: EventType;
  constructor(type: EventType) {
    this.type = type;
  }
  abstract init(): void;
}
