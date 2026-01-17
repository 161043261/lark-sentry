import type { TUnknownError, IHttpData, IRouteData } from "./common.js";

import type { EventType } from "./enums.js";

export interface IType2param {
  [EventType.Xhr]: IHttpData;
  [EventType.Fetch]: IHttpData;
  [EventType.Error]: TUnknownError;
  [EventType.History]: Pick<IRouteData, "from" | "to">;
  [EventType.UnhandledRejection]: PromiseRejectionEvent;
  [EventType.HashChange]: HashChangeEvent;
  [EventType.Click]: PointerEvent;
  [EventType.WhiteScreen]: unknown;
  [EventType.Resource]: unknown;
  [EventType.Vue]: unknown;
  [EventType.React]: unknown;
  [EventType.Performance]: unknown;
  [EventType.ScreenRecord]: unknown;
  [EventType.Custom]: unknown;
}

export type TEventHandler<T extends EventType> = (data: IType2param[T]) => void;

export type IPub = <T extends EventType>(
  type: T,
  param?: IType2param[T],
) => void;

export type ISub = <T extends EventType>(
  type: T,
  handler: TEventHandler<T>,
) => void;
