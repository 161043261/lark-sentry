import { BreadcrumbType, EventType } from "@lark-sentry/types";

function event2breadcrumb(type: EventType) {
  switch (type) {
    case EventType.Xhr:
    case EventType.Fetch: {
      return BreadcrumbType.Http;
    }

    case EventType.Click: {
      return BreadcrumbType.Click;
    }

    case EventType.HashChange:
    case EventType.History: {
      return BreadcrumbType.Route;
    }

    case EventType.Resource: {
      return BreadcrumbType.Resource;
    }

    case EventType.UnhandledRejection: {
      return BreadcrumbType.CodeError;
    }

    case EventType.Error:
    case EventType.Vue:
    case EventType.React:
    case EventType.Performance:
    case EventType.ScreenRecord:
    case EventType.WhiteScreen:
    case EventType.Custom: {
      return BreadcrumbType.Custom;
    }

    default: {
      return BreadcrumbType.Custom;
    }
  }
}

export default event2breadcrumb;
