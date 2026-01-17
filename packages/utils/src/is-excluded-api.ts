import sentry from "./sentry.js";

function isExcludedApi(api: string) {
  for (const excludedApi of sentry.options.excludeApis) {
    if (typeof excludedApi === "string") {
      if (api === excludedApi) {
        return true;
      }
    } else {
      if (excludedApi.test(api)) {
        return true;
      }
    }
  }
  return false;
}

export default isExcludedApi;
