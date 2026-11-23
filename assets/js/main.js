// Page behavior for lukehjohnson.com.
// The data-driven blocks are written into the HTML by scripts/build.js so
// crawlers see them; this re-renders them from window.siteData on load so
// the live site always matches assets/js/archiveData.js, then wires up the
// writing-page search, the menu, and the contact form.
(function () {
  "use strict";

  const render = window.siteRender;
  const config = window.supabaseConfig || {};

  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  function fill(selector, markup) {
    qsa(selector).forEach((node) => {
      node.innerHTML = typeof markup === "function" ? markup(node) : markup;
    });
  }

  function renderBlocks(data) {
    if (!render) return;
    const values = render.metrics(data);
    qsa("[data-metric]").forEach((node) => {
      const key = node.dataset.metric;
      if (key in values) node.textContent = values[key];
    });
    fill("[data-lead]", render.lead(data));
    fill("[data-secondary]", render.secondary(data));
    fill("[data-headline-index]", (node) =>
      render.headlineIndex(data, Number(node.dataset.start || 0), Number(node.dataset.limit || 999))
    );
    fill("[data-outlet-roll]", render.outletRoll(data));
    fill("[data-shelf]", render.shelf(data));
    fill("[data-book-rows]", render.bookRows(data));
    fill("[data-entries]", render.entries(data));
    fill("[data-directory]", render.directory(data));
  }

  // Columns and outlets from Supabase, merged into the bundled site data.
  // Resolves to null when Supabase isn't configured or can't be reached, in
  // which case the page keeps the HTML the build script wrote.
  async function loadLiveData() {
    if (!render || !config.url || !config.publishableKey) return null;
    const headers = { apikey: config.publishableKey };
    const get = (query) =>
      fetch(`${config.url.replace(/\/$/, "")}/rest/v1/${query}`, { headers }).then((res) => {
        if (!res.ok) throw new Error(`Supabase ${res.status}`);
        return res.json();
      });
    try {
      const [pieces, outlets] = await Promise.all([get(render.PIECES_QUERY), get(render.OUTLETS_QUERY)]);
      if (!pieces.length) return null; // not imported yet
      return render.fromDatabase(window.siteData || {}, pieces, outlets);
    } catch (error) {
      console.warn("Could not load live columns; showing the last published version.", error);
      return null;
    }
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

  // ---------- Writing page search and filters ----------

  function setupWritingFilters() {
    const list = qs("[data-entries]");
    if (!list) return;
    const search = qs("[data-search]");
    const filters = qsa("[data-filter]");
    const count = qs("[data-result-count]");
    const empty = qs("[data-empty]");

    function apply() {
      const query = (search ? search.value : "").toLowerCase().trim();
      const active = filters.find((btn) => btn.getAttribute("aria-pressed") === "true");
      const kind = active ? active.dataset.filter : "all";
      let shown = 0;
      qsa(".entry", list).forEach((entry) => {
        const visible =
          (kind === "all" || entry.dataset.kind === kind) &&
          (!query || (entry.dataset.search || "").includes(query));
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
    return apply;
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
    setupContactForm();

    if (config.url) {
      // The HTML already holds the last build; swap in live data when it arrives.
      const refilter = setupWritingFilters();
      loadLiveData().then((live) => {
        if (!live) return;
        renderBlocks(live);
        if (refilter) refilter();
      });
    } else {
      renderBlocks(window.siteData || {});
      setupWritingFilters();
    }
  });
})();
