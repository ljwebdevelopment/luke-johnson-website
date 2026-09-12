(function () {
  const data = window.siteData || {};

  function qs(selector, scope = document) {
    return scope.querySelector(selector);
  }

  function qsa(selector, scope = document) {
    return Array.from(scope.querySelectorAll(selector));
  }

  function slug(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  // True when every outlet already appears as a direct link, so listing the
  // publication names again would just repeat the link row.
  function linkedEverywhere(item) {
    const labels = (item.sourceLinks || []).map((link) => link.label);
    const publications = item.publications || [];
    return publications.length > 0 && publications.every((name) => labels.includes(name));
  }

  function createSourceLinks(links) {
    if (!links || !links.length) return "";
    return `
      <div class="archive-row-links">
        ${links.map((link) => `<a href="${link.url}" target="_blank" rel="noopener">Read at ${link.label}</a>`).join("")}
      </div>
    `;
  }

  function createArchiveRow(item) {
    const article = document.createElement("article");
    article.className = "archive-row";
    const badges = item.badges || [];
    const publications = item.publications || [];
    article.dataset.category = slug(item.type);
    article.dataset.filters = [item.type, item.category, ...badges].map(slug).join(" ");
    article.dataset.search = [
      item.title,
      item.type,
      item.category,
      item.description,
      item.publicationDate,
      publications.join(" "),
      badges.join(" ")
    ].filter(Boolean).join(" ").toLowerCase();

    const hasLinks = (item.sourceLinks || []).length > 0;
    const showPublicationNote = !linkedEverywhere(item) && publications.length;

    article.innerHTML = `
      <div>
        <span class="archive-row-meta">${item.type}${item.category ? ` &middot; ${item.category}` : ""}</span>
        <h3>${item.title}</h3>
        ${item.description ? `<p>${item.description}</p>` : ""}
        ${showPublicationNote ? `<p class="publication-note">${publications.join(" &middot; ")}</p>` : ""}
        ${createSourceLinks(item.sourceLinks)}
        ${!hasLinks && item.type !== "Book" ? `<p class="subscriber-note">Full text available through the publication listed.</p>` : ""}
      </div>
      <div class="archive-row-side">
        ${item.publicationDate ? `<span class="pub-date">${item.publicationDate}</span>` : ""}
      </div>
    `;
    return article;
  }

  function renderArchive() {
    const grid = qs("[data-archive-grid]");
    if (!grid) return;

    const items = (data.archiveItems || []).slice();
    items.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
    items.forEach((item) => grid.appendChild(createArchiveRow(item)));

    const search = qs("[data-archive-search]");
    const filters = qsa("[data-filter]");
    const empty = qs("[data-empty-state]");

    function applyFilters() {
      const query = (search && search.value ? search.value : "").toLowerCase().trim();
      const active = (qs("[data-filter].is-active") || {}).dataset?.filter || "all";
      let shown = 0;

      qsa(".archive-row", grid).forEach((row) => {
        const matchesFilter = active === "all" || row.dataset.filters.includes(active) || row.dataset.category === active;
        const matchesSearch = !query || row.dataset.search.includes(query);
        const visible = matchesFilter && matchesSearch;
        row.hidden = !visible;
        if (visible) shown += 1;
      });

      if (empty) empty.hidden = shown !== 0;
    }

    if (search) search.addEventListener("input", applyFilters);
    filters.forEach((button) => {
      button.addEventListener("click", () => {
        filters.forEach((filter) => filter.classList.remove("is-active"));
        button.classList.add("is-active");
        applyFilters();
      });
    });

    const queryParam = new URLSearchParams(window.location.search).get("q");
    if (queryParam && search) {
      search.value = queryParam;
    }
    applyFilters();
  }

  function renderArchiveTeaser() {
    const list = qs("[data-archive-teaser]");
    if (!list) return;
    const limit = Number(list.dataset.limit || 6);
    const items = (data.archiveItems || [])
      .filter((item) => item.type !== "Book")
      .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)))
      .slice(0, limit);

    items.forEach((item) => {
      const readLink = (item.sourceLinks || [])[0];
      const row = document.createElement("a");
      row.className = "archive-row";
      row.href = readLink ? readLink.url : "archive.html";
      if (readLink) {
        row.target = "_blank";
        row.rel = "noopener";
      }
      const source = (item.publications || [])[0] || "";
      row.innerHTML = `
        <span class="archive-row-meta">${source}${item.publicationDate ? ` &middot; ${item.publicationDate}` : ""}</span>
        <h3>${item.title}</h3>
      `;
      list.appendChild(row);
    });
  }

  function renderLatestColumn() {
    const mount = qs("[data-latest-column]");
    if (!mount) return;
    const columns = (data.archiveItems || []).filter((item) => item.type && item.type.toLowerCase().includes("column"));
    const item = columns.find((column) => column.featured) || columns[0];
    if (!item) return;

    const readLink = (item.sourceLinks || [])[0];
    const source = (item.publications || [])[0] || "";

    mount.innerHTML = `
      <p class="kicker">Latest Column</p>
      <h2>${item.title}</h2>
      <p class="byline">${source}${item.publicationDate ? ` &middot; ${item.publicationDate}` : ""}</p>
      ${item.description ? `<p>${item.description}</p>` : ""}
      <a class="text-link" href="${readLink ? readLink.url : "archive.html"}"${readLink ? ` target="_blank" rel="noopener"` : ""}>Read at ${source || "the archive"} &rarr;</a>
    `;
  }

  function createPlaceholderCover(book, index) {
    const placeholder = document.createElement("div");
    placeholder.className = "book-placeholder";
    const span = document.createElement("span");
    span.textContent = String(index + 1).padStart(2, "0");
    const strong = document.createElement("strong");
    strong.textContent = book.title;
    placeholder.append(span, strong);
    return placeholder;
  }

  function createBookRow(book, index) {
    const article = document.createElement("article");
    article.className = "book-row";

    const amazonLink = book.amazonLink
      ? `<a class="text-link" href="${book.amazonLink}" target="_blank" rel="noopener">Buy on Amazon &rarr;</a>`
      : "";
    const learnMoreLink = book.learnMoreLink
      ? `<a class="text-link" href="${book.learnMoreLink}">Learn more &rarr;</a>`
      : "";

    article.innerHTML = `
      <div class="book-cover-wrap"></div>
      <div class="book-copy">
        <p class="kicker">${book.comingSoon ? "Upcoming Book" : "Book"}</p>
        <h3>${book.title}</h3>
        ${!book.comingSoon ? `<p class="byline">${book.year}</p>` : ""}
        <p>${book.description}</p>
        ${book.comingSoon && book.releaseWindow ? `<span class="tag-line">Coming Soon &middot; ${book.releaseWindow}</span>` : ""}
        <div class="actions">${amazonLink}${learnMoreLink}</div>
      </div>
    `;

    const coverWrap = qs(".book-cover-wrap", article);
    if (book.coverImage) {
      const figure = document.createElement("figure");
      const img = document.createElement("img");
      img.src = book.coverImage;
      img.alt = `Cover of ${book.title}`;
      img.loading = "lazy";
      img.addEventListener("error", () => {
        coverWrap.replaceChildren(createPlaceholderCover(book, index));
      });
      figure.appendChild(img);
      coverWrap.appendChild(figure);
    } else {
      coverWrap.appendChild(createPlaceholderCover(book, index));
    }

    return article;
  }

  function renderBooks() {
    const grid = qs("[data-books-grid]");
    if (!grid) return;
    const excludeComingSoon = grid.hasAttribute("data-exclude-coming-soon");
    (data.books || [])
      .filter((book) => !excludeComingSoon || !book.comingSoon)
      .forEach((book, index) => grid.appendChild(createBookRow(book, index)));
  }

  function createPublicationRow(pub) {
    const row = document.createElement("div");
    row.className = "pub-row";
    row.innerHTML = `
      <div>
        <span class="pub-name">${pub.name}</span>
        <span class="pub-loc">${pub.location}</span>
      </div>
      <p class="pub-desc">${pub.description}</p>
      ${pub.website ? `<a class="pub-visit" href="${pub.website}" target="_blank" rel="noopener">Visit site &rarr;</a>` : ""}
    `;
    return row;
  }

  const SCOPE_ORDER = ["Local", "Regional", "National"];
  const SCOPE_LABEL = {
    Local: "Home Paper & Local Outlets",
    Regional: "Regional Syndication",
    National: "National"
  };

  function renderPublications() {
    const list = qs("[data-publications-list]");
    if (!list) return;
    const publications = data.publications || [];

    SCOPE_ORDER.forEach((scope) => {
      const group = publications.filter((pub) => pub.scope === scope);
      if (!group.length) return;
      const heading = document.createElement("h2");
      heading.className = "pub-group-heading";
      heading.textContent = SCOPE_LABEL[scope] || scope;
      list.appendChild(heading);
      const wrap = document.createElement("div");
      wrap.className = "pub-list";
      group.forEach((pub) => wrap.appendChild(createPublicationRow(pub)));
      list.appendChild(wrap);
    });
  }

  function renderInlineCounts() {
    qsa("[data-count-inline]").forEach((node) => {
      const key = node.dataset.countInline;
      const collection = data[key];
      if (Array.isArray(collection)) node.textContent = collection.length;
    });
  }

  function setupNavigation() {
    const toggle = qs(".nav-toggle");
    const nav = qs("#site-navigation");
    if (!toggle || !nav) return;

    function setOpen(open) {
      toggle.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("is-open", open);
      document.body.classList.toggle("nav-open", open);
    }

    function isOpen() {
      return toggle.getAttribute("aria-expanded") === "true";
    }

    toggle.addEventListener("click", () => setOpen(!isOpen()));

    qsa(".nav-link", nav).forEach((link) => {
      link.addEventListener("click", () => setOpen(false));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    document.addEventListener("click", (event) => {
      if (!isOpen()) return;
      if (nav.contains(event.target) || toggle.contains(event.target)) return;
      setOpen(false);
    });

    window.addEventListener("resize", () => {
      if (isOpen() && window.innerWidth > 960) setOpen(false);
    });
  }

  function setupContactForm() {
    const form = qs("[data-contact-form]");
    if (!form) return;

    const status = qs("[data-form-status]", form);
    const submitButton = qs("button[type='submit']", form);
    const successMessage = "Thank you for reaching out. Your message has been received and I will respond as soon as possible.";
    const errorMessage = "There was a problem submitting your message. Please try again later.";

    function setStatus(message, type) {
      if (!status) return;
      status.textContent = message;
      status.dataset.status = type;
      status.setAttribute("role", type === "error" ? "alert" : "status");
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const endpoint = window.contactFormConfig && window.contactFormConfig.googleAppsScriptUrl;
      if (!endpoint) {
        setStatus(errorMessage, "error");
        console.warn("Google Apps Script URL is missing. Add it in assets/js/contactConfig.js.");
        return;
      }

      const formData = new FormData(form);
      formData.set("timestamp", new Date().toISOString());
      formData.set("sourcePage", window.location.href);

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Sending...";
      }

      try {
        await fetch(endpoint, {
          method: "POST",
          mode: "no-cors",
          body: formData
        });
        form.reset();
        setStatus(successMessage, "success");
      } catch (error) {
        setStatus(errorMessage, "error");
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Send Message";
        }
      }
    });
  }

  function markCurrentPage() {
    const current = window.location.pathname.split("/").pop() || "index.html";
    qsa(".nav-link").forEach((link) => {
      const href = link.getAttribute("href");
      if (href === current) link.setAttribute("aria-current", "page");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();
    markCurrentPage();
    renderInlineCounts();
    renderLatestColumn();
    renderArchiveTeaser();
    renderArchive();
    renderBooks();
    renderPublications();
    setupContactForm();
  });
})();
