const GMRPTeam = {
  escape(value){
    return String(value??"")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;");
  },

  async load(){
    const target=document.querySelector("#teamDepartments");
    if(!target)return;

    try{
      const response=await fetch("/api/team/public",{cache:"no-store"});
      const data=await response.json();

      if(!response.ok)throw new Error(data.error||"Chargement impossible.");

      const groups=new Map();

      for(const member of data.members||[]){
        if(!groups.has(member.department))groups.set(member.department,[]);
        groups.get(member.department).push(member);
      }

      if(!groups.size){
        target.innerHTML='<div class="team-empty">L’équipe sera présentée ici prochainement.</div>';
        return;
      }

      target.innerHTML=[...groups.entries()].map(([department,members])=>`
        <section class="team-department">
          <div class="team-department-heading">
            <p class="eyebrow">${this.escape(department)}</p>
            <h2>${this.escape(department)}</h2>
          </div>

          <div class="team-grid">
            ${members.map(member=>this.card(member)).join("")}
          </div>
        </section>
      `).join("");
    }catch(error){
      console.error(error);
      target.innerHTML='<div class="team-empty">L’équipe est temporairement indisponible.</div>';
    }
  },

  card(member){
    const e=this.escape.bind(this);

    return `<article class="team-card ${member.featured?"featured":""}">
      <div class="team-photo">
        ${member.imageUrl
          ? `<img src="${e(member.imageUrl)}" alt="${e(member.displayName)}">`
          : `<div class="team-initial">${e(member.displayName.charAt(0).toUpperCase())}</div>`
        }
      </div>

      <div class="team-card-body">
        <p>${e(member.roleTitle)}</p>
        <h3>${e(member.displayName)}</h3>
        ${member.description?`<span>${e(member.description)}</span>`:""}

        <div class="team-card-links">
          ${member.discordName?`<small>Discord · ${e(member.discordName)}</small>`:""}
          ${member.socialUrl?`<a href="${e(member.socialUrl)}" target="_blank" rel="noopener">Profil ↗</a>`:""}
        </div>
      </div>
    </article>`;
  }
};

GMRPTeam.load();
