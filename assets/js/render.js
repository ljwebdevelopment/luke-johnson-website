// Markup for every data-driven block on lukehjohnson.com.
// Shared by the browser (assets/js/main.js) and the build script
// (scripts/build.js), which writes the same HTML into the pages so the
// content is crawlable without JavaScript.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.siteRender = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const isColumn = (item) => /column/i.test(item.type || "");
  const isFeature = (item) => /feature/i.test(item.type || "");
  const isBook = (item) => /book/i.test(item.type || "");

  function stateOf(outlet) {
    const parts = String(outlet.location || "").split(",");
    return (parts[1] || parts[0] || "").trim() || "Other";
  }

  function slug(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function attr(value) {
    return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function external(url) {
    return /^https?:/i.test(url) ? ` target="_blank" rel="noopener"` : "";
  }

  function metaLine(parts) {
    return parts.filter(Boolean).join(`<span class="dot" aria-hidden="true">/</span>`);
  }

  // Columns and features, newest first (the order of archiveData.js).
  function writing(data) {
    return (data.archiveItems || []).filter((item) => !isBook(item));
  }

  function metrics(data) {
    const outlets = data.publications || [];
    const states = new Set(outlets.map(stateOf).filter((s) => s !== "National"));
    return {
      columns: writing(data).filter(isColumn).length,
      outlets: outlets.length,
      states: states.size,
      books: (data.books || []).filter((book) => !book.comingSoon).length
    };
  }

  // Cover photo for a piece, when archiveData.js lists one. Each photo has a
  // 480px-wide companion (name-480.jpg) for small slots.
  function photo(item, className, sizes) {
    if (!item.image) return "";
    const small = item.image.replace(/\.jpg$/, "-480.jpg");
    return `<figure class="${className}"><img src="${item.image}" srcset="${small} 480w, ${item.image} 1000w" sizes="${sizes}" alt="" loading="lazy" decoding="async"></figure>`;
  }

  // ---------- Home ----------

  function lead(data) {
    const item = writing(data)[0];
    if (!item) return "";
    const outlet = (item.publications || [])[0];
    return `
      ${photo(item, "lead-photo", "(min-width: 1000px) 760px, 100vw")}
      <p class="kicker">Latest ${isColumn(item) ? "column" : "work"}</p>
      <h2 class="lead-title">${item.title}</h2>
      ${item.description ? `<p class="lead-deck">${item.description}</p>` : ""}
      <p class="meta">${metaLine([outlet, item.publicationDate])}</p>
      <div class="btn-row">
        <a class="btn" href="writing.html">All writing</a>
      </div>
    `;
  }

  function story(item) {
    const outlet = (item.publications || [])[0];
    const count = (item.publications || []).length;
    return `
      <article class="story">
        ${photo(item, "story-photo", "(min-width: 640px) 380px, 100vw")}
        <p class="kicker">${outlet || item.type}</p>
        <h3 class="story-title">${item.title}</h3>
        ${item.description ? `<p>${item.description}</p>` : ""}
        <p class="meta">${metaLine([item.publicationDate, count > 1 ? `${count} outlets` : ""])}</p>
      </article>
    `;
  }

  function secondary(data) {
    return writing(data).slice(1, 3).map(story).join("");
  }

  function headlineIndex(data, start, limit) {
    return writing(data)
      .slice(start, start + limit)
      .map((item) => `
            <li${item.image ? ` class="has-thumb"` : ""}>
              <h3>${item.title}</h3>
              <p class="meta">${metaLine([(item.publications || [])[0], item.publicationDate])}</p>
              ${photo(item, "index-thumb", "88px")}
            </li>
          `)
      .join("");
  }

  function outletRoll(data) {
    return (data.publications || [])
      .map((outlet) => `<a href="${outlet.website}"${external(outlet.website)}>${outlet.name}</a>`)
      .join(` <span class="sep" aria-hidden="true">/</span> `);
  }

  function shelf(data) {
    return (data.books || [])
      .filter((book) => !book.comingSoon)
      .map((book) => `
          <article class="shelf-book">
            <img src="${book.coverImage}" alt="Cover of ${attr(book.title)} by Luke H. Johnson" width="342" height="445" loading="lazy" decoding="async">
            <div>
              <p class="kicker">Book</p>
              <h3>${book.title}</h3>
              <p>${book.description}</p>
              ${book.amazonLink ? `<a class="more-link" href="${book.amazonLink}" target="_blank" rel="noopener">Buy on Amazon</a>` : ""}
            </div>
          </article>
        `)
      .join("");
  }

  // ---------- Books page ----------

  function bookRows(data) {
    return (data.books || [])
      .filter((book) => !book.comingSoon)
      .map((book) => `
          <article class="book-row" id="${slug(book.title)}">
            <div class="book-covers">
              ${book.coverImage ? `<figure><img src="${book.coverImage}" alt="Front cover of ${attr(book.title)} by Luke H. Johnson" width="342" height="445" loading="lazy" decoding="async"><figcaption class="meta">Front</figcaption></figure>` : ""}
              ${book.backCoverImage ? `<figure><img src="${book.backCoverImage}" alt="Back cover of ${attr(book.title)} by Luke H. Johnson" width="342" height="445" loading="lazy" decoding="async"><figcaption class="meta">Back</figcaption></figure>` : ""}
            </div>
            <div>
              <p class="kicker">Nonfiction</p>
              <h3>${book.title}</h3>
              <p>${book.description}</p>
              ${book.amazonLink ? `<div class="btn-row"><a class="btn" href="${book.amazonLink}" target="_blank" rel="noopener">Buy on Amazon</a></div>` : ""}
            </div>
          </article>
        `)
      .join("");
  }

  // ---------- Writing page ----------

  function searchText(item) {
    return [item.title, item.type, item.category, item.description, item.publicationDate, (item.publications || []).join(" "), (item.badges || []).join(" ")]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function entry(item) {
    const outlets = item.publications || [];
    const kind = isColumn(item) ? "column" : isFeature(item) ? "feature" : "other";
    return `
      <li class="entry${item.image ? " has-photo" : ""}" id="${slug(item.title)}" data-kind="${kind}" data-search="${attr(searchText(item))}">
        <div class="entry-side">
          <span class="kicker">${item.type}</span>
          ${item.publicationDate ? `<span class="meta">${item.publicationDate}</span>` : ""}
        </div>
        <div>
          <h2 class="entry-title">${item.title}</h2>
          ${item.description ? `<p class="entry-desc">${item.description}</p>` : ""}
          ${outlets.length ? `<p class="entry-also">Ran in ${outlets.join(", ")}.</p>` : ""}
        </div>
        ${photo(item, "entry-photo", "(min-width: 760px) 220px, 100vw")}
      </li>
    `;
  }

  function entries(data) {
    return writing(data).map(entry).join("");
  }

  function directory(data) {
    const groups = new Map();
    (data.publications || []).forEach((outlet) => {
      const state = stateOf(outlet);
      if (!groups.has(state)) groups.set(state, []);
      groups.get(state).push(outlet);
    });
    // Home state first, then national outlets, then everyone else by size.
    const rank = (s) => (s === "Oklahoma" ? 0 : s === "National" ? 1 : 2);
    const order = Array.from(groups.keys()).sort(
      (a, b) => rank(a) - rank(b) || groups.get(b).length - groups.get(a).length || a.localeCompare(b)
    );
    return order
      .map((state) => `
        <section class="directory-group">
          <h3>${state}<span>${groups.get(state).length}</span></h3>
          <ul>
            ${groups.get(state).map((outlet) => `
              <li>
                <a href="${outlet.website}" target="_blank" rel="noopener">${outlet.name}</a>
                <span>${state === "National" ? outlet.type : outlet.location.split(",")[0]}</span>
              </li>
            `).join("")}
          </ul>
        </section>
      `)
      .join("");
  }

  return {
    isColumn, isFeature, stateOf, slug, writing, metrics,
    lead, secondary, headlineIndex, outletRoll, shelf, bookRows, entries, directory
  };
});
