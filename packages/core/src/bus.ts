import {
  EventType,
  type IPub,
  type ISub,
  type TEventHandler,
} from "@lark-sentry/types";

// FIXME any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const event2handlers = new Map<EventType, Set<TEventHandler<any>>>();

export const pub: IPub = (type, data) => {
  const handlers = event2handlers.get(type);
  if (!handlers) {
    return;
  }
  try {
    for (const handler of handlers) {
      handler(data);
    }
  } catch (err) {
    console.log("[lark-sentry] error", err);
  }
};

export const sub: ISub = (type, handler) => {
  const handlers = event2handlers.get(type);
  if (!handlers) {
    event2handlers.set(type, new Set([handler]));
    return;
  }
  handlers.add(handler);
};
