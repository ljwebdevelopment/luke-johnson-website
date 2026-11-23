#!/usr/bin/env node
// Pre-renders lukehjohnson.com for search engines and AI crawlers.
//
//   node scripts/build.js
//
// Run it after editing assets/js/archiveData.js. It needs no packages.
// For every page it:
//   1. writes the data-driven blocks (columns, books, outlets) into the HTML
//      between <!-- build:NAME --> and <!-- /build:NAME --> markers, so the
//      content is in the page source, not only added by JavaScript;
//   2. updates the no-JavaScript fallback counts (data-metric);
//   3. regenerates the JSON-LD structured data in <head>, including FAQPage
//      data read from the page's own visible FAQ.
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const SITE = "https://lukehjohnson.com/";
const PERSON_ID = SITE + "#person";
const WEBSITE_ID = SITE + "#website";

const render = require(path.join(ROOT, "assets/js/render.js"));
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "assets/js/archiveData.js"), "utf8"), sandbox);
const data = sandbox.window.siteData;

const abs = (url) => (/^https?:/.test(url) ? url : SITE + url.replace(/^\//, ""));
const strip = (html) => html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, " ").trim();

// ---------- Entities ----------

const BIO =
  "Luke H. Johnson is a published author, independent columnist, and youth political advocate from Tahlequah, Oklahoma. " +
  "He is the author of We're All the Same and Becoming You: Advice From a Teenager, and of the forthcoming political nonfiction book Dead Air America. " +
  "His columns on politics, media, education, and growing up have run in the Tulsa World, the Northeastern Journal, and newspapers across the CNHI network.";

const person = {
  "@type": "Person",
  "@id": PERSON_ID,
  name: "Luke H. Johnson",
  alternateName: ["Luke H Johnson", "Luke Johnson"],
  givenName: "Luke",
  familyName: "Johnson",
  jobTitle: ["Author", "Columnist", "Youth Political Advocate"],
  description: BIO,
  disambiguatingDescription:
    "American teenage author and newspaper columnist from Tahlequah, Oklahoma. Not the British businessman and former Financial Times columnist Luke Johnson.",
  url: SITE,
  image: {
    "@type": "ImageObject",
    "@id": SITE + "#headshot",
    url: SITE + "assets/images/luke-headshot.jpg",
    width: 1000,
    height: 1492,
    caption: "Luke H. Johnson, author and columnist"
  },
  email: "mailto:contact@lukehjohnson.com",
  homeLocation: {
    "@type": "Place",
    name: "Tahlequah, Oklahoma",
    address: { "@type": "PostalAddress", addressLocality: "Tahlequah", addressRegion: "OK", addressCountry: "US" }
  },
  nationality: { "@type": "Country", name: "United States" },
  knowsAbout: [
    "Youth political advocacy",
    "Civic engagement",
    "Political commentary",
    "Oklahoma politics",
    "Journalism",
    "Media criticism",
    "Education policy",
    "Technology and social media",
    "Generation Z",
    "Privacy and civil liberties",
    "Autism awareness"
  ],
  // Official profiles only. Add Substack, X, LinkedIn, Amazon Author Central,
  // Goodreads, etc. here as they are created.
  sameAs: [
    "https://www.instagram.com/lukejohnsonoffical/",
    "https://www.facebook.com/share/17GMVC33tj/?mibextid=wwXIfr",
    "https://www.northeasternjournal.com/author/luke-johnson"
  ]
};

const website = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  url: SITE,
  name: "Luke H. Johnson",
  alternateName: ["lukehjohnson.com", "Luke H Johnson"],
  description: "Official website of Luke H. Johnson, published author, independent columnist, and youth political advocate.",
  publisher: { "@id": PERSON_ID },
  about: { "@id": PERSON_ID },
  inLanguage: "en-US"
};

const personRef = { "@id": PERSON_ID };

function bookEntity(book) {
  const id = book.comingSoon ? "dead-air-america" : render.slug(book.title);
  const entity = {
    "@type": "Book",
    "@id": SITE + "books.html#" + id,
    name: book.title,
    author: personRef,
    description: book.description.replace(/^Luke( H\.)? Johnson's upcoming/, "An upcoming"),
    url: SITE + "books.html#" + id,
    image: abs(book.coverImage),
    inLanguage: "en-US",
    genre: book.comingSoon ? ["Political Nonfiction", "Media Criticism", "American Culture"] : ["Nonfiction"]
  };
  if (book.amazonLink) entity.sameAs = [book.amazonLink];
  return entity;
}
const books = (data.books || []).map(bookEntity);

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7, aug: 8, sept: 9, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");
// "Nov. 16, 2026" -> 2026-11-16, "July 2026" -> 2026-07. Submission dates are
// not publication dates, so "Submitted ..." is left out.
function isoDate(text) {
  if (!text || /submitted/i.test(text)) return undefined;
  let m = text.match(/^([A-Za-z]+)\.? (\d{1,2})(?:[–-]\d{1,2})?, (\d{4})$/);
  if (m && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[1].toLowerCase()])}-${pad(m[2])}`;
  m = text.match(/^([A-Za-z]+)\.? (\d{4})$/);
  if (m && MONTHS[m[1].toLowerCase()]) return `${m[2]}-${pad(MONTHS[m[1].toLowerCase()])}`;
  return undefined;
}

function articleEntity(item) {
  const outlet = (data.publications || []).find((o) => o.name === (item.publications || [])[0]);
  const links = (item.sourceLinks || []).map((l) => l.url).filter((u) => !/\/author\//.test(u));
  const column = render.isColumn(item);
  const entity = {
    "@type": column ? "OpinionNewsArticle" : "NewsArticle",
    "@id": SITE + "writing.html#" + render.slug(item.title),
    headline: item.title.length > 110 ? item.title.slice(0, 107) + "..." : item.title,
    description: item.description || undefined,
    datePublished: isoDate(item.publicationDate),
    inLanguage: "en-US",
    keywords: (item.badges || []).join(", ") || undefined,
    image: item.image ? abs(item.image) : undefined,
    url: links[0],
    sameAs: links.length > 1 ? links.slice(1) : undefined,
    publisher: outlet ? { "@type": "NewsMediaOrganization", name: outlet.name, url: outlet.website } : undefined
  };
  // Columns are by Luke; features and press coverage are about him.
  if (column) entity.author = personRef;
  else entity.about = personRef;
  return JSON.parse(JSON.stringify(entity));
}

function breadcrumbs(name, file) {
  return {
    "@type": "BreadcrumbList",
    "@id": SITE + file + "#breadcrumbs",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Luke H. Johnson", item: SITE },
      { "@type": "ListItem", position: 2, name, item: SITE + file }
    ]
  };
}

function faqEntity(html, file) {
  const pairs = [...html.matchAll(/<details>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>\s*<\/details>/g)];
  if (!pairs.length) return null;
  return {
    "@type": "FAQPage",
    "@id": SITE + file + "#faq",
    mainEntity: pairs.map(([, q, a]) => ({
      "@type": "Question",
      name: strip(q),
      acceptedAnswer: { "@type": "Answer", text: strip(a) }
    }))
  };
}

function webPage(type, file, name, extra) {
  return Object.assign(
    {
      "@type": type,
      "@id": SITE + (file === "index.html" ? "" : file) + "#webpage",
      url: SITE + (file === "index.html" ? "" : file),
      name,
      isPartOf: { "@id": WEBSITE_ID },
      about: personRef,
      inLanguage: "en-US"
    },
    extra || {}
  );
}

// ---------- Per-page graphs ----------

const writing = render.writing(data);

const graphs = {
  "index.html": () => [
    webPage("ProfilePage", "index.html", "Luke H. Johnson | Author, Columnist & Youth Political Advocate", {
      mainEntity: personRef,
      primaryImageOfPage: { "@id": SITE + "#headshot" }
    }),
    website,
    person,
    ...books
  ],
  "writing.html": () => [
    webPage("CollectionPage", "writing.html", "Columns & Commentary by Luke H. Johnson", {
      breadcrumb: { "@id": SITE + "writing.html#breadcrumbs" },
      mainEntity: {
        "@type": "ItemList",
        name: "Columns and features by Luke H. Johnson",
        numberOfItems: writing.length,
        itemListElement: writing.map((item, i) => ({ "@type": "ListItem", position: i + 1, item: articleEntity(item) }))
      }
    }),
    breadcrumbs("Writing", "writing.html"),
    website,
    person
  ],
  "books.html": (html) => [
    webPage("CollectionPage", "books.html", "Books by Luke H. Johnson", {
      breadcrumb: { "@id": SITE + "books.html#breadcrumbs" },
      hasPart: books.map((b) => ({ "@id": b["@id"] }))
    }),
    breadcrumbs("Books", "books.html"),
    website,
    person,
    ...books,
    faqEntity(html, "books.html")
  ],
  "about.html": (html) => [
    webPage("ProfilePage", "about.html", "About Luke H. Johnson", {
      breadcrumb: { "@id": SITE + "about.html#breadcrumbs" },
      mainEntity: personRef,
      primaryImageOfPage: { "@id": SITE + "#headshot" }
    }),
    breadcrumbs("About", "about.html"),
    website,
    person,
    faqEntity(html, "about.html")
  ],
  "contact.html": () => [
    webPage("ContactPage", "contact.html", "Contact Luke H. Johnson", {
      breadcrumb: { "@id": SITE + "contact.html#breadcrumbs" }
    }),
    breadcrumbs("Contact", "contact.html"),
    website,
    person
  ],
  "404.html": () => [website, person]
};

// ---------- Write pages ----------

const blocks = {
  lead: () => render.lead(data),
  secondary: () => render.secondary(data),
  "headline-index": (html) => {
    const tag = html.match(/data-headline-index[^>]*/)[0];
    const start = Number((tag.match(/data-start="(\d+)"/) || [])[1] || 0);
    const limit = Number((tag.match(/data-limit="(\d+)"/) || [])[1] || 999);
    return render.headlineIndex(data, start, limit);
  },
  "outlet-roll": () => render.outletRoll(data),
  shelf: () => render.shelf(data),
  "book-rows": () => render.bookRows(data),
  entries: () => render.entries(data),
  directory: () => render.directory(data)
};

const metrics = render.metrics(data);
let failures = 0;

for (const [file, graph] of Object.entries(graphs)) {
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, "utf8");

  html = html.replace(/<!-- build:([\w-]+) -->[\s\S]*?<!-- \/build:\1 -->/g, (whole, name) => {
    if (name === "jsonld") return whole; // done below, once the body is final
    if (!blocks[name]) {
      console.error(`${file}: unknown build block "${name}"`);
      failures += 1;
      return whole;
    }
    return `<!-- build:${name} -->${blocks[name](html)}<!-- /build:${name} -->`;
  });

  html = html.replace(/(data-metric="(\w+)">)[^<]*(<)/g, (whole, open, key, close) =>
    key in metrics ? `${open}${metrics[key]}${close}` : whole
  );

  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph(html).filter(Boolean) }, null, 2)
    .split("\n")
    .map((line) => "  " + line)
    .join("\n");
  html = html.replace(
    /<!-- build:jsonld -->[\s\S]*?<!-- \/build:jsonld -->/,
    `<!-- build:jsonld -->\n  <script type="application/ld+json">\n${json}\n  </script>\n  <!-- /build:jsonld -->`
  );

  fs.writeFileSync(full, html);
  console.log(`built ${file}`);
}

// ---------- llms.txt (plain-text summary for AI assistants) ----------

const columnLines = writing
  .filter(render.isColumn)
  .slice(0, 12)
  .map((item) => `- ${item.title} (${[(item.publications || [])[0], item.publicationDate].filter(Boolean).join(", ")})${item.description ? `: ${item.description}` : ""}`);

const llms = `# Luke H. Johnson

> Luke H. Johnson is a published author, independent columnist, and youth political advocate from Tahlequah, Oklahoma. His official website is https://lukehjohnson.com/.

He is an American teenage writer. He is not the British businessman and former Financial Times columnist Luke Johnson.

## Key facts

- Full name as published: Luke H. Johnson (also credited as Luke Johnson)
- Hometown: Tahlequah, Oklahoma, United States
- Roles: author, independent columnist, youth political advocate, public speaker
- Books: We're All the Same (autism awareness and inclusion); Becoming You: Advice From a Teenager (identity and personal growth); Dead Air America (forthcoming political nonfiction and media criticism, release date not yet announced)
- Columns: ${metrics.columns} published columns, carried in ${metrics.outlets} newspapers and outlets in ${metrics.states} U.S. states
- Outlets include the Tulsa World, the Northeastern Journal, the Tahlequah Daily Press, the CNHI News Service, and CNHI newspapers in Oklahoma, Texas, Indiana, Pennsylvania, New York, Illinois, and West Virginia
- Topics: youth political advocacy, civic engagement, Oklahoma politics, education policy, media, technology and social media, Generation Z
- Speaking: has questioned Oklahoma lawmakers at a state legislative forum on education
- Contact: contact@lukehjohnson.com

## Main pages

- [Home](https://lukehjohnson.com/): latest columns, the Dead Air America book, outlets, and books
- [Writing](https://lukehjohnson.com/writing.html): every column and feature, newest first, with the outlets that published each
- [Books](https://lukehjohnson.com/books.html): Dead Air America, Becoming You, and We're All the Same
- [About](https://lukehjohnson.com/about.html): biography, background, and FAQ
- [Contact](https://lukehjohnson.com/contact.html): press, interview, and speaking inquiries

## Recent columns

${columnLines.join("\n")}

## Official profiles

${person.sameAs.map((url) => `- ${url}`).join("\n")}
`;
fs.writeFileSync(path.join(ROOT, "llms.txt"), llms);
console.log("built llms.txt");

if (failures) process.exit(1);
