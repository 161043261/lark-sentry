import type { IExtendedErrorEvent, TUnknownError } from "@lark-sentry/types";

function isHTMLElement(node: Node): node is HTMLElement {
  return node.nodeType === Node.ELEMENT_NODE;
}

function isError(err: TUnknownError): err is Error {
  return err instanceof Error;
}

function isErrorEvent(err: TUnknownError): err is ErrorEvent {
  return err instanceof ErrorEvent;
}

function isIExtendedErrorEvent(err: TUnknownError): err is IExtendedErrorEvent {
  return (
    err instanceof ErrorEvent &&
    err.target !== null &&
    "src" in err.target &&
    typeof err.target.src === "string" &&
    "href" in err.target &&
    typeof err.target.href === "string" &&
    "localName" in err.target &&
    typeof err.target.localName === "string"
  );
}

export { isHTMLElement, isError, isErrorEvent, isIExtendedErrorEvent };
