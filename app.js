(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const GUTENDEX = "https://gutendex.com/books/?";
  const PROGRESS_KEY = "bindery-progress-v1";
  const FONT_KEY = "bindery-font-v1";

  const collectionGrid = $("collection-grid");
  const continueShelf = $("continue-shelf");
  const continueRow = $("continue-row");
  const toast = $("toast");

  let books = [];

  /* ---------- Storage ---------- */
  const loadProgress = () => {
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; } catch { return {}; }
  };
  const saveProgress = (data) => {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  };

  /* ---------- Helpers ---------- */
  let toastTimer;
  const showToast = (text) => {
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.hidden = true), 2000);
  };

  const fetchJSON = async (url, timeoutMs = 12000) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  };

  const GENRE_CLASS = {
    Fantasy: "gc-fantasy",
    "Science Fiction": "gc-scifi",
    Mystery: "gc-mystery",
    Romance: "gc-romance",
  };

  const genCover = (book) => `
    <div class="gen-cover ${GENRE_CLASS[book.genre] || "gc-fantasy"}">
      <span class="g-genre">${book.genre}</span>
      <span class="g-title">${book.title}</span>
      <span class="g-author">${book.author}</span>
    </div>`;

  const PLACEHOLDER = (title, hue) =>
    `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="300" height="450" fill="hsl(${hue},30%,25%)"/><text x="150" y="210" font-family="Georgia,serif" font-size="26" fill="#f3ede2" text-anchor="middle">${title.slice(0, 1)}</text><text x="150" y="260" font-family="Georgia,serif" font-size="13" fill="#cfc4b0" text-anchor="middle">${title.slice(0, 24).replace(/&/g, "&amp;")}</text></svg>`
    )}`;

  /* ---------- Library ---------- */
  const bookCard = (book, progress) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "book-card";
    card.setAttribute("aria-label", `Read ${book.title} by ${book.author}`);

    const cover = document.createElement("div");
    cover.className = "cover";
    cover.innerHTML = genCover(book);

    const title = document.createElement("p");
    title.className = "b-title";
    title.textContent = book.title;

    const author = document.createElement("p");
    author.className = "b-author";
    author.textContent = `${book.author} · ${book.year}`;

    card.append(cover, title, author);

    if (progress > 0) {
      const bar = document.createElement("div");
      bar.className = "b-progress";
      const fill = document.createElement("i");
      fill.style.width = `${progress}%`;
      bar.append(fill);
      const pct = document.createElement("p");
      pct.className = "b-pct";
      pct.textContent = `${progress < 1 ? "<1" : Math.floor(progress)}% read · ${book.minutes} min total`;
      card.append(bar, pct);
    } else {
      const meta = document.createElement("p");
      meta.className = "b-author";
      meta.textContent = `${book.words.toLocaleString("en-US")} words · ${book.minutes} min`;
      card.append(meta);
    }

    card.addEventListener("click", () => openReader(book));
    return card;
  };

  const renderLibrary = () => {
    const progress = loadProgress();

    const reading = books
      .map((b) => ({ b, p: progress[b.id]?.pct || 0, t: progress[b.id]?.updated || 0 }))
      .filter((x) => x.p > 0)
      .sort((a, b) => b.t - a.t);

    continueShelf.hidden = reading.length === 0;
    continueRow.replaceChildren(
      ...reading.map(({ b, p }) => bookCard(b, p))
    );

    collectionGrid.replaceChildren(...books.map((b) => bookCard(b, progress[b.id]?.pct || 0)));
  };

  /* ---------- Tabs ---------- */
  const setTab = (which) => {
    const library = which === "library";
    $("tab-library").classList.toggle("is-active", library);
    $("tab-library").setAttribute("aria-pressed", String(library));
    $("tab-discover").classList.toggle("is-active", !library);
    $("tab-discover").setAttribute("aria-pressed", String(!library));
    $("view-library").hidden = !library;
    $("view-discover").hidden = library;
  };

  $("tab-library").addEventListener("click", () => setTab("library"));
  $("tab-discover").addEventListener("click", () => setTab("discover"));

  /* ---------- Discover (Gutendex) ---------- */
  const discoverGrid = $("discover-grid");
  const discoverStatus = $("discover-status");
  const loadMoreBtn = $("load-more");
  const qInput = $("q");

  let discoverState = { url: "", nextPage: null, loading: false, queried: false };

  const txtLinkOf = (id, formats) => {
    const keys = Object.keys(formats).filter((k) => k.startsWith("text/plain") && !formats[k].endsWith(".zip"));
    return keys.length ? formats[keys[0]] : `https://www.gutenberg.org/ebooks/${id}`;
  };

  const discoverCard = (item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "book-card";
    card.setAttribute("aria-label", `Details for ${item.title}`);

    const cover = document.createElement("div");
    cover.className = "cover";
    const img = document.createElement("img");
    img.loading = "lazy";
    img.alt = `Cover of ${item.title}`;
    const coverUrl = item.formats["image/jpeg"] || item.formats["image/png"];
    img.src = coverUrl || PLACEHOLDER(item.title, item.id % 360);
    img.addEventListener("error", () => {
      img.src = PLACEHOLDER(item.title, item.id % 360);
    });
    cover.append(img);

    const title = document.createElement("p");
    title.className = "b-title";
    title.textContent = item.title;

    const author = document.createElement("p");
    author.className = "b-author";
    author.textContent = item.authors.length
      ? item.authors[0].name.replace(/,(\s*)/, ", ").split(", ").reverse().join(" ")
      : "Unknown author";

    card.append(cover, title, author);
    card.addEventListener("click", () => openModal(item));
    return card;
  };

  const runDiscover = async ({ reset }) => {
    if (discoverState.loading) return;
    discoverState.loading = true;
    loadMoreBtn.hidden = true;

    if (reset) {
      discoverGrid.replaceChildren();
      const spinner = document.createElement("div");
      spinner.className = "spinner-inline";
      spinner.setAttribute("aria-hidden", "true");
      discoverGrid.append(spinner);
    }

    const url = discoverState.nextPage || discoverState.url;
    discoverStatus.textContent = discoverState.queried && reset ? "Searching…" : "";

    try {
      const data = await fetchJSON(url, 25000);
      const spinner = discoverGrid.querySelector(".spinner-inline");
      if (spinner) spinner.remove();

      const cards = data.results.map(discoverCard);
      if (reset) discoverGrid.replaceChildren(...cards);
      else discoverGrid.append(...cards);

      const n = data.results.length;
      discoverStatus.textContent = n
        ? `${n} book${n === 1 ? "" : "s"} ${reset ? "found" : "loaded"}${data.count > n ? ` of ${data.count.toLocaleString("en-US")}` : ""}`
        : "No books found — try another search or topic.";

      discoverState.nextPage = data.next;
      loadMoreBtn.hidden = !data.next;
    } catch (err) {
      discoverGrid.querySelector(".spinner-inline")?.remove();
      discoverStatus.textContent = `Couldn't reach Gutendex (${err.message}).`;

      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "btn btn-ghost";
      retry.textContent = "Try again";
      retry.addEventListener("click", () => {
        discoverState.nextPage = null;
        runDiscover({ reset: true });
      });
      discoverGrid.append(retry);
    } finally {
      discoverState.loading = false;
    }
  };

  const queryDiscover = () => {
    const q = qInput.value.trim();
    const topic = document.querySelector(".chip.is-active")?.dataset.topic || "";
    const params = new URLSearchParams();
    if (q) params.set("search", q);
    if (topic) params.set("topic", topic);
    discoverState.url = `${GUTENDEX}${params.toString()}`;
    discoverState.nextPage = null;
    discoverState.queried = true;
    runDiscover({ reset: true });
  };

  $("discover-form").addEventListener("submit", (e) => {
    e.preventDefault();
    queryDiscover();
  });

  let searchDebounce;
  qInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      if (qInput.value.trim().length >= 3 || qInput.value.trim() === "") queryDiscover();
    }, 500);
  });

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach((c) => {
        c.classList.toggle("is-active", c === chip);
        c.setAttribute("aria-pressed", String(c === chip));
      });
      queryDiscover();
    });
  });

  loadMoreBtn.addEventListener("click", () => runDiscover({ reset: false }));

  /* ---------- Detail modal ---------- */
  const modal = $("modal");
  let lastFocus = null;

  const openModal = (item) => {
    lastFocus = document.activeElement;
    $("modal-cover").src =
      item.formats["image/jpeg"] || item.formats["image/png"] || PLACEHOLDER(item.title, item.id % 360);
    $("modal-cover").alt = `Cover of ${item.title}`;
    $("modal-title").textContent = item.title;
    $("modal-author").textContent = item.authors.length
      ? `${item.authors[0].name.split(", ").reverse().join(" ")}${item.authors[0].birth_year ? ` (${item.authors[0].birth_year}–${item.authors[0].death_year ?? ""})` : ""}`
      : "Unknown author";
    $("modal-desc").textContent = item.summaries?.[0]?.replace(/\s+/g, " ").trim() || "No summary available for this book.";
    $("modal-read").href = `https://www.gutenberg.org/ebooks/${item.id}`;
    $("modal-download").href = txtLinkOf(item.id, item.formats);

    const tags = $("modal-tags");
    tags.replaceChildren(
      ...item.subjects.slice(0, 5).map((s) => {
        const span = document.createElement("span");
        span.textContent = s.split(" -- ")[0];
        return span;
      })
    );

    modal.hidden = false;
    $("modal-close").focus();
  };

  const closeModal = () => {
    modal.hidden = true;
    lastFocus?.focus();
  };

  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeModal();
  });

  /* ---------- Reader ---------- */
  const reader = $("reader");
  const frame = $("reader-frame");
  const content = $("reader-content");
  const progressBar = $("progress-bar");
  const pageLabel = $("page-label");
  let currentBook = null;
  let saveTimer;

  const getFont = () => {
    try {
      const v = Number(localStorage.getItem(FONT_KEY));
      if (v >= 15 && v <= 28) return v;
    } catch { /* ignore */ }
    return 19;
  };

  const setFont = (size) => {
    const clamped = Math.min(Math.max(size, 15), 28);
    content.style.setProperty("--reader-font", `${clamped}px`);
    try { localStorage.setItem(FONT_KEY, String(clamped)); } catch { /* ignore */ }
    return clamped;
  };

  const renderProgress = () => {
    const max = frame.scrollWidth - frame.clientWidth;
    const pct = max > 0 ? (frame.scrollLeft / max) * 100 : 0;
    progressBar.style.width = `${pct}%`;
    pageLabel.textContent = `${Math.round(pct)}%`;
    return pct;
  };

  const saveReaderProgress = () => {
    if (!currentBook) return;
    const max = frame.scrollWidth - frame.clientWidth;
    const pct = max > 0 ? (frame.scrollLeft / max) * 100 : 0;
    const data = loadProgress();
    data[currentBook.id] = { pct, updated: Date.now() };
    saveProgress(data);
  };

  const turnPage = (dir) => {
    const step = frame.clientWidth + 60; // column-gap
    frame.scrollLeft = Math.max(0, Math.min(frame.scrollLeft + dir * step, frame.scrollWidth - frame.clientWidth));
  };

  const formatText = (raw) => {
    const blocks = raw.split(/\n\s*\n/).map((b) => b.replace(/\s+/g, " ").trim()).filter(Boolean);
    const frag = document.createDocumentFragment();
    for (const block of blocks) {
      if (/^(CHAPTER|LETTER|STAVE|ACT [IV]+|PART)\b/i.test(block) && block.length < 120) {
        const h = document.createElement("h2");
        h.textContent = block;
        frag.append(h);
      } else {
        const p = document.createElement("p");
        p.textContent = block;
        frag.append(p);
      }
    }
    return frag;
  };

  const openReader = async (book) => {
    currentBook = book;
    $("reader-title").textContent = book.title;
    $("reader-author").textContent = `${book.author} · ${book.year}`;
    content.replaceChildren();
    content.style.setProperty("--reader-font", `${getFont()}px`);
    progressBar.style.width = "0%";
    pageLabel.textContent = "…";
    reader.hidden = false;
    document.body.style.overflow = "hidden";

    try {
      const res = await fetch(book.file);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.text();
      content.replaceChildren(formatText(raw));

      // restore saved position
      const saved = loadProgress()[book.id];
      requestAnimationFrame(() => {
        if (saved?.pct > 0) {
          const max = frame.scrollWidth - frame.clientWidth;
          frame.scrollLeft = (saved.pct / 100) * max;
          showToast(`Resumed at ${saved.pct < 1 ? "<1" : Math.floor(saved.pct)}%`);
        }
        renderProgress();
        frame.focus({ preventScroll: true });
      });
    } catch (err) {
      content.replaceChildren();
      const p = document.createElement("p");
      p.textContent = `Couldn't load the book text (${err.message}).`;
      content.append(p);
    }
  };

  const closeReader = () => {
    saveReaderProgress();
    reader.hidden = true;
    document.body.style.overflow = "";
    currentBook = null;
    renderLibrary();
  };

  frame.addEventListener("scroll", () => {
    renderProgress();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveReaderProgress, 400);
  }, { passive: true });

  $("page-prev").addEventListener("click", () => turnPage(-1));
  $("page-next").addEventListener("click", () => turnPage(1));
  $("font-plus").addEventListener("click", () => setFont(getFont() + 2));
  $("font-minus").addEventListener("click", () => setFont(getFont() - 2));
  $("reader-close").addEventListener("click", closeReader);

  document.addEventListener("keydown", (e) => {
    if (!reader.hidden) {
      if (e.key === "ArrowRight") turnPage(1);
      else if (e.key === "ArrowLeft") turnPage(-1);
      else if (e.key === "Escape") closeReader();
      return;
    }
    if (!modal.hidden && e.key === "Escape") closeModal();
  });

  /* ---------- Boot ---------- */
  $("year").textContent = new Date().getFullYear();

  (async () => {
    try {
      books = await fetchJSON("books/books.json");
      renderLibrary();
    } catch (err) {
      collectionGrid.replaceChildren();
      const p = document.createElement("p");
      p.style.color = "var(--muted)";
      p.textContent = `Couldn't load the collection (${err.message}).`;
      collectionGrid.append(p);
    }
    queryDiscover();
  })();
})();
