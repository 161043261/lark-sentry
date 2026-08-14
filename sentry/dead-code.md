# Sentry SDK 死代码排查报告

排查范围: `sentry/src/` 目录下全部 TypeScript 源文件（共 76 个文件）

排查方法:
- 跨模块导出/导入交叉引用分析（5 个并行分析代理覆盖全部模块）
- TypeScript 编译器 `--noUnusedLocals --noUnusedParameters` 检查（结果: 无未使用局部变量）
- 枚举成员逐一引用检查
- 内部函数/变量使用检查
- 类公共方法调用检查
- npm 依赖使用检查（结果: 全部依赖均在使用）
- 注释代码检查（结果: 无注释掉的代码块）

---

## 一、死函数（导出后从未被任何模块导入或调用）

### 1. `throttleV2` — src/utils/throttle.ts:39

基于 setTimeout 的节流实现，导出后从未被任何文件导入或调用。同文件中的 `throttle` 被 `src/core/decorates.ts` 使用，但 `throttleV2` 完全无引用。

```ts
export function throttleV2<This, Args extends unknown[], Return>(
  fn: (this: This, ...args: Args) => Return,
  delay = 300,
): (this: This, ...args: Args) => void { ... }
```

决策: 保留, 但是使用 jsdoc 标记为 deadcode

### 2. `refreshSessionId` — src/utils/session.ts:52

刷新 sessionId 的函数，导出后从未被任何文件导入或调用。同文件的 `getDeviceId` 和 `getSessionId` 被 `src/utils/get-base-data.ts` 使用。

```ts
export function refreshSessionId(): string { ... }
```

决策: 删除整个函数。

### 3. `base64` — src/utils/base64.ts:23

基于 `btoa(encodeURIComponent(...))` 的编码函数，通过 `export * from "./base64.js"` 从 utils/index.ts 再导出，但从未被任何模块导入。同文件的 `base64v2` 被 `handle-code-error.ts` 和 `handle-error.ts` 使用。

```ts
function base64(raw: string) {
  return btoa(encodeURIComponent(raw));
}
```

决策: 保留, 但是使用 jsdoc 标记为 deadcode

---

## 二、死文件（整个文件从未被任何模块实际消费）

### 4. `debounce` — src/utils/debounce.ts（整个文件）

默认导出的防抖函数，通过 `export { default as debounce } from "./debounce.js"` 从 utils/index.ts 再导出，但从未被任何模块导入使用。

决策: 保留, 但是使用 jsdoc 标记为 deadcode

### 5. `dom2str` — src/utils/dom2str.ts（整个文件）

将 DOM 元素转换为 CSS 选择器路径字符串的函数，通过 `export { default as dom2str } from "./dom2str.js"` 从 utils/index.ts 再导出，但从未被任何模块导入使用。注意: `getCssSelectors`（src/utils/get-css-selectors.ts）实现了类似功能且被 `white-screen.ts` 使用。

决策: 保留, 但是使用 jsdoc 标记为 deadcode

---

## 三、死枚举（导出后从未被任何代码引用）

### 6. `HttpStatus` — src/types/enums.ts:23-37

整个枚举从未在代码中被引用。代码中使用的是 `HttpStatusCode`（数值型）和 `Status`（Error/OK），而非 `HttpStatus`（字符串型）。

```ts
export enum HttpStatus {
  OK = "OK",
  BadRequest = "Bad Request",
  ...
  UnknownError = "Unknown Error",
}
```

决策: 直接删除

### 7. `HttpType` — src/types/enums.ts:79-82

整个枚举从未在代码中被引用。代码中使用 `EventType.Xhr` 和 `EventType.Fetch` 来区分请求类型，`HttpType` 与之完全重复。

```ts
export enum HttpType {
  Xhr = "XMLHttpRequest",
  Fetch = "fetch",
}
```

决策: 直接删除

---

## 四、死枚举成员（枚举本身在使用，但部分成员从未被引用）

### 8. `HttpStatusCode` 中 10 个未使用成员 — src/types/enums.ts:84-97

仅 `OK`（200）和 `InternalServerError`（500）被代码引用（分别在 `decorate-http.ts` 和测试文件中）。以下 10 个成员从未被引用:

- BadRequest (400)
- Unauthorized (401)
- Forbidden (403)
- NotFound (404)
- Conflict (409)
- PayloadTooLarge (413)
- TooManyRequests (429)
- NotImplemented (501)
- ServiceUnavailable (503)
- GatewayTimeout (504)

决策: 保留, 但是使用 jsdoc 标记为 deadcode

### 9. `HttpMethod` 中 7 个未使用成员 — src/types/enums.ts:99-109

仅 `Get` 和 `Post` 被代码引用（在 `decorate-http.ts` 和测试文件中）。以下 7 个成员从未被引用:

- Head
- Put
- Delete
- Connect
- Options
- Trace
- Patch

注意: 同上，作为公共 API 枚举，外部消费者可能使用。
决策: 保留, 但是使用 jsdoc 标记为 deadcode

---

## 五、死类型（导出后从未被任何模块引用）

### 10. `ValidReportData` — src/reporter/report-data-schema.ts:61

通过 `z.infer` 从 `reportDataSchema` 派生的类型，导出后从未被任何文件导入或使用。完全死代码。

```ts
export type ValidReportData = z.infer<typeof reportDataSchema>;
```

决策: 删除整个类型定义。

---

## 六、多余导出（符号在文件内部使用，但 export 关键字多余）

> 决策: 全部移除冗余的导出

以下符号仅在定义文件内部使用，从未被其他模块导入。`export` 关键字是多余的，可以移除以缩小模块的公共表面积。

### 11. `payloadToReportData` — src/reporter/report-data.ts:28

仅在 report-data.ts 内部被 `runBeforeReportHook` 调用（第 54 行），从未被外部导入。

### 12. `zip` — src/plugins/screen-record/recorder.ts:104

仅在 recorder.ts 内部被调用（第 84 行），从未被外部导入。注意: `unzipScreenRecord` 是公共 API 的一部分（从 plugins/index.ts 导出），但 `zip` 不是。

### 13. `isFromCache` — src/plugins/performance/resource-timing.ts:81

仅在 resource-timing.ts 内部被调用（第 65 行），从未被外部导入。

### 14. `initOptionsSchema` — src/core/options-schema.ts:98

仅在 options-schema.ts 内部用于派生 `InitOptions` 类型（第 102 行），从未被外部导入。`InitOptions` 类型本身是公共 API（从 index.ts 导出），但 `initOptionsSchema` 常量不需要导出。

### 15. `themeColors` — src/utils/logger.ts:23

仅在 logger.ts 内部用于构建日志样式（第 36、48-61 行），从未被外部导入。

### 16. `DeclarativeClickData` — src/utils/click-data.ts:26

仅在 click-data.ts 内部作为 `getDeclarativeClickData` 的返回类型使用，从未被外部导入。`getDeclarativeClickData` 函数本身被 `handle-events.ts` 使用。

### 17. `SDK_NAME` — src/constants/index.ts:29

导出后从未被任何模块导入。同文件的 `SDK_VERSION` 被 `report-data.ts` 使用。

### 18. `MinimalDevServer` — src/source-map/vite.ts:47

仅在 source-map/vite.ts 内部使用，从未被外部导入。

### 19. `AssetMapStore` — src/source-map/webpack.ts:40

仅在 source-map/webpack.ts 内部作为 `createAssetMapStore` 的返回类型使用，从未被外部导入。

### 20. `Breadcrumb` 类命名导出 — src/core/breadcrumb.ts:27

`Breadcrumb` 类通过 `export class` 导出，但从未被外部导入。所有消费者使用的是默认导出的单例实例 `breadcrumb`（第 48 行）。类的 `export` 关键字多余。

### 21. `deviceInfoSchema` — src/reporter/report-data-schema.ts:27

仅在 report-data-schema.ts 内部被 `reportDataSchema` 引用（第 52 行），从未被外部导入。

### 22. `reportDataSchema` — src/reporter/report-data-schema.ts:40

仅在 report-data-schema.ts 内部被 `reportDataListSchema`（第 59 行）和 `ValidReportData`（第 61 行）引用，从未被外部导入。`reportDataListSchema` 被 `offline-cache.ts` 使用，但 `reportDataSchema` 本身不需要导出。

---

## 七、死再导出（从非入口模块导出，但从未被任何消费者导入）

> 统一的决策: 全部移除冗余的再导出

### 23. source-map/vite.ts 中的 6 个死再导出 — src/source-map/vite.ts:36, 61-73

`source-map/vite.ts` 不是 package.json 中定义的公共入口点。以下导出从未被 `vite.ts`（唯一的消费者）或其他任何模块导入:

- `resolveFrame`（第 61 行，vite 特化包装函数）
- `resolveStack`（第 68 行，vite 特化包装函数）
- `parseStack`（第 36 行，从 source-map.ts 再导出）
- `RawFrame`（第 36 行，类型再导出）
- `ResolvedFrame`（第 36 行，类型再导出）
- `SnippetLine`（第 36 行，类型再导出）

`vite.ts` 仅导入了 `enrichReportData`。移除 `resolveFrame`/`resolveStack` 后，第 31-32 行的 `resolveFrameWithLoader`/`resolveStackWithLoader` 别名导入也将变为未使用。

### 24. source-map/webpack.ts 中的 6 个死再导出 — src/source-map/webpack.ts:29-38

同理，`source-map/webpack.ts` 不是公共入口点。`webpack.ts` 仅导入了 `createAssetMapStore`、`enrichReportData` 和 `MapLoader`。以下再导出从未被消费:

- `parseStack`
- `resolveFrame`
- `resolveStack`
- `RawFrame`（类型）
- `ResolvedFrame`（类型）
- `SnippetLine`（类型）

---

## 八、从未调用的公共类方法

以下数据结构类的公共方法从未在代码库中被调用:

### 25. MinHeap 的 4 个未调用方法 — src/utils/data-structures.ts

- `peek()`（第 62 行）— 从未被调用
- `pop()`（第 112 行）— 从未被外部调用（仅在类内部 `dump` 方法中使用，而 `dump` 本身也未被调用）
- `dump()`（第 104 行）— 从未被调用
- `clear()`（第 108 行）— 从未被调用

MinHeap 的唯一消费者是 `Breadcrumb` 类（继承 MinHeap），而 Breadcrumb 仅使用了 `push` 方法。

决策: 保留, 但是使用 jsdoc 标记为 deadcode

### 26. BoundedSet.clear() — src/utils/data-structures.ts:149

从未被调用。BoundedSet 的唯一消费者是 `sentry.codeErrors`，仅使用 `has` 和 `add` 方法。

决策: 保留, 但是使用 jsdoc 标记为 deadcode

### 27. CallbackQueue.clear() — src/utils/data-structures.ts:182

从未被调用。CallbackQueue 的消费者（reporter/index.ts、reporter/transports.ts）仅使用 `push` 方法。

决策: 保留, 但是使用 jsdoc 标记为 deadcode

---

## 九、架构观察: 面包屑（Breadcrumb）只写不读

Breadcrumb 系统存在一个值得关注的问题: 面包屑在 7 个位置被写入（handle-code-error.ts、handle-error.ts、handle-events.ts、handle-http.ts、handle-route.ts 等），但从未被读取或附加到上报数据中。MinHeap 的 `peek`/`pop`/`dump` 方法（用于读取面包屑）从未被调用。这意味着面包屑数据被收集后从未被消费，整个读取侧的代码（MinHeap 的读取方法）实质上是死代码。

这可能是一个尚未完成的功能，而非需要删除的死代码。建议确认设计意图。

决策: 确认是否为真实 bug, 暂时不删除、不修复

---

## 十、汇总统计

| 类别 | 数量 | 涉及文件 |
|------|------|----------|
| 死函数 | 3 | throttle.ts, session.ts, base64.ts |
| 死文件 | 2 | debounce.ts, dom2str.ts |
| 死枚举 | 2 | enums.ts (HttpStatus, HttpType) |
| 死枚举成员 | 17 | enums.ts (HttpStatusCode x10, HttpMethod x7) |
| 死类型 | 1 | report-data-schema.ts (ValidReportData) |
| 多余导出 | 12 | 10 个文件 |
| 死再导出 | 12 | source-map/vite.ts x6, source-map/webpack.ts x6 |
| 未调用公共方法 | 6 | data-structures.ts (MinHeap x4, BoundedSet x1, CallbackQueue x1) |
| 合计 | 55 | — |

---

## 十一、排查确认无问题的项目

- npm 依赖: 全部 7 个 dependencies 均在源码中使用
- TypeScript 编译检查: `--noUnusedLocals --noUnusedParameters` 无报错
- 注释代码: 未发现被注释掉的代码块
- 未使用的导入: 所有 import 语句均被使用
- 未使用的内部函数: 所有非导出函数均在文件内部被调用
- 源文件引用: 所有源文件均被至少一个其他文件导入（无孤儿文件）
- EventType 枚举: 全部 17 个成员均在使用
- BreadcrumbType 枚举: 全部 6 个成员均在使用
- Status 枚举: 全部 2 个成员均在使用
- utils/index.ts 再导出: 除 debounce、dom2str、base64 外均被消费
- data-structures.ts: MinHeap、BoundedSet、CallbackQueue 类本身均在使用
- is-type.ts: 全部 4 个导出均在使用
- reporter/ 模块: 除上述标注外全部导出均在使用
- plugins/ 模块: 全部插件及导出均在使用
- core/ 模块: 除上述标注外全部导出均在使用
- 入口文件 (index/react/vue/vite/webpack): 无未使用导入，无未使用内部函数
