import { useEffect } from "react";

const DEFAULT_TITLE = "Snowpine - Nordic goods, delivered in India";
const DEFAULT_DESCRIPTION =
  "Curated Nordic baby gear, home design, and skincare from Sweden, Finland, Denmark, and Norway - authentic, duty and GST included, shipped across India.";

// A client-side route change doesn't get a fresh <head> the way separate
// server-rendered pages would - without this, every page (and every
// product) would carry the same generic tab title/meta description as
// the homepage, in the browser tab, in search results, and in social
// share previews. Falls back to the site default when a page doesn't
// pass one (or hasn't loaded its data yet), so navigating back to a page
// that omits a title doesn't leave the *previous* page's title behind.
export default function usePageMeta({ title, description } = {}) {
  useEffect(() => {
    document.title = title ? `${title} - Snowpine` : DEFAULT_TITLE;

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description || DEFAULT_DESCRIPTION);
  }, [title, description]);
}
