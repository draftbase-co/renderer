import assert from "node:assert/strict";
import { test } from "node:test";
import { toHtml } from "./toHtml.js";

test("renders markdown to html", async () => {
  const html = await toHtml("# Title\n\nSome **bold** text.");
  assert.match(html, /<h1 id="title">Title<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
});

test("supports gfm tables", async () => {
  const html = await toHtml("| a | b |\n| - | - |\n| 1 | 2 |");
  assert.match(html, /<table>/);
});

test("leaves custom tags as literal HTML when components isn't passed", async () => {
  const html = await toHtml('<EntryLink id="abc">Post</EntryLink><Callout>hi</Callout>');
  assert.match(html, /<EntryLink id="abc">Post<\/EntryLink>/);
  assert.match(html, /<Callout>hi<\/Callout>/);
});

test("EntryLink defaults to /entries/{id} once components is passed", async () => {
  const html = await toHtml('<EntryLink id="abc">Post</EntryLink>', { components: {} });
  assert.match(html, /<a href="\/entries\/abc">Post<\/a>/);
});

test("components renders a custom tag, keyed case-insensitively, with string props", async () => {
  const html = await toHtml('<Callout type="warning">Careful</Callout>', {
    components: {
      Callout: (props, childrenHtml) => `<div class="callout-${props.type}">${childrenHtml}</div>`,
    },
  });
  assert.match(html, /<div class="callout-warning">Careful<\/div>/);
});

test("components overrides the default EntryLink", async () => {
  const html = await toHtml('<EntryLink id="abc">Post</EntryLink>', {
    components: {
      EntryLink: (props, childrenHtml) => `<a href="/blog/${props.id}">${childrenHtml}</a>`,
    },
  });
  assert.match(html, /<a href="\/blog\/abc">Post<\/a>/);
});

test("components resolves nested custom tags before serializing the parent's children", async () => {
  const html = await toHtml('<Callout><EntryLink id="abc">Post</EntryLink></Callout>', {
    components: {
      Callout: (_props, childrenHtml) => `<div>${childrenHtml}</div>`,
    },
  });
  assert.match(html, /<div><a href="\/entries\/abc">Post<\/a><\/div>/);
});

test("adds target/rel to external links when externalLinks is true", async () => {
  const html = await toHtml("[ext](https://example.com) and [rel](/local)", {
    externalLinks: true,
  });
  assert.match(
    html,
    /<a href="https:\/\/example\.com" target="_blank" rel="noopener noreferrer">ext<\/a>/,
  );
  assert.match(html, /<a href="\/local">rel<\/a>/);
});
