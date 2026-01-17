import {
  EventType,
  Status,
  type IBaseData,
  type ICodeError,
  type IHttpData,
  type IRouteData,
  type IResourceError,
  type TEventHandler,
  type TWhiteScreenData,
  type TUnknownError,
} from "@lark-sentry/types";

import {
  sentry,
  getTime,
  event2breadcrumb,
  base64v2,
  transformHttpData,
  dom2str,
  isIExtendedErrorEvent,
  isErrorEvent,
  isError,
} from "@lark-sentry/utils";

import { UNKNOWN } from "@lark-sentry/constants";

import reporter from "@lark-sentry/reporter";

import breadcrumb from "./breadcrumb.js";
import checkWhiteScreen from "./white-screen.js";

const handleHttp: TEventHandler<EventType.Xhr | EventType.Fetch> = (
  data: IHttpData,
) => {
  data = transformHttpData(data);
  const { id, name, time, timestamp, message, status, type } = data;
  if (!data.api.includes(sentry.options.dsn)) {
    breadcrumb.push({
      id,
      name,
      time,
      timestamp,
      message,
      status,
      type,
      userAction: event2breadcrumb(type),
    });
  }
  if (status === Status.Error) {
    reporter.send(data);
  }
};

const handleError: TEventHandler<EventType.Error> = (err: TUnknownError) => {
  if (isErrorEvent(err)) {
    handleCodeError(err);
  }

  if (isIExtendedErrorEvent(err)) {
    const { localName, src, href } = err.target;
    const { message } = err;
    const resourceError: IResourceError = {
      id: crypto.randomUUID(),
      type: EventType.Resource,
      status: Status.Error,
      ...getTime(),
      name: localName,
      src,
      href,
      message,
    };
    breadcrumb.push({
      ...resourceError,
      userAction: event2breadcrumb(EventType.Resource),
    });
    reporter.send(resourceError);
    return;
  }

  if (isError(err)) {
    const { name, message } = err;
    const data: IBaseData = {
      id: crypto.randomUUID(),
      type: EventType.Error,
      name,
      message,
      status: Status.Error,
      ...getTime(),
    };
    breadcrumb.push({
      ...data,
      userAction: event2breadcrumb(EventType.Error),
    });
    reporter.send(data);
    return;
  }

  // Unknown error
  const data: IBaseData = {
    id: crypto.randomUUID(),
    type: EventType.Error,
    name: "Unknown Error",
    message: JSON.stringify(err),
    status: Status.Error,
    ...getTime(),
  };
  breadcrumb.push({
    ...data,
    userAction: event2breadcrumb(EventType.Error),
  });
  reporter.send(data);
};

const handleHistory: TEventHandler<EventType.History> = (
  routeChange: Pick<IRouteData, "from" | "to">,
) => {
  const id = crypto.randomUUID();
  const { from, to } = routeChange;
  const pathChange = `${from} => ${to}`;
  const routeData: IRouteData = {
    id,
    name: pathChange,
    message: pathChange,
    type: EventType.History,
    from,
    to,
    ...getTime(),
    status: Status.OK,
  };
  breadcrumb.push({
    ...routeData,
    userAction: event2breadcrumb(EventType.History),
  });
};

const handleHashChange: TEventHandler<EventType.HashChange> = (
  e: HashChangeEvent,
) => {
  const id = crypto.randomUUID();
  const { oldURL: from, newURL: to } = e;
  const pathChange = `${from} => ${to}`;
  const routeData: IRouteData = {
    id,
    name: pathChange,
    message: pathChange,
    type: EventType.HashChange,
    from,
    to,
    ...getTime(),
    status: Status.OK,
  };
  breadcrumb.push({
    ...routeData,
    userAction: event2breadcrumb(EventType.HashChange),
  });
};

const handleUnhandledRejection: TEventHandler<EventType.UnhandledRejection> = (
  e: PromiseRejectionEvent,
) => {
  if (!isIExtendedErrorEvent(e)) {
    handleError(e);
    return;
  }

  handleCodeError(e);
};

const handleWhiteScreen: TEventHandler<EventType.WhiteScreen> = () => {
  checkWhiteScreen((data: TWhiteScreenData) => {
    reporter.send(data);
  });
  return;
};

const handleClick: TEventHandler<EventType.Click> = (e: PointerEvent) => {
  const str = e.target instanceof HTMLElement ? dom2str(e.target) : "";
  breadcrumb.push({
    id: crypto.randomUUID(),
    type: EventType.Click,
    name: str,
    message: str,
    status: Status.OK,
    ...getTime(),
    userAction: event2breadcrumb(EventType.Click),
  });
};

export {
  handleError,
  handleHistory,
  handleHashChange,
  handleHttp,
  handleUnhandledRejection,
  handleWhiteScreen,
  handleClick,
};

const handleCodeError = (err: ErrorEvent) => {
  const { filename, colno: column, lineno: line, message } = err;
  const data: IBaseData = {
    id: crypto.randomUUID(),
    type: EventType.Error,
    name: filename,
    message,
    status: Status.Error,
    ...getTime(),
  };
  const codeError: ICodeError = {
    ...data,
    column,
    line,
  };
  breadcrumb.push({
    ...data,
    userAction: event2breadcrumb(EventType.Error),
  });

  const errorId = base64v2(
    `${EventType.Error}-${message}-${filename}-${line}-${column}`,
  );
  if (
    errorId.includes(UNKNOWN) ||
    sentry.options.repeatCodeError ||
    (!sentry.options.repeatCodeError && !sentry.codeErrors.has(errorId))
  ) {
    sentry.codeErrors.add(errorId);
    reporter.send(codeError);
  }
};
