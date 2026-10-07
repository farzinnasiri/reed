import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

/** Execute production hooks in Node, replacing only explicitly supplied platform dependencies. */
export function platformModule<T>(entry: string, mocks: Record<string, unknown>): T {
  const cache = new Map<string, { exports: unknown }>();
  const root = process.cwd();
  function load(filename: string): unknown {
    const cached = cache.get(filename);
    if (cached) return cached.exports;
    const module = { exports: {} as unknown };
    cache.set(filename, module);
    const nativeRequire = createRequire(filename);
    function requireModule(specifier: string): unknown {
      if (specifier in mocks) return mocks[specifier];
      if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return nativeRequire(specifier);
      const base = specifier.startsWith('@/')
        ? path.join(root, specifier.slice(2))
        : path.resolve(path.dirname(filename), specifier);
      const resolved = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find(
        (p) => existsSync(p) && /\.[jt]sx?$/.test(p),
      );
      if (!resolved) return nativeRequire(specifier);
      if (resolved in mocks) return mocks[resolved];
      return load(resolved);
    }
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
      fileName: filename,
    }).outputText;
    new Function('require', 'module', 'exports', code)(requireModule, module, module.exports);
    return module.exports;
  }
  return load(path.resolve(root, entry)) as T;
}
