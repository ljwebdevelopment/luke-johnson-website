// Renders every data-driven block on lukehjohnson.com from window.siteData
// (assets/js/archiveData.js). Each page includes only the hooks it needs.
(function () {
  "use strict";

  const data = window.siteData || {};
  const books = data.books || [];
  const outlets = data.publications || [];
  // Books live on the books page, so the writing list leaves them out.
  const writing = (data.archiveItems || []).filter((item) => !/book/i.test(item.type || ""));

  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const isColumn = (item) => /column/i.test(item.type || "");
  const isFeature = (item) => /feature/i.test(item.type || "");
  const stateOf = (outlet) => {
    const parts = String(outlet.location || "").split(",");
    return (parts[1] || parts[0] || "").trim() || "Other";
  };

  function external(url) {
    return /^https?:/i.test(url) ? ` target="_blank" rel="noopener"` : "";
  }

  function primaryLink(item) {
    const link = (item.sourceLinks || [])[0];
    return link ? link.url : "";
  }

  // Headline text, linked to the article when there is one online.
  function headline(item, href) {
    return href ? `<a href="${href}"${external(href)}>${item.title}</a>` : item.title;
  }

  function metaLine(parts) {
    return parts.filter(Boolean).join(`<span class="dot" aria-hidden="true">/</span>`);
  }

  // ---------- Metrics ----------

  function metrics() {
    const states = new Set(outlets.map(stateOf).filter((s) => s !== "National"));
    return {
      columns: writing.filter(isColumn).length,
      outlets: outlets.length,
      states: states.size,
      books: books.filter((book) => !book.comingSoon).length
    };
  }

  function renderMetrics() {
    const values = metrics();
    qsa("[data-metric]").forEach((node) => {
      const key = node.dataset.metric;
      if (key in values) node.textContent = values[key];
    });
  }

  function renderDate() {
    qsa("[data-today]").forEach((node) => {
      node.textContent = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
      });
    });
  }

  // ---------- Home: front page ----------

  function renderLead() {
    const node = qs("[data-lead]");
    if (!node || !writing.length) return;
    const item = writing[0];
    const outlet = (item.publications || [])[0];
    const href = primaryLink(item);
    node.innerHTML = `
      <p class="kicker">Latest ${isColumn(item) ? "column" : "work"}</p>
      <h2 class="lead-title">${headline(item, href)}</h2>
      ${item.description ? `<p class="lead-deck">${item.description}</p>` : ""}
      <p class="meta">${metaLine([outlet, item.publicationDate])}</p>
      <div class="btn-row">
        ${href ? `<a class="btn" href="${href}"${external(href)}>Read it${outlet ? ` in ${outlet.replace(/^The /, "the ")}` : ""}</a>` : ""}
        <a class="btn btn-ghost" href="writing.html">All writing</a>
      </div>
    `;
  }

  function storyMarkup(item) {
    const href = primaryLink(item);
    const outlet = (item.publications || [])[0];
    return `
      <article class="story">
        <p class="kicker">${outlet || item.type}</p>
        <h3 class="story-title">${headline(item, href)}</h3>
        ${item.description ? `<p>${item.description}</p>` : ""}
        <p class="meta">${metaLine([item.publicationDate, (item.publications || []).length > 1 ? `${item.publications.length} outlets` : ""])}</p>
      </article>
    `;
  }

  function renderSecondary() {
    const node = qs("[data-secondary]");
    if (!node) return;
    node.innerHTML = writing.slice(1, 3).map(storyMarkup).join("");
  }

  function renderHeadlineIndex() {
    qsa("[data-headline-index]").forEach((list) => {
      const start = Number(list.dataset.start || 0);
      const limit = Number(list.dataset.limit || writing.length);
      list.innerHTML = writing
        .slice(start, start + limit)
        .map((item) => {
          const href = primaryLink(item);
          return `
            <li>
              <h3>${headline(item, href)}</h3>
              <p class="meta">${metaLine([(item.publications || [])[0], item.publicationDate])}</p>
            </li>
          `;
        })
        .join("");
    });
  }

  function renderOutletRoll() {
    qsa("[data-outlet-roll]").forEach((node) => {
      node.innerHTML = outlets
        .map((outlet) => `<a href="${outlet.website}"${external(outlet.website)}>${outlet.name}</a>`)
        .join(` <span class="sep" aria-hidden="true">/</span> `);
    });
  }

  function renderShelf() {
    qsa("[data-shelf]").forEach((node) => {
      node.innerHTML = books
        .filter((book) => !book.comingSoon)
        .map((book) => `
          <article class="shelf-book">
            <img src="${book.coverImage}" alt="Cover of ${book.title}" width="342" height="445" loading="lazy">
            <div>
              <p class="kicker">Book</p>
              <h3>${book.title}</h3>
              <p>${book.description}</p>
              ${book.amazonLink ? `<a class="more-link" href="${book.amazonLink}" target="_blank" rel="noopener">Buy on Amazon</a>` : ""}
            </div>
          </article>
        `)
        .join("");
    });
  }

  // ---------- Books page ----------

  function renderBookRows() {
    qsa("[data-book-rows]").forEach((node) => {
      node.innerHTML = books
        .filter((book) => !book.comingSoon)
        .map((book) => `
          <article class="book-row">
            <div class="book-covers">
              ${book.coverImage ? `<figure><img src="${book.coverImage}" alt="Front cover of ${book.title}" width="342" height="445" loading="lazy"><figcaption class="meta">Front</figcaption></figure>` : ""}
              ${book.backCoverImage ? `<figure><img src="${book.backCoverImage}" alt="Back cover of ${book.title}" width="342" height="445" loading="lazy"><figcaption class="meta">Back</figcaption></figure>` : ""}
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
    });
  }

  // ---------- Writing page ----------

  function entryMarkup(item) {
    const links = item.sourceLinks || [];
    const labels = links.map((link) => link.label);
    const unlinked = (item.publications || []).filter((name) => !labels.includes(name));
    const href = primaryLink(item);
    return `
      <li class="entry" data-kind="${isColumn(item) ? "column" : isFeature(item) ? "feature" : "other"}">
        <div class="entry-side">
          <span class="kicker">${item.type}</span>
          ${item.publicationDate ? `<span class="meta">${item.publicationDate}</span>` : ""}
        </div>
        <div>
          <h2 class="entry-title">${headline(item, href)}</h2>
          ${item.description ? `<p class="entry-desc">${item.description}</p>` : ""}
          ${links.length ? `<p class="entry-links"><span class="meta">Read it in</span>${links.map((link) => `<a href="${link.url}" target="_blank" rel="noopener">${link.label}</a>`).join("")}</p>` : ""}
          ${unlinked.length ? `<p class="entry-also">${links.length ? "Also ran in" : "Ran in"} ${unlinked.join(", ")}.</p>` : ""}
        </div>
      </li>
    `;
  }

  function renderEntries() {
    const list = qs("[data-entries]");
    if (!list) return;

    list.innerHTML = writing.map(entryMarkup).join("");
    const entries = qsa(".entry", list);
    entries.forEach((entry, index) => {
      entry.dataset.search = JSON.stringify(writing[index]).toLowerCase();
    });

    const search = qs("[data-search]");
    const filters = qsa("[data-filter]");
    const count = qs("[data-result-count]");
    const empty = qs("[data-empty]");

    function apply() {
      const query = (search ? search.value : "").toLowerCase().trim();
      const active = (filters.find((btn) => btn.getAttribute("aria-pressed") === "true") || {}).dataset;
      const kind = active ? active.filter : "all";
      let shown = 0;
      entries.forEach((entry) => {
        const visible =
          (kind === "all" || entry.dataset.kind === kind) &&
          (!query || entry.dataset.search.includes(query));
        entry.hidden = !visible;
        if (visible) shown += 1;
      });
      if (count) count.textContent = `${shown} ${shown === 1 ? "piece" : "pieces"}`;
      if (empty) empty.hidden = shown !== 0;
    }

    filters.forEach((button) => {
      button.addEventListener("click", () => {
        filters.forEach((btn) => btn.setAttribute("aria-pressed", String(btn === button)));
        apply();
      });
    });

    if (search) {
      const fromUrl = new URLSearchParams(window.location.search).get("q");
      if (fromUrl) search.value = fromUrl;
      search.addEventListener("input", apply);
    }
    apply();
  }

  function renderDirectory() {
    const node = qs("[data-directory]");
    if (!node) return;
    const groups = new Map();
    outlets.forEach((outlet) => {
      const state = stateOf(outlet);
      if (!groups.has(state)) groups.set(state, []);
      groups.get(state).push(outlet);
    });
    // Home state first, then national outlets, then everyone else by size.
    const order = Array.from(groups.keys()).sort((a, b) => {
      const rank = (s) => (s === "Oklahoma" ? 0 : s === "National" ? 1 : 2);
      return rank(a) - rank(b) || groups.get(b).length - groups.get(a).length || a.localeCompare(b);
    });
    node.innerHTML = order
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

  // ---------- Chrome ----------

  function setupNav() {
    const toggle = qs(".menu-toggle");
    const nav = qs("#site-nav");
    if (!toggle || !nav) return;

    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("is-open", open);
    };
    const isOpen = () => toggle.getAttribute("aria-expanded") === "true";

    toggle.addEventListener("click", () => setOpen(!isOpen()));
    qsa("a", nav).forEach((link) => link.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });
    document.addEventListener("click", (event) => {
      if (isOpen() && !nav.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
    });
    window.addEventListener("resize", () => {
      if (isOpen() && window.innerWidth > 760) setOpen(false);
    });
  }

  function markCurrentPage() {
    const current = window.location.pathname.split("/").pop() || "index.html";
    qsa("#site-nav a").forEach((link) => {
      if (link.getAttribute("href") === current) link.setAttribute("aria-current", "page");
    });
  }

  function setupContactForm() {
    const form = qs("[data-contact-form]");
    if (!form) return;

    const status = qs("[data-form-status]", form);
    const button = qs("button[type='submit']", form);
    const label = button ? button.textContent : "";
    const success = "Thank you for reaching out. Your message has been received and I will respond as soon as possible.";
    const failure = "There was a problem submitting your message. Please try again later.";

    const setStatus = (message, type) => {
      if (!status) return;
      status.textContent = message;
      status.dataset.status = type;
      status.setAttribute("role", type === "error" ? "alert" : "status");
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const endpoint = window.contactFormConfig && window.contactFormConfig.googleAppsScriptUrl;
      if (!endpoint) {
        setStatus(failure, "error");
        console.warn("Google Apps Script URL is missing. Add it in assets/js/contactConfig.js.");
        return;
      }

      const formData = new FormData(form);
      formData.set("timestamp", new Date().toISOString());
      formData.set("sourcePage", window.location.href);

      if (button) {
        button.disabled = true;
        button.textContent = "Sending…";
      }
      try {
        await fetch(endpoint, { method: "POST", mode: "no-cors", body: formData });
        form.reset();
        setStatus(success, "success");
      } catch (error) {
        setStatus(failure, "error");
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = label;
        }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupNav();
    markCurrentPage();
    renderDate();
    renderMetrics();
    renderLead();
    renderSecondary();
    renderHeadlineIndex();
    renderOutletRoll();
    renderShelf();
    renderBookRows();
    renderEntries();
    renderDirectory();
    setupContactForm();
  });
})();
