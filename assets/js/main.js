(function () {
  const data = window.siteData || {};

  function qs(selector, scope = document) {
    return scope.querySelector(selector);
  }

  function qsa(selector, scope = document) {
    return Array.from(scope.querySelectorAll(selector));
  }

  function initials(name) {
    return name
      .replace(/The\s+/gi, "")
      .split(/\s+|\/|&|-/)
      .filter(Boolean)
      .slice(0, 3)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }

  function slug(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function publicationByName(name) {
    return (data.publications || []).find((pub) => pub.name === name);
  }

  function fallbackMark(name) {
    return `<span>${initials(name)}</span>`;
  }

  function createPublicationLogo(name) {
    const pub = publicationByName(name);
    if (!pub || !pub.faviconUrl) {
      return `<span class="mini-pub-mark" title="${name}">${initials(name)}</span>`;
    }
    return `
      <span class="mini-pub-mark" title="${name}">
        <img src="${pub.faviconUrl}" alt="" loading="lazy" onerror="this.remove(); this.parentElement.textContent='${initials(name)}';">
      </span>
    `;
  }

  function createBadges(badges) {
    if (!badges || !badges.length) return "";
    return `<div class="badge-row">${badges.map((badge) => `<span class="badge">${badge}</span>`).join("")}</div>`;
  }

  function createSourceLinks(links) {
    if (!links || !links.length) {
      return `<span class="verification-note">Source links need editorial confirmation.</span>`;
    }
    return `
      <div class="source-links">
        ${links.map((link) => `<a href="${link.url}" target="_blank" rel="noopener">Source: ${link.label}</a>`).join("")}
      </div>
    `;
  }

  function createArchiveCard(item) {
    const article = document.createElement("article");
    article.className = "archive-card";
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
      item.verificationStatus,
      publications.join(" "),
      badges.join(" ")
    ].join(" ").toLowerCase();

    article.innerHTML = `
      <div class="card-meta">
        <span>${item.type}</span>
        <span>${item.publicationDate}</span>
      </div>
      <h3>${item.title}</h3>
      ${createBadges(badges)}
      <p class="source">${item.category}</p>
      <p>${item.description}</p>
      <div class="publication-line">
        <div class="mini-pub-row" aria-label="Publications">${publications.map(createPublicationLogo).join("")}</div>
        <span>${publications.length} ${publications.length === 1 ? "publication" : "publications"}</span>
      </div>
      <p class="publication-list">${publications.join(", ")}</p>
      ${createSourceLinks(item.sourceLinks)}
      ${item.verificationStatus ? `<p class="verification-note">${item.verificationStatus}</p>` : ""}
    `;
    return article;
  }

  function createBookCard(book, index) {
    const article = document.createElement("article");
    article.className = "book-card";
    const frontCover = book.coverImage
      ? `<figure class="book-cover-side"><img src="${book.coverImage}" alt="Front cover of ${book.title}" loading="lazy" onerror="this.closest('figure').remove();"><figcaption>Front</figcaption></figure>`
      : "";
    const backCover = book.backCoverImage
      ? `<figure class="book-cover-side"><img src="${book.backCoverImage}" alt="Back cover of ${book.title}" loading="lazy"><figcaption>Back</figcaption></figure>`
      : "";

    const amazonButton = book.amazonLink
      ? `<a class="button button-small" href="${book.amazonLink}" target="_blank" rel="noopener">Buy on Amazon</a>`
      : "";
    const learnMoreButton = book.learnMoreLink
      ? `<a class="button button-small button-outline" href="${book.learnMoreLink}">Learn More</a>`
      : "";
    const actions = book.comingSoon
      ? `<span class="coming-soon">Coming Soon</span>`
      : `<div class="button-row">${amazonButton}${learnMoreButton}</div>`;

    article.innerHTML = `
      <div class="book-cover" data-cover-count="${Number(Boolean(frontCover)) + Number(Boolean(backCover))}">${frontCover}${backCover || (frontCover ? "" : `<figure class="book-cover-side"><div class="book-placeholder" aria-hidden="true"><span>${index + 1}</span><strong>${book.title}</strong></div><figcaption>Cover</figcaption></figure>`)}</div>
      <div class="book-copy">
        <p class="eyebrow">${book.comingSoon ? "Upcoming Book" : "Book"}</p>
        <h3>${book.title}</h3>
        ${book.comingSoon ? "" : `<p class="source">${book.year}</p>`}
        <p>${book.description}</p>
        ${actions}
      </div>
    `;
    return article;
  }

  function createPublicationCard(pub) {
    const article = document.createElement("article");
    article.className = "publication-card";
    const mark = pub.faviconUrl
      ? `<img src="${pub.faviconUrl}" alt="" loading="lazy" onerror="this.remove(); this.parentElement.innerHTML='${fallbackMark(pub.name).replace(/'/g, "\\'")}';">`
      : fallbackMark(pub.name);
    article.innerHTML = `
      <div class="publication-mark">${mark}</div>
      <h3>${pub.name}</h3>
      <p>${pub.location}</p>
      <p>${pub.description}</p>
      <div class="pub-card-footer">
        <span class="pub-type">${pub.type} / ${pub.scope}</span>
        <a class="text-link" href="${pub.website}" target="_blank" rel="noopener">Visit Site</a>
      </div>
    `;
    return article;
  }

  function calculateMetrics() {
    const archiveItems = data.archiveItems || [];
    const publications = data.publications || [];
    return {
      books: (data.books || []).filter((book) => !book.comingSoon).length,
      columns: archiveItems.filter((item) => item.type && item.type.toLowerCase().includes("column")).length,
      publications: publications.length,
      national: publications.filter((pub) => pub.scope === "National").length,
      syndicated: archiveItems.filter((item) => (item.publications || []).length > 1 && item.type && item.type.toLowerCase().includes("column")).length
    };
  }

  function renderMetrics() {
    const metrics = calculateMetrics();
    qsa("[data-metric]").forEach((node) => {
      const key = node.dataset.metric;
      if (Object.prototype.hasOwnProperty.call(metrics, key)) {
        node.textContent = metrics[key];
      }
    });
  }

  function renderArchive() {
    const grid = qs("[data-archive-grid]");
    if (!grid) return;

    const items = (data.archiveItems || []).slice();
    items.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
    const limit = Number(grid.dataset.limit || items.length);
    items.slice(0, limit).forEach((item) => grid.appendChild(createArchiveCard(item)));

    const search = qs("[data-archive-search]");
    const filters = qsa("[data-filter]");
    const empty = qs("[data-empty-state]");

    function applyFilters() {
      const query = (search && search.value ? search.value : "").toLowerCase().trim();
      const active = (qs("[data-filter].is-active") || {}).dataset?.filter || "all";
      let shown = 0;

      qsa(".archive-card", grid).forEach((card) => {
        const matchesFilter = active === "all" || card.dataset.filters.includes(active) || card.dataset.category === active;
        const matchesSearch = !query || card.dataset.search.includes(query);
        const visible = matchesFilter && matchesSearch;
        card.hidden = !visible;
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
  }

  function createColumnCard(item) {
    const article = document.createElement("article");
    article.className = "column-card";
    const source = (item.publications || [])[0] || "";
    const readLink = (item.sourceLinks || [])[0];
    const readHref = readLink ? readLink.url : "archive.html";
    const external = Boolean(readLink);
    article.innerHTML = `
      <div class="column-source">
        <span>${source}</span>
        <span>${item.publicationDate || ""}</span>
      </div>
      <h3>${item.title}</h3>
      <p>${item.description}</p>
      <a class="text-link" href="${readHref}"${external ? ` target="_blank" rel="noopener"` : ""}>Read the column</a>
    `;
    return article;
  }

  function renderColumns() {
    const grid = qs("[data-columns-grid]");
    if (!grid) return;
    const columns = (data.archiveItems || [])
      .filter((item) => item.type && item.type.toLowerCase().includes("column"))
      .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
    const limit = Number(grid.dataset.limit || columns.length);
    columns.slice(0, limit).forEach((item) => grid.appendChild(createColumnCard(item)));
  }

  function renderBooks() {
    const grid = qs("[data-books-grid]");
    if (!grid) return;
    const excludeComingSoon = grid.hasAttribute("data-exclude-coming-soon");
    (data.books || [])
      .filter((book) => !excludeComingSoon || !book.comingSoon)
      .forEach((book, index) => grid.appendChild(createBookCard(book, index)));
  }

  function renderPublications() {
    qsa("[data-publications-grid]").forEach((grid) => {
      const limit = Number(grid.dataset.limit || (data.publications || []).length);
      (data.publications || []).slice(0, limit).forEach((pub) => grid.appendChild(createPublicationCard(pub)));
    });
  }

  function createPublicationLogoCell(pub) {
    const cell = document.createElement(pub.website ? "a" : "div");
    cell.className = "logo-cell";
    if (pub.website) {
      cell.href = pub.website;
      cell.target = "_blank";
      cell.rel = "noopener";
    }
    const mark = pub.faviconUrl
      ? `<img src="${pub.faviconUrl}" alt="" loading="lazy" onerror="this.remove(); this.parentElement.textContent='${initials(pub.name)}';">`
      : initials(pub.name);
    cell.innerHTML = `
      <span class="logo-mark" aria-hidden="true">${mark}</span>
      <span class="logo-name">${pub.name}<span class="logo-loc">${pub.location}</span></span>
    `;
    return cell;
  }

  function renderPublicationLogos() {
    qsa("[data-publications-logos]").forEach((grid) => {
      const limit = Number(grid.dataset.limit || (data.publications || []).length);
      (data.publications || []).slice(0, limit).forEach((pub) => grid.appendChild(createPublicationLogoCell(pub)));
    });
  }

  function setupNavigation() {
    const toggle = qs(".nav-toggle");
    const nav = qs("#site-navigation");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", () => {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!isOpen));
      nav.classList.toggle("is-open", !isOpen);
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

  function setupNewsletter() {
    const form = qs("[data-newsletter]");
    if (!form) return;
    const status = qs("[data-newsletter-status]");
    const input = qs("input[type='email']", form);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = (input && input.value ? input.value : "").trim();
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      if (!status) return;
      if (!valid) {
        status.textContent = "Please enter a valid email address.";
        status.dataset.status = "error";
        if (input) input.focus();
        return;
      }
      status.textContent = "Thanks! Email updates aren't automated yet — for now, reach Luke through the contact page and he'll add you.";
      status.dataset.status = "success";
      form.reset();
    });
  }

  const prefersReducedMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  function setupReveal() {
    const items = qsa(".reveal");
    if (!items.length) return;
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -40px 0px" }
    );
    items.forEach((el) => observer.observe(el));
  }

  function animateCount(node) {
    const target = parseInt(node.textContent, 10);
    if (!Number.isFinite(target) || prefersReducedMotion) return;
    const duration = 1100;
    const start = performance.now();
    node.textContent = "0";
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = String(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
      else node.textContent = String(target);
    }
    requestAnimationFrame(step);
  }

  function setupCounters() {
    const nodes = qsa("[data-count]");
    if (!nodes.length) return;
    if (prefersReducedMotion || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    nodes.forEach((node) => observer.observe(node));
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
    renderMetrics();
    renderArchive();
    renderColumns();
    renderBooks();
    renderPublications();
    renderPublicationLogos();
    setupContactForm();
    setupNewsletter();
    setupReveal();
    setupCounters();
  });
})();
