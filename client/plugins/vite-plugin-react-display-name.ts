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

import { transformSync, types as t } from "@babel/core";
import type { NodePath, PluginObj } from "@babel/core";
import type { Plugin } from "vite";

/**
 * Calls whose result is a component-like object regardless of what they wrap,
 * so no JSX check is needed: `const X = memo(...)` gets `X.displayName = "X"`.
 */
const WRAPPER_CALLEES = new Set(["memo", "forwardRef", "createContext"]);

function isComponentName(name: string): boolean {
  return /^[A-Z]/.test(name);
}

function isWrapperCall(node: t.Node): boolean {
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

function containsJsx(path: NodePath): boolean {
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

function displayNameStatement(name: string): t.ExpressionStatement {
  return t.expressionStatement(
    t.assignmentExpression(
      "=",
      t.memberExpression(t.identifier(name), t.identifier("displayName")),
      t.stringLiteral(name),
    ),
  );
}

/** Names already assigned a displayName by hand in this file are left alone. */
function collectManualDisplayNames(program: t.Program): Set<string> {
  const manual = new Set<string>();
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

const displayNameBabelPlugin: PluginObj = {
  name: "add-react-display-name",
  visitor: {
    Program(programPath) {
      const manual = collectManualDisplayNames(programPath.node);

      for (const stmtPath of programPath.get("body")) {
        let declPath: NodePath = stmtPath;
        if (
          stmtPath.isExportNamedDeclaration() ||
          stmtPath.isExportDefaultDeclaration()
        ) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const inner = stmtPath.get("declaration") as NodePath;
          if (!inner.node) continue;
          declPath = inner;
        }

        const names: string[] = [];
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
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              containsJsx(init as NodePath);
            if (isWrapperCall(init.node) || isPlainComponent) {
              names.push(id.name);
            }
          }
        }

        for (const name of names) {
          stmtPath.insertAfter(displayNameStatement(name));
        }
      }
    },
  },
};

/**
 * Build-only transform that appends `X.displayName = "X";` after every
 * top-level React component so component names survive minification
 * (React DevTools and error component stacks stay readable in production).
 *
 * Covers capitalized function declarations and arrow/function expressions
 * containing JSX (including export wrappers), plus memo/forwardRef/
 * createContext results named after their outermost binding. Skips files'
 * hand-written displayName assignments and anonymous default exports.
 */
export default function reactDisplayName(): Plugin {
  return {
    name: "vite-plugin-react-display-name",
    enforce: "pre",
    apply: "build",
    transform(code, id) {
      const file = id.split("?", 1)[0];
      if (file.includes("/node_modules/") || file.endsWith(".d.ts")) {
        return null;
      }
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
        plugins: [displayNameBabelPlugin],
        sourceMaps: true,
      });
      if (!result?.code) return null;
      return { code: result.code, map: result.map };
    },
  };
}
