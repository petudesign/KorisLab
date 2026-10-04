const root = document.getElementById("root")!;
const isStudioRoute = window.location.pathname === "/studio" || window.location.pathname.startsWith("/studio/");

if (isStudioRoute) {
  void import("./studio-main").then(({ mountSanityStudio }) => mountSanityStudio(root));
} else {
  void import("./app-main").then(({ mountApp }) => mountApp(root));
}
