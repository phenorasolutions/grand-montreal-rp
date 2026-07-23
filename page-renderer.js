window.GMRPPageRenderer = {
  async load(slug, targetSelector) {
    const target = document.querySelector(targetSelector);
    if (!target) return;

    try {
      const response = await fetch(`/api/pages/public?slug=${encodeURIComponent(slug)}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Page indisponible.");

      const page = data.page;
      document.title = page.seoTitle || page.title;

      const description = document.querySelector('meta[name="description"]');
      if (description && page.seoDescription) {
        description.setAttribute("content", page.seoDescription);
      }

      target.innerHTML = this.render(page);
    } catch (error) {
      console.error(error);
    }
  },

  escape(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },

  render(page) {
    const e = this.escape.bind(this);

    const hero = `
      <section class="cms-public-hero"
        ${page.heroImage ? `style="background-image:linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.6)),url('${e(page.heroImage)}')"` : ""}>
        <div>
          ${page.heroKicker ? `<p>${e(page.heroKicker)}</p>` : ""}
          <h1>${e(page.heroTitle || page.title)}</h1>
          ${page.heroSubtitle ? `<span>${e(page.heroSubtitle)}</span>` : ""}
        </div>
      </section>
    `;

    const blocks = (page.blocks || []).map((block) => {
      if (block.type === "heading") {
        return `<h${block.level}>${e(block.text)}</h${block.level}>`;
      }

      if (block.type === "paragraph") {
        return `<p>${e(block.text)}</p>`;
      }

      if (block.type === "quote") {
        return `<blockquote>${e(block.text)}</blockquote>`;
      }

      if (block.type === "list") {
        const tag = block.ordered ? "ol" : "ul";
        return `<${tag}>${(block.items || []).map((item) => `<li>${e(item)}</li>`).join("")}</${tag}>`;
      }

      if (block.type === "image") {
        return `
          <figure>
            <img src="${e(block.url)}" alt="${e(block.alt)}">
            ${block.caption ? `<figcaption>${e(block.caption)}</figcaption>` : ""}
          </figure>
        `;
      }

      if (block.type === "button") {
        return `<p><a class="button ${block.style === "secondary" ? "button-secondary" : "button-primary"}"
          href="${e(block.url)}">${e(block.label)}</a></p>`;
      }

      if (block.type === "divider") {
        return "<hr>";
      }

      return "";
    }).join("");

    return `${hero}<section class="cms-public-content">${blocks}</section>`;
  }
};
