const shopTabs = [...document.querySelectorAll(".shop-tab")];
const shopSections = [...document.querySelectorAll(".shop-section")];

shopTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.target;

    shopTabs.forEach((item) => {
      item.classList.toggle("active", item === tab);
    });

    shopSections.forEach((section) => {
      section.classList.toggle("active", section.id === target);
    });

    const visibleSection = document.querySelector(`#${target}`);
    if (visibleSection) {
      visibleSection.querySelectorAll(".reveal").forEach((element) => {
        element.classList.add("visible");
      });
    }

    window.history.replaceState(null, "", `#${target}`);
  });
});

const requestedTab = window.location.hash.replace("#", "");
if (requestedTab === "vip" || requestedTab === "imports") {
  const tab = document.querySelector(`[data-target="${requestedTab}"]`);
  if (tab) tab.click();
}
