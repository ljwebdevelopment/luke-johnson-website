// Admin page for lukehjohnson.com: sign in with Supabase Auth, then add,
// edit, and delete columns and outlets. Passwords are checked by Supabase;
// nothing secret lives in this file. Who may edit is enforced in the
// database (supabase/setup.sql), not here.
(function () {
  "use strict";

  const config = window.supabaseConfig || {};
  const qs = (sel, scope = document) => scope.querySelector(sel);
  const qsa = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));
  const esc = (value) =>
    String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const LIVE_NOTE = "It's on the site now. Search engines pick it up within the hour.";

  if (!config.url || !config.publishableKey || !window.supabase) {
    showNotice("The admin page isn't connected to Supabase. Check assets/js/supabaseConfig.js.");
    return;
  }

  // An invite or password-reset link lands here with type=... in the URL.
  const linkType = new URLSearchParams(window.location.hash.slice(1)).get("type");
  const db = window.supabase.createClient(config.url, config.publishableKey, {
    auth: { flowType: "implicit", detectSessionInUrl: true, persistSession: true }
  });

  let pieces = [];
  let outlets = [];
  let editingPiece = null;
  let editingOutlet = null;
  let pendingCover = { file: null, remove: false };

  // ---------- UI helpers ----------

  function showView(name) {
    qsa("[data-view]").forEach((view) => (view.hidden = view.dataset.view !== name));
    qs("[data-sign-out]").hidden = name !== "dashboard";
  }

  function showNotice(message, tone) {
    const node = qs("[data-notice]");
    node.textContent = message || "";
    node.hidden = !message;
    if (tone) node.dataset.tone = tone;
    else delete node.dataset.tone;
    if (message) node.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function friendly(error) {
    const text = (error && (error.message || error.error_description)) || String(error);
    if (/row-level security|permission denied|violates row-level/i.test(text)) {
      return "Your account isn't set up as an admin yet. Run the last step in supabase/setup.sql, then sign in again.";
    }
    if (/Invalid login credentials/i.test(text)) return "That email and password don't match.";
    if (/duplicate key/i.test(text)) return "There's already an outlet with that name.";
    return text;
  }

  function busy(button, on, label) {
    if (!button) return;
    if (on) {
      button.dataset.label = button.textContent;
      button.textContent = label || "Saving…";
      button.disabled = true;
    } else {
      button.textContent = button.dataset.label || button.textContent;
      button.disabled = false;
    }
  }

  // ---------- Auth ----------

  async function start() {
    const { data } = await db.auth.getSession();
    if (data.session && (linkType === "invite" || linkType === "recovery")) {
      showView("set-password");
      return;
    }
    if (data.session) return enterDashboard(data.session);
    showView("sign-in");
  }

  db.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") showView("set-password");
  });

  qs("[data-sign-in-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = qs("button[type=submit]", form);
    busy(button, true, "Signing in…");
    const { data, error } = await db.auth.signInWithPassword({
      email: form.email.value.trim(),
      password: form.password.value
    });
    busy(button, false);
    if (error) return showNotice(friendly(error));
    form.password.value = "";
    showNotice("");
    enterDashboard(data.session);
  });

  qs("[data-forgot]").addEventListener("click", async () => {
    const email = qs("#sign-in-email").value.trim();
    if (!email) return showNotice("Type your email address above first, then click Forgot password.");
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    if (error) return showNotice(friendly(error));
    showNotice("If that address has an admin account, a link to set a new password is on its way. Check your email.", "good");
  });

  qs("[data-password-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.password.value !== form.confirm.value) return showNotice("The two passwords don't match.");
    const button = qs("button[type=submit]", form);
    busy(button, true);
    const { error } = await db.auth.updateUser({ password: form.password.value });
    busy(button, false);
    if (error) return showNotice(friendly(error));
    form.reset();
    history.replaceState(null, "", window.location.pathname);
    showNotice("Password saved.", "good");
    const { data } = await db.auth.getSession();
    enterDashboard(data.session);
  });

  qs("[data-sign-out]").addEventListener("click", async () => {
    await db.auth.signOut();
    showNotice("");
    showView("sign-in");
  });

  async function enterDashboard(session) {
    showView("dashboard");
    qs("[data-signed-in-as]").textContent = session && session.user ? `Signed in as ${session.user.email}` : "";
    const { data: isAdmin, error } = await db.rpc("is_admin");
    if (error || !isAdmin) {
      showNotice("You're signed in, but this account isn't an admin yet. Run the last step in supabase/setup.sql, then reload this page.");
    }
    await loadAll();
  }

  // ---------- Data ----------

  async function loadAll() {
    const [p, o] = await Promise.all([
      db.from("pieces").select("*").order("published_on", { ascending: false, nullsFirst: false }).order("position").order("id", { ascending: false }),
      db.from("outlets").select("*").order("id")
    ]);
    if (p.error || o.error) return showNotice(friendly(p.error || o.error));
    pieces = p.data;
    outlets = o.data;
    qs("[data-import-panel]").hidden = pieces.length > 0 || outlets.length > 0;
    renderPieces();
    renderOutlets();
  }

  function renderPieces() {
    const list = qs("[data-piece-list]");
    if (!pieces.length) {
      list.innerHTML = `<li class="row"><p class="meta">No columns yet.</p></li>`;
      return;
    }
    list.innerHTML = pieces
      .map((p) => `
        <li class="row">
          <div>
            <h3>${esc(p.title)}</h3>
            <p class="meta">${esc([p.type, p.date_label || window.siteRender.formatDate(p.published_on) || "No date", (p.outlets || [])[0]].filter(Boolean).join(" · "))}</p>
          </div>
          <div class="row-actions">
            <button class="btn btn-ghost btn-small" type="button" data-edit-piece="${p.id}">Edit</button>
            <button class="btn btn-ghost btn-small" type="button" data-delete-piece="${p.id}">Delete</button>
          </div>
        </li>`)
      .join("");
  }

  function renderOutlets() {
    const list = qs("[data-outlet-list]");
    if (!outlets.length) {
      list.innerHTML = `<li class="row"><p class="meta">No outlets yet.</p></li>`;
      return;
    }
    const uses = (name) => pieces.filter((p) => (p.outlets || []).includes(name)).length;
    list.innerHTML = outlets
      .map((o) => `
        <li class="row">
          <div>
            <h3>${esc(o.name)}</h3>
            <p class="meta">${esc([o.location, o.type, `${uses(o.name)} pieces`].filter(Boolean).join(" · "))}</p>
          </div>
          <div class="row-actions">
            <button class="btn btn-ghost btn-small" type="button" data-edit-outlet="${o.id}">Edit</button>
            <button class="btn btn-ghost btn-small" type="button" data-delete-outlet="${o.id}">Delete</button>
          </div>
        </li>`)
      .join("");
  }

  // ---------- Tabs ----------

  qsa("[data-tab]").forEach((tab) =>
    tab.addEventListener("click", () => {
      qsa("[data-tab]").forEach((t) => t.setAttribute("aria-pressed", String(t === tab)));
      qsa("[data-panel]").forEach((panel) => (panel.hidden = panel.dataset.panel !== tab.dataset.tab));
    })
  );

  // ---------- Column editor ----------

  const pieceForm = qs("[data-piece-form]");
  let checkedOrder = [];

  function renderOutletChecks(selected) {
    checkedOrder = selected.slice();
    // Outlets the piece names that no longer exist still show, so nothing is lost on save.
    const names = outlets.map((o) => o.name).concat(selected.filter((n) => !outlets.some((o) => o.name === n)));
    qs("[data-outlet-checks]").innerHTML = names
      .map((name) => `<label><input type="checkbox" value="${esc(name)}"${selected.includes(name) ? " checked" : ""}> ${esc(name)}</label>`)
      .join("");
  }

  qs("[data-outlet-checks]").addEventListener("change", (event) => {
    const box = event.target;
    checkedOrder = checkedOrder.filter((n) => n !== box.value);
    if (box.checked) checkedOrder.push(box.value);
  });

  function showCover(url) {
    const preview = qs("[data-cover-preview]");
    preview.hidden = !url;
    if (url) qs("img", preview).src = url;
  }

  function openPieceForm(piece) {
    editingPiece = piece || null;
    pendingCover = { file: null, remove: false };
    pieceForm.reset();
    qs("[data-piece-form-title]").textContent = piece ? "Edit column" : "Add a column";
    if (piece) {
      pieceForm.title.value = piece.title;
      pieceForm.type.value = piece.type;
      pieceForm.published_on.value = piece.published_on || "";
      pieceForm.date_label.value = piece.date_label || "";
      pieceForm.description.value = piece.description || "";
      pieceForm.link.value = ((piece.links || [])[0] || {}).url || "";
      pieceForm.badges.value = (piece.badges || []).join(", ");
    }
    renderOutletChecks(piece ? piece.outlets || [] : []);
    showCover(piece && piece.image_url ? piece.image_url : "");
    pieceForm.hidden = false;
    pieceForm.title.focus();
    pieceForm.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  qs("[data-new-piece]").addEventListener("click", () => openPieceForm(null));
  qs("#piece-cover").addEventListener("change", (event) => {
    const file = event.target.files[0];
    pendingCover = { file: file || null, remove: false };
    if (file) showCover(URL.createObjectURL(file));
  });
  qs("[data-remove-cover]").addEventListener("click", () => {
    pendingCover = { file: null, remove: true };
    qs("#piece-cover").value = "";
    showCover("");
  });

  // Shrink photos to at most 1200px wide before upload so pages stay fast.
  function shrink(file) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1200 / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.82);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }

  async function uploadCover(file, title) {
    const blob = await shrink(file);
    const path = `${Date.now()}-${window.siteRender.slug(title).slice(0, 60) || "cover"}.jpg`;
    const { error } = await db.storage.from("covers").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
    if (error) throw error;
    return db.storage.from("covers").getPublicUrl(path).data.publicUrl;
  }

  async function removeStoredCover(url) {
    const marker = "/storage/v1/object/public/covers/";
    if (!url || !url.includes(marker)) return;
    await db.storage.from("covers").remove([decodeURIComponent(url.split(marker)[1])]);
  }

  pieceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = qs("button[type=submit]", pieceForm);
    const selected = checkedOrder.filter((name) => qsa("[data-outlet-checks] input:checked").some((b) => b.value === name));
    const link = pieceForm.link.value.trim();
    const row = {
      title: pieceForm.title.value.trim(),
      type: pieceForm.type.value,
      published_on: pieceForm.published_on.value || null,
      date_label: pieceForm.date_label.value.trim(),
      description: pieceForm.description.value.trim(),
      outlets: selected,
      links: link ? [{ label: selected[0] || "Article", url: link }] : [],
      badges: pieceForm.badges.value.split(",").map((b) => b.trim()).filter(Boolean)
    };
    if (!row.published_on && !row.date_label) {
      if (!confirm("No date is set, so this will be listed after every dated column. Save anyway?")) return;
    }
    busy(button, true);
    try {
      const oldImage = editingPiece ? editingPiece.image_url : "";
      if (pendingCover.file) row.image_url = await uploadCover(pendingCover.file, row.title);
      else if (pendingCover.remove) row.image_url = "";
      const query = editingPiece
        ? db.from("pieces").update(row).eq("id", editingPiece.id).select()
        : db.from("pieces").insert(row).select();
      const { data, error } = await query;
      if (error) throw error;
      if (!data || !data.length) throw new Error("permission denied");
      if ((pendingCover.file || pendingCover.remove) && oldImage) await removeStoredCover(oldImage);
      pieceForm.hidden = true;
      showNotice(`Saved "${row.title}". ${LIVE_NOTE}`, "good");
      await loadAll();
    } catch (error) {
      showNotice(friendly(error));
    } finally {
      busy(button, false);
    }
  });

  qs("[data-piece-list]").addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-edit-piece]");
    const del = event.target.closest("[data-delete-piece]");
    if (edit) openPieceForm(pieces.find((p) => String(p.id) === edit.dataset.editPiece));
    if (del) {
      const piece = pieces.find((p) => String(p.id) === del.dataset.deletePiece);
      if (!piece || !confirm(`Delete "${piece.title}" from the site? This can't be undone.`)) return;
      const { data, error } = await db.from("pieces").delete().eq("id", piece.id).select();
      if (error || !data || !data.length) return showNotice(friendly(error || "permission denied"));
      await removeStoredCover(piece.image_url);
      showNotice(`Deleted "${piece.title}". ${LIVE_NOTE}`, "good");
      await loadAll();
    }
  });

  // ---------- Outlet editor ----------

  const outletForm = qs("[data-outlet-form]");

  function openOutletForm(outlet) {
    editingOutlet = outlet || null;
    outletForm.reset();
    qs("[data-outlet-form-title]").textContent = outlet ? "Edit outlet" : "Add an outlet";
    if (outlet) {
      const [city, state] = outlet.location.includes(",") ? outlet.location.split(",").map((s) => s.trim()) : ["", ""];
      outletForm.name.value = outlet.name;
      outletForm.city.value = city;
      outletForm.state.value = state;
      outletForm.type.value = outlet.type;
      outletForm.scope.value = outlet.scope;
      outletForm.website.value = outlet.website;
    }
    outletForm.hidden = false;
    outletForm.name.focus();
    outletForm.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  qs("[data-new-outlet]").addEventListener("click", () => openOutletForm(null));

  outletForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = qs("button[type=submit]", outletForm);
    const city = outletForm.city.value.trim();
    const state = outletForm.state.value.trim();
    const row = {
      name: outletForm.name.value.trim(),
      location: city && state ? `${city}, ${state}` : state || city || "National",
      type: outletForm.type.value,
      scope: outletForm.scope.value,
      website: outletForm.website.value.trim()
    };
    busy(button, true);
    try {
      const oldName = editingOutlet ? editingOutlet.name : null;
      const query = editingOutlet
        ? db.from("outlets").update(row).eq("id", editingOutlet.id).select()
        : db.from("outlets").insert(row).select();
      const { data, error } = await query;
      if (error) throw error;
      if (!data || !data.length) throw new Error("permission denied");
      // Renaming an outlet renames it on every column that lists it.
      if (oldName && oldName !== row.name) {
        for (const piece of pieces.filter((p) => (p.outlets || []).includes(oldName))) {
          await db.from("pieces").update({ outlets: piece.outlets.map((n) => (n === oldName ? row.name : n)) }).eq("id", piece.id);
        }
      }
      outletForm.hidden = true;
      showNotice(`Saved ${row.name}. ${LIVE_NOTE}`, "good");
      await loadAll();
    } catch (error) {
      showNotice(friendly(error));
    } finally {
      busy(button, false);
    }
  });

  qs("[data-outlet-list]").addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-edit-outlet]");
    const del = event.target.closest("[data-delete-outlet]");
    if (edit) openOutletForm(outlets.find((o) => String(o.id) === edit.dataset.editOutlet));
    if (del) {
      const outlet = outlets.find((o) => String(o.id) === del.dataset.deleteOutlet);
      const used = pieces.filter((p) => (p.outlets || []).includes(outlet.name)).length;
      const warning = used ? ` ${used} column${used === 1 ? "" : "s"} list it; they'll keep their text, but it leaves the outlet list and counts.` : "";
      if (!confirm(`Delete ${outlet.name}?${warning}`)) return;
      const { data, error } = await db.from("outlets").delete().eq("id", outlet.id).select();
      if (error || !data || !data.length) return showNotice(friendly(error || "permission denied"));
      showNotice(`Deleted ${outlet.name}. ${LIVE_NOTE}`, "good");
      await loadAll();
    }
  });

  qsa("[data-cancel]").forEach((button) =>
    button.addEventListener("click", () => {
      button.closest("form").hidden = true;
    })
  );

  // ---------- One-time import of the current site data ----------

  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7, aug: 8, sept: 9, sep: 9, oct: 10, nov: 11, dec: 12 };
  const pad = (n) => String(n).padStart(2, "0");

  // "Nov. 16, 2026" -> 2026-11-16 (shown as typed); "July 2026" -> 2026-07-01
  // with the text kept, so the site shows exactly what it shows today.
  function parseDate(text) {
    const clean = String(text || "").replace(/^Submitted\s+/i, "");
    let m = clean.match(/^([A-Za-z]+)\.? (\d{1,2})(?:[–-]\d{1,2})?, (\d{4})$/);
    if (m && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[1].toLowerCase()])}-${pad(m[2])}`;
    m = clean.match(/^([A-Za-z]+)\.? (\d{4})$/);
    if (m && MONTHS[m[1].toLowerCase()]) return `${m[2]}-${pad(MONTHS[m[1].toLowerCase()])}-01`;
    return null;
  }

  qs("[data-import]").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const data = window.siteData || {};
    const outletRows = (data.publications || []).map((o) => ({
      name: o.name,
      location: o.location || "",
      type: o.type || "Newspaper",
      scope: o.scope || "Regional",
      website: o.website || "",
      description: o.description || ""
    }));
    const pieceRows = window.siteRender.writing(data).map((item, index) => {
      const iso = parseDate(item.publicationDate);
      const shown = window.siteRender.formatDate(iso);
      return {
        title: item.title,
        type: item.type,
        category: item.category || "",
        description: item.description || "",
        outlets: item.publications || [],
        published_on: iso,
        date_label: item.publicationDate && item.publicationDate !== shown ? item.publicationDate : "",
        image_url: item.image || "",
        links: item.sourceLinks || [],
        badges: item.badges || [],
        position: index
      };
    });
    if (!confirm(`Copy ${pieceRows.length} columns and ${outletRows.length} outlets into the database?`)) return;
    busy(button, true, "Importing…");
    try {
      const o = await db.from("outlets").insert(outletRows).select();
      if (o.error) throw o.error;
      if (!o.data || !o.data.length) throw new Error("permission denied");
      const p = await db.from("pieces").insert(pieceRows).select();
      if (p.error) throw p.error;
      showNotice(`Imported ${p.data.length} columns and ${o.data.length} outlets. From now on, edit them here.`, "good");
      await loadAll();
    } catch (error) {
      showNotice(friendly(error));
    } finally {
      busy(button, false);
    }
  });

  start();
})();
