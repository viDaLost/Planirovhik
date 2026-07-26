import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const output = new URL("../dist-pages/", import.meta.url);

test("GitHub Pages artifact is complete and repository-path safe", async () => {
  const html = await readFile(new URL("index.html", output), "utf8");
  const manifest = JSON.parse(
    await readFile(new URL("manifest.webmanifest", output), "utf8"),
  );

  assert.match(html, /<html[^>]+data-static-mode="true"/);
  const base = html.match(/<base href="([^"]+)"/)?.[1];
  assert.ok(base?.startsWith("/"));
  assert.ok(base.endsWith("/"));
  assert.match(
    html,
    /<script[^>]+src="\/(?:[^"]+\/)?assets\/[^"]+\.js"/,
  );
  assert.match(
    html,
    /<link[^>]+href="\/(?:[^"]+\/)?assets\/[^"]+\.css"/,
  );
  assert.equal(manifest.start_url, ".");
  assert.equal(manifest.scope, ".");

  await Promise.all([
    access(new URL("sw.js", output)),
    access(new URL("favicon.svg", output)),
    access(new URL("icon-192.png", output)),
    access(new URL("icon-512.png", output)),
    access(new URL(".nojekyll", output)),
  ]);
});
