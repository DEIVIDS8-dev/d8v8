(() => {
  "use strict";

  /* ---------- fechas: dos formas de cargarlas ----------

     OPCIÓN A — automática, con Google Sheets (recomendada):
       1. Creá una Hoja de cálculo de Google con estas 3 columnas exactas
          en la primera fila:  fecha | ciudad | sitio
          Ejemplo de fila de abajo:  2026-09-20 | CDMX | Nombre del club o evento
          (la fecha siempre en formato AAAA-MM-DD)
       2. Arriba a la izquierda: Archivo → Compartir → Publicar en la Web.
       3. Elegí la hoja, formato "Valores separados por comas (.csv)" y
          tocá Publicar. Google te da un link — copialo.
       4. Pegá ese link en SHEET_URL, la línea de acá abajo.
       Después de eso: para agregar o borrar un show, editás la Hoja de
       Google desde el celular o donde sea — la página se actualiza sola,
       no hay que tocar código ni subir nada a GitHub nunca más.

     OPCIÓN B — manual: si dejás SHEET_URL vacío (""), se usa el arreglo
       SHOWS de acá abajo. Hay que editarlo a mano y subirlo a GitHub cada
       vez. Las fechas pasadas se ocultan solas en ambas opciones. */

  const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSgzQTUeg_aOMsEgNS_-Gb0IA9ijOm89NFdFE3qZBmIL89nyj959myMcNi1qS_VUV56ch6X5mkdoSp7/pub?output=csv";

  const SHOWS = [
    // { fecha: "2026-09-20", ciudad: "CDMX", sitio: "Nombre del club o evento" },
  ];

  const datesList = document.getElementById("datesList");
  if (datesList) {
    loadShows().then((shows) => renderShows(shows, datesList));
  }

  async function loadShows() {
    if (SHEET_URL) {
      try {
        const res = await fetch(SHEET_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return rowsToObjects(parseCsvRows(await res.text()), ["fecha", "ciudad", "sitio"]);
      } catch (err) {
        console.warn("No se pudo leer el Google Sheet de fechas, uso el arreglo local.", err);
      }
    }
    return SHOWS;
  }

  /* parser CSV genérico: entiende comillas y comas dentro de celdas */
  function parseCsvRows(text) {
    const rows = [];
    let row = [], field = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { field += c; }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.some((v) => v !== "")) rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  /* toma filas crudas de CSV + nombres de columna esperados -> arreglo de objetos */
  function rowsToObjects(rows, columns) {
    const [header, ...body] = rows;
    if (!header) return [];
    const col = (name) => header.findIndex((h) => h.trim().toLowerCase() === name);
    const idx = Object.fromEntries(columns.map((name) => [name, col(name)]));
    return body
      .filter((r) => columns.some((name) => r[idx[name]]))
      .map((r) => Object.fromEntries(columns.map((name) => [name, (r[idx[name]] || "").trim()])));
  }

  function renderShows(shows, el) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dayFmt = new Intl.DateTimeFormat("es-MX", { day: "2-digit" });
    const monthFmt = new Intl.DateTimeFormat("es-MX", { month: "short" });

    const upcoming = shows
      .filter((show) => show.fecha && new Date(`${show.fecha}T00:00:00`) >= today)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    if (!upcoming.length) {
      el.innerHTML = '<li class="shows__empty">Sin fechas confirmadas por el momento — volvé pronto.</li>';
      return;
    }
    el.innerHTML = upcoming
      .map((show) => {
        const d = new Date(`${show.fecha}T00:00:00`);
        const day = dayFmt.format(d);
        const month = monthFmt.format(d).replace(".", "").toUpperCase();
        return `
          <li class="show">
            <span class="show__date"><span class="show__day">${day}</span><span class="show__month">${month}</span></span>
            <span class="show__info"><span class="show__venue">${show.sitio}</span><span class="show__city">${show.ciudad}</span></span>
          </li>
        `;
      })
      .join("");
  }

  /* ---------- videos destacados: misma idea que las fechas ----------
     Hoja de Google con 2 columnas en la primera fila:  titulo | url
     El link puede ser de YouTube, Vimeo o Instagram (post/reel). Se
     muestran TODAS las filas que tengan un link válido, en orden.
     Mismos pasos que en fechas: Archivo → Compartir → Publicar en la
     Web → elegí la pestaña de video → CSV → pegá el link acá. */
  const VIDEO_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSgzQTUeg_aOMsEgNS_-Gb0IA9ijOm89NFdFE3qZBmIL89nyj959myMcNi1qS_VUV56ch6X5mkdoSp7/pub?gid=35220070&single=true&output=csv";

  const videoFeature = document.getElementById("videoFeature");
  if (videoFeature && VIDEO_SHEET_URL) {
    loadVideos().then((videos) => renderVideos(videos, videoFeature));
  }

  async function loadVideos() {
    try {
      const res = await fetch(VIDEO_SHEET_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return rowsToObjects(parseCsvRows(await res.text()), ["titulo", "url"]);
    } catch (err) {
      console.warn("No se pudo leer el Google Sheet de video.", err);
      return [];
    }
  }

  /* YouTube / Vimeo -> iframe directo. Instagram -> embed oficial (necesita su script). */
  function classifyVideo(raw) {
    let u;
    try { u = new URL(raw); } catch (e) { return null; }

    if (u.hostname.includes("youtu.be")) {
      return { type: "iframe", src: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}` };
    }
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v") || u.pathname.split("/embed/")[1] || u.pathname.split("/shorts/")[1];
      return id ? { type: "iframe", src: `https://www.youtube-nocookie.com/embed/${id.split("?")[0].split("/")[0]}` } : null;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? { type: "iframe", src: `https://player.vimeo.com/video/${id}` } : null;
    }
    if (u.hostname.includes("instagram.com")) {
      return { type: "instagram", permalink: `${u.origin}${u.pathname}` };
    }
    return null;
  }

  function renderVideos(videos, el) {
    const items = videos
      .map((v) => ({ ...v, kind: v.url ? classifyVideo(v.url) : null }))
      .filter((v) => v.kind);

    if (!items.length) return; // deja el placeholder [EDITAR] que ya está en el HTML

    el.innerHTML = items
      .map((v) => {
        const caption = v.titulo ? `<p class="sound-video__caption">${v.titulo}</p>` : "";
        if (v.kind.type === "iframe") {
          return `
            <div class="video-card">
              <div class="player-frame">
                <iframe src="${v.kind.src}" title="${v.titulo || "Video destacado"}" width="100%" height="360"
                  frameborder="0" allow="autoplay; fullscreen; picture-in-picture" loading="lazy" allowfullscreen></iframe>
              </div>
              ${caption}
            </div>
          `;
        }
        return `
          <div class="video-card video-card--ig">
            <blockquote class="instagram-media" data-instgrm-permalink="${v.kind.permalink}" data-instgrm-version="14">
              <a href="${v.kind.permalink}" target="_blank" rel="noopener noreferrer">Ver en Instagram</a>
            </blockquote>
          </div>
        `;
      })
      .join("");

    if (items.some((v) => v.kind.type === "instagram")) {
      if (window.instgrm) {
        window.instgrm.Embeds.process();
      } else {
        const s = document.createElement("script");
        s.async = true;
        s.src = "https://www.instagram.com/embed.js";
        document.body.appendChild(s);
      }
    }
  }

  /* ---------- mobile index toggle ---------- */
  const toggle = document.getElementById("navToggle");
  const index = document.getElementById("navIndex");

  if (toggle && index) {
    toggle.addEventListener("click", () => {
      const open = index.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    index.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        index.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- scroll-spy on the índice ---------- */
  const navLinks = document.querySelectorAll(".nav__index a");
  const sections = [...navLinks]
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          navLinks.forEach((link) => {
            link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
          });
        });
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );
    sections.forEach((section) => spy.observe(section));
  }

  /* ---------- reveal each "sheet" as it enters view ---------- */
  const sheets = document.querySelectorAll(".sheet");
  if (sheets.length && "IntersectionObserver" in window) {
    const reveal = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.15 }
    );
    sheets.forEach((sheet) => reveal.observe(sheet));
  } else {
    sheets.forEach((sheet) => sheet.classList.add("in-view"));
  }
})();
