import * as nodeModule from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/**
 * Lets plain `node --test` import this package's real components.
 *
 * The apps' bundlers resolve two things Node's ESM loader does not:
 *  - extensionless relative imports (`./Header`);
 *  - JSX in `.tsx`, which Node's type stripping leaves in place.
 *
 * Importing this module registers hooks for exactly those two cases.
 * Modules that depend on them must be loaded with a dynamic `import()`
 * afterwards: static imports are resolved before this file runs.
 */

const RELATIVE_EXTENSIONS = ['.ts', '.tsx'];

// `module.registerHooks` ships in Node 24 but is not declared by the
// @types/node the apps pin. These are the parts used here.
interface ResolveResult {
  readonly url: string;
}
interface LoadResult {
  readonly format?: string | null | undefined;
  readonly source?: string | ArrayBuffer | Uint8Array | undefined;
  readonly shortCircuit?: boolean | undefined;
}
interface SyncHooks {
  resolve(
    specifier: string,
    context: object,
    nextResolve: (specifier: string, context?: object) => ResolveResult
  ): ResolveResult;
  load(url: string, context: object, nextLoad: (url: string, context?: object) => LoadResult): LoadResult;
}
const { registerHooks } = nodeModule as unknown as { registerHooks(hooks: SyncHooks): unknown };

function isModuleNotFound(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === 'ERR_MODULE_NOT_FOUND' || code === 'ERR_UNSUPPORTED_DIR_IMPORT';
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!isModuleNotFound(error) || !specifier.startsWith('.')) {
        throw error;
      }
      for (const extension of RELATIVE_EXTENSIONS) {
        try {
          return nextResolve(`${specifier}${extension}`, context);
        } catch (retryError) {
          if (!isModuleNotFound(retryError)) {
            throw retryError;
          }
        }
      }
      throw error;
    }
  },
  load(url, context, nextLoad) {
    if (!url.endsWith('.tsx')) {
      return nextLoad(url, context);
    }
    const source = readFileSync(fileURLToPath(url), 'utf-8');
    const { outputText } = ts.transpileModule(source, {
      fileName: fileURLToPath(url),
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    });
    return { format: 'module', source: outputText, shortCircuit: true };
  },
});
