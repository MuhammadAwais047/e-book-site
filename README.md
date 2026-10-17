# 📚 Bindery — E-Book Site

A cozy e-book library for public-domain classics, built with pure HTML, CSS and vanilla JavaScript — no frameworks, no build step.

**Live demo:** https://muhammadawais047.github.io/e-book-site/

## Two halves

### 1. The Library (offline, built-in)
Four complete masterpieces ship **bundled with the site** and open in a distraction-free built-in reader:

| Book | Author | Length |
| ---- | ------ | ------ |
| Alice's Adventures in Wonderland | Lewis Carroll (1865) | ~26k words |
| The Time Machine | H. G. Wells (1895) | ~32k words |
| The Adventures of Sherlock Holmes | Arthur Conan Doyle (1892) | ~104k words |
| Pride and Prejudice | Jane Austen (1813) | ~127k words |

- **Paginated reader** — CSS multi-column layout with page-turn buttons and ← / → keys
- **Reading progress** — auto-saved per book; a *Continue reading* shelf puts you back exactly where you stopped
- **Font size controls** (A− / A+) persisted across sessions
- Chapter headings auto-detected; generated covers in genre colors

### 2. Discover (live search)
- Searches **79,000+ free books** via the [Gutendex](https://gutendex.com) API (free, no key, CORS-open)
- Topic chips (Fiction, Mystery, Sci-Fi, Romance…) + debounced live search + *Load more* pagination
- Real cover art, summary, subjects, and links to read/download at gutenberg.org
- Graceful offline behavior: friendly error message and a one-click **Try again**

## Why bundled books?

The built-in reader needs to fetch book text with JavaScript. Project Gutenberg serves texts **without CORS headers**, so browsers block cross-origin fetches. Bundling the classics solves this — the collection reads 100% offline, while Discover links out to gutenberg.org for everything else.

## Tech

| Layer  | Choice                                            |
| ------ | ------------------------------------------------- |
| Markup | Semantic HTML5                                    |
| Style  | Modern CSS (grid, multi-column reader, custom properties) |
| Logic  | Vanilla ES2020 — fetch + AbortController, localStorage, CSS columns pagination |

## Run locally

```bash
python -m http.server 8080
# then open http://localhost:8080
```

(Serving over HTTP is required for the API calls and book fetches.)

## Project structure

```
e-book-site/
├── index.html        # library, discover, modal, reader
├── styles.css        # theme, generated covers, column-based reader
├── app.js            # tabs, discover search, reader, progress
└── books/
    ├── books.json    # collection metadata
    └── *.txt         # 4 public-domain texts (headers stripped)
```

Book texts are from [Project Gutenberg](https://www.gutenberg.org) and are in the US public domain.

---

© 2026 [Muhammad Awais](https://github.com/MuhammadAwais047). Licensed under the [MIT License](LICENSE).
