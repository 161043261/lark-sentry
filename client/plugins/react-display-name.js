/**
 * Copyright (c) 2026 hangtiancheng
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// @ts-check

import { transformSync, types as t } from "@babel/core";

/** @typedef {import("@babel/core").NodePath} NodePath */
/** @typedef {import("@babel/core").BabelFileResult} BabelFileResult */

/**
 * @typedef {object} DisplayNameTransformResult
 * @property {string} code - Transformed source with displayName assignments.
 * @property {BabelFileResult["map"]} map - Sourcemap for the transformation.
 */

/**
 * Calls whose result is a component-like object regardless of what they wrap,
 * so no JSX check is needed: `const X = memo(...)` gets `X.displayName = "X"`.
 * @type {ReadonlySet<string>}
 */
const WRAPPER_CALLEES = new Set(["memo", "forwardRef", "createContext"]);

const METADATA_KEY = "reactDisplayNamesInjected";

/**
 * @param {string} name - Binding name of a candidate declaration.
 * @returns {boolean} True when the name follows the component convention.
 */
function isComponentName(name) {
  return /^[A-Z]/.test(name);
}

/**
 * @param {t.Node} node - Initializer expression of a variable declarator.
 * @returns {boolean} True for memo/forwardRef/createContext calls, plain or
 *   `React.`-prefixed (nested calls hit the outermost callee).
 */
function isWrapperCall(node) {
  if (!t.isCallExpression(node)) return false;
  const { callee } = node;
  if (t.isIdentifier(callee)) return WRAPPER_CALLEES.has(callee.name);
  return (
    t.isMemberExpression(callee) &&
    t.isIdentifier(callee.object, { name: "React" }) &&
    t.isIdentifier(callee.property) &&
    WRAPPER_CALLEES.has(callee.property.name)
  );
}

/**
 * @param {NodePath} path - Path whose subtree is scanned.
 * @returns {boolean} True when the subtree contains a JSX element/fragment.
 */
function containsJsx(path) {
  let found = false;
  path.traverse({
    JSXElement(p) {
      found = true;
      p.stop();
    },
    JSXFragment(p) {
      found = true;
      p.stop();
    },
  });
  return found;
}

/**
 * @param {string} name - Component binding name.
 * @returns {t.ExpressionStatement} The `name.displayName = "name";` statement.
 */
function displayNameStatement(name) {
  return t.expressionStatement(
    t.assignmentExpression(
      "=",
      t.memberExpression(t.identifier(name), t.identifier("displayName")),
      t.stringLiteral(name),
    ),
  );
}

/**
 * Names already assigned a displayName by hand in this file are left alone.
 * @param {t.Program} program - Parsed module AST.
 * @returns {Set<string>} Binding names with a manual top-level assignment.
 */
function collectManualDisplayNames(program) {
  /** @type {Set<string>} */
  const manual = new Set();
  for (const stmt of program.body) {
    if (
      t.isExpressionStatement(stmt) &&
      t.isAssignmentExpression(stmt.expression, { operator: "=" }) &&
      t.isMemberExpression(stmt.expression.left) &&
      t.isIdentifier(stmt.expression.left.object) &&
      t.isIdentifier(stmt.expression.left.property, { name: "displayName" })
    ) {
      manual.add(stmt.expression.left.object.name);
    }
  }
  return manual;
}

/** @type {import("@babel/core").PluginObj} */
const displayNameBabelPlugin = {
  name: "add-react-display-name",
  visitor: {
    Program(programPath, state) {
      let injected = 0;

      const manual = collectManualDisplayNames(programPath.node);

      for (const stmtPath of programPath.get("body")) {
        /** @type {NodePath} */
        let declPath = stmtPath;
        if (
          stmtPath.isExportNamedDeclaration() ||
          stmtPath.isExportDefaultDeclaration()
        ) {
          const inner = /** @type {NodePath} */ (stmtPath.get("declaration"));
          if (!inner.node) continue;
          declPath = inner;
        }

        /** @type {string[]} */
        const names = [];
        if (declPath.isFunctionDeclaration()) {
          const name = declPath.node.id?.name;
          if (
            name &&
            isComponentName(name) &&
            !manual.has(name) &&
            containsJsx(declPath)
          ) {
            names.push(name);
          }
        } else if (declPath.isVariableDeclaration()) {
          for (const declarator of declPath.get("declarations")) {
            const { id } = declarator.node;
            if (
              !t.isIdentifier(id) ||
              !isComponentName(id.name) ||
              manual.has(id.name)
            ) {
              continue;
            }
            const init = declarator.get("init");
            if (!init.node) continue;
            const isPlainComponent =
              (t.isArrowFunctionExpression(init.node) ||
                t.isFunctionExpression(init.node)) &&
              containsJsx(/** @type {NodePath} */ (init));
            if (isWrapperCall(init.node) || isPlainComponent) {
              names.push(id.name);
            }
          }
        }

        for (const name of names) {
          stmtPath.insertAfter(displayNameStatement(name));
          injected += 1;
        }
      }

      /** @type {Record<string, unknown>} */ (state.file.metadata)[
        METADATA_KEY
      ] = injected;
    },
  },
};

/**
 * Appends `X.displayName = "X";` after every top-level React component so
 * component names survive minification (React DevTools and error component
 * stacks stay readable in production).
 *
 * Covers capitalized function declarations and arrow/function expressions
 * containing JSX (including export wrappers), plus memo/forwardRef/
 * createContext results named after their outermost binding. Skips files'
 * hand-written displayName assignments and anonymous default exports.
 *
 * @param {string} code - Original module source text.
 * @param {string} file - Absolute file path, used for scope filtering,
 *   parser dialect selection and sourcemap metadata.
 * @returns {DisplayNameTransformResult | null} Transformed code and map, or
 *   null when the file is out of scope or no component was found (callers
 *   should then pass the source through as-is).
 */
export function transformDisplayName(code, file) {
  if (file.includes("/node_modules/") || file.endsWith(".d.ts")) return null;
  const isJsxFile = /\.[jt]sx$/.test(file);
  if (!isJsxFile && !file.endsWith(".ts")) return null;
  // Plain .ts files cannot contain JSX components; only wrapper calls
  // (e.g. createContext) matter, so bail early without parsing.
  if (!isJsxFile && !/\b(?:memo|forwardRef|createContext)\b/.test(code)) {
    return null;
  }

  const result = transformSync(code, {
    filename: file,
    babelrc: false,
    configFile: false,
    browserslistConfigFile: false,
    parserOpts: {
      sourceType: "module",
      plugins: isJsxFile ? ["typescript", "jsx"] : ["typescript"],
    },
    // Keep original line numbers: downstream tools that drop the input
    // sourcemap (e.g. esbuild-loader) then still map to the right lines.
    generatorOpts: { retainLines: true },
    plugins: [displayNameBabelPlugin],
    sourceMaps: true,
  });
  if (!result?.code) return null;
  const metadata = /** @type {Record<string, unknown>} */ (
    result.metadata ?? {}
  );
  if (!metadata[METADATA_KEY]) return null;
  return { code: result.code, map: result.map };
}
