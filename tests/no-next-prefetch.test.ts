import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourceDirectories = ["app", "components"];

async function findTsxFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory()
        ? findTsxFiles(entryPath)
        : Promise.resolve(entry.name.endsWith(".tsx") ? [entryPath] : []);
    }),
  );

  return files.flat();
}

test("todos os links Next.js mantêm o prefetch automático desativado", async () => {
  const files = (
    await Promise.all(sourceDirectories.map((directory) => findTsxFiles(directory)))
  ).flat();
  const unsafeLinks: string[] = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const linkTags = source.match(/<Link\b[\s\S]*?>/g) ?? [];

    linkTags.forEach((tag, index) => {
      if (!/prefetch=\{false\}/.test(tag)) {
        unsafeLinks.push(`${file} (Link ${index + 1})`);
      }
    });
  }

  assert.deepEqual(
    unsafeLinks,
    [],
    `Links sem prefetch={false}:\n${unsafeLinks.join("\n")}`,
  );
});
