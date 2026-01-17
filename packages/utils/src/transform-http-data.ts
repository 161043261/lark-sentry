import type { IHttpData } from "@lark-sentry/types";

function transformHttpData(data: IHttpData): IHttpData {
  const { statusCode } = data;
  if (statusCode >= 100 && statusCode < 200) {
    data.message = "Informational response";
  } else if (statusCode >= 200 && statusCode < 300) {
    data.message = "Successful responses";
  } else if (statusCode >= 300 && statusCode < 400) {
    data.message = "Redirection messages";
  } else if (statusCode >= 400 && statusCode < 500) {
    data.message = "Client error responses";
  } else if (statusCode >= 500 && statusCode < 600) {
    data.message = "Server error responses";
  } else {
    data.message = "Invalid status code";
  }
  return data;
}

export default transformHttpData;
