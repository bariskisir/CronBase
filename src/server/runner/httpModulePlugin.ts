import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire, isBuiltin } from "node:module";
import path from "node:path";
import type { Plugin } from "esbuild";

type LoaderType = "js" | "json" | "ts" | "css";

interface CachedModule {
  contents: string;
  finalUrl: string;
  loader: LoaderType;
}

interface ModuleMeta {
  url: string;
  finalUrl: string;
  loader: LoaderType;
  fetchedAt: string;
}

const require = createRequire(import.meta.url);

function canResolveLocally(specifier: string): boolean {
  try {
    require.resolve(specifier);
    return true;
  } catch {
    return false;
  }
}

export function createHttpModulePlugin(cacheDir: string): Plugin {
  const memoryCache = new Map<string, CachedModule>();
  const redirectMap = new Map<string, string>();
  const inFlightFetches = new Map<string, Promise<CachedModule>>();

  async function getFromCache(url: string): Promise<CachedModule | null> {
    const mem = memoryCache.get(url);
    if (mem) return mem;

    const hash = createHash("sha256").update(url).digest("hex");
    const contentFile = path.join(cacheDir, `${hash}.mjs`);
    const metaFile = path.join(cacheDir, `${hash}.json`);

    try {
      const [contents, metaRaw] = await Promise.all([readFile(contentFile, "utf8"), readFile(metaFile, "utf8")]);
      const meta = JSON.parse(metaRaw) as ModuleMeta;
      const res: CachedModule = {
        contents,
        finalUrl: meta.finalUrl || url,
        loader: meta.loader || "js",
      };
      memoryCache.set(url, res);
      if (res.finalUrl !== url) {
        redirectMap.set(url, res.finalUrl);
      }
      return res;
    } catch {
      return null;
    }
  }

  async function saveToCache(url: string, contents: string, finalUrl: string, loader: LoaderType): Promise<void> {
    memoryCache.set(url, { contents, finalUrl, loader });
    if (finalUrl !== url) redirectMap.set(url, finalUrl);

    const hash = createHash("sha256").update(url).digest("hex");
    const contentFile = path.join(cacheDir, `${hash}.mjs`);
    const metaFile = path.join(cacheDir, `${hash}.json`);

    try {
      await mkdir(cacheDir, { recursive: true });
      const meta: ModuleMeta = {
        url,
        finalUrl,
        loader,
        fetchedAt: new Date().toISOString(),
      };
      await Promise.all([writeFile(contentFile, contents, "utf8"), writeFile(metaFile, JSON.stringify(meta), "utf8")]);
    } catch {
      // Disk write failure is non-fatal
    }
  }

  async function fetchModule(url: string): Promise<CachedModule> {
    const cached = await getFromCache(url);
    if (cached) return cached;

    const existingPromise = inFlightFetches.get(url);
    if (existingPromise) return existingPromise;

    const fetchPromise = (async () => {
      const res = await fetch(url, {
        headers: { "User-Agent": "CronBase-Runtime/1.0" },
        signal: AbortSignal.timeout(25000),
      });

      if (!res.ok) {
        throw new Error(`Failed to resolve module "${url}": ${res.status} ${res.statusText}`);
      }

      const contents = await res.text();
      const finalUrl = res.url || url;

      let loader: LoaderType = "js";
      try {
        const pathname = new URL(finalUrl).pathname.toLowerCase();
        if (pathname.endsWith(".json")) loader = "json";
        else if (pathname.endsWith(".ts") || pathname.endsWith(".tsx")) loader = "ts";
        else if (pathname.endsWith(".css")) loader = "css";
      } catch {
        // Fallback to js
      }

      await saveToCache(url, contents, finalUrl, loader);
      return { contents, finalUrl, loader };
    })();

    inFlightFetches.set(url, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      inFlightFetches.delete(url);
    }
  }

  return {
    name: "cronbase-http-esm",
    setup(pluginBuild) {
      pluginBuild.onResolve({ filter: /^(npm|jsr):/ }, (args) => {
        if (args.path.startsWith("npm:")) {
          return { path: `https://esm.sh/${args.path.slice(4)}`, namespace: "http-url" };
        }
        return { path: `https://esm.sh/jsr/${args.path.slice(4)}`, namespace: "http-url" };
      });

      pluginBuild.onResolve({ filter: /^https?:\/\// }, (args) => {
        return { path: args.path, namespace: "http-url" };
      });

      pluginBuild.onResolve({ filter: /^[^./#]/ }, (args) => {
        if (args.namespace === "http-url") return null;
        if (args.path === "cronbase" || args.path.startsWith("node:") || isBuiltin(args.path)) {
          return null;
        }
        if (canResolveLocally(args.path)) {
          return null;
        }
        return { path: `https://esm.sh/${args.path}`, namespace: "http-url" };
      });

      pluginBuild.onResolve({ filter: /.*/, namespace: "http-url" }, (args) => {
        if (args.path.startsWith("node:") || isBuiltin(args.path)) {
          return { path: args.path, external: true };
        }
        if (args.path.startsWith("npm:")) {
          return { path: `https://esm.sh/${args.path.slice(4)}`, namespace: "http-url" };
        }
        if (args.path.startsWith("jsr:")) {
          return { path: `https://esm.sh/jsr/${args.path.slice(4)}`, namespace: "http-url" };
        }
        if (args.path.startsWith("http://") || args.path.startsWith("https://")) {
          return { path: args.path, namespace: "http-url" };
        }

        const effectiveImporter = redirectMap.get(args.importer) ?? args.importer;
        if (args.path.startsWith("/") || args.path.startsWith("./") || args.path.startsWith("../")) {
          const resolved = new URL(args.path, effectiveImporter).toString();
          return { path: resolved, namespace: "http-url" };
        }

        const resolved = new URL(args.path, "https://esm.sh/").toString();
        return { path: resolved, namespace: "http-url" };
      });

      pluginBuild.onLoad({ filter: /.*/, namespace: "http-url" }, async (args) => {
        const item = await fetchModule(args.path);
        return { contents: item.contents, loader: item.loader };
      });
    },
  };
}
