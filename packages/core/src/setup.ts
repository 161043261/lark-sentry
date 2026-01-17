import { EventType } from "@lark-sentry/types";

import { sub } from "./bus.js";

import {
  handleClick,
  handleError,
  handleHashChange,
  handleHistory,
  handleHttp,
  handleUnhandledRejection,
  handleWhiteScreen,
} from "./handlers.js";

import decoratePublish from "./decorate-publish.js";

function setup() {
  sub(EventType.Xhr, handleHttp);
  decoratePublish(EventType.Xhr);

  sub(EventType.Fetch, handleHttp);
  decoratePublish(EventType.Fetch);

  sub(EventType.Error, handleError);
  decoratePublish(EventType.Error);

  sub(EventType.History, handleHistory);
  decoratePublish(EventType.History);

  sub(EventType.HashChange, handleHashChange);
  decoratePublish(EventType.HashChange);

  sub(EventType.UnhandledRejection, handleUnhandledRejection);
  decoratePublish(EventType.UnhandledRejection);

  sub(EventType.Click, handleClick);
  decoratePublish(EventType.Click);

  sub(EventType.WhiteScreen, handleWhiteScreen);
  decoratePublish(EventType.WhiteScreen);
}

export default setup;
