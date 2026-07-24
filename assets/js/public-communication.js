const GMRPCommunication = {
  escape(value) {
    return String(value ?? "")
      .replaceAll("&","&amp;").replaceAll("<","&lt;")
      .replaceAll(">","&gt;").replaceAll('"',"&quot;");
  },

  formatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("fr-CA", {
      dateStyle: "long",
      timeZone: "America/Toronto"
    }).format(new Date(value.replace(" ","T")+"Z"));
  },

  async fetchPosts(params = "") {
    const response = await fetch(`/api/communication/public${params}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Chargement impossible.");
    return data.posts || [];
  },

  renderCard(post) {
    const e=this.escape.bind(this);
    return `<article class="news-card">
      ${post.imageUrl?`<img src="${e(post.imageUrl)}" alt="">`:"<div class='news-card-placeholder'></div>"}
      <div class="news-card-body">
        <p>${e(post.category||post.type)}</p>
        <h2>${e(post.title)}</h2>
        <span>${e(post.summary)}</span>
        <small>${e(this.formatDate(post.publishedAt||post.createdAt))}</small>
      </div>
    </article>`;
  },

  async mountList(selector, params = "?type=news") {
    const target=document.querySelector(selector);
    if(!target)return;
    try{
      const posts=await this.fetchPosts(params);
      target.innerHTML=posts.length?posts.map(p=>this.renderCard(p)).join(""):'<div class="news-empty">Aucune publication pour le moment.</div>';
    }catch(err){
      console.error(err);
      target.innerHTML='<div class="news-empty">Les actualités sont temporairement indisponibles.</div>';
    }
  },

  async mountBanner() {
    try{
      const r=await fetch("/api/communication/banner",{cache:"no-store"});
      const d=await r.json();
      if(!d.banner)return;
      const b=d.banner,e=this.escape.bind(this);
      const el=document.createElement("aside");
      el.className=`global-banner banner-${b.bannerLevel}`;
      el.innerHTML=`<strong>${e(b.title)}</strong><span>${e(b.summary)}</span><button aria-label="Fermer">×</button>`;
      el.querySelector("button").onclick=()=>el.remove();
      document.body.prepend(el);
    }catch(err){console.error(err);}
  }
};

GMRPCommunication.mountBanner();
