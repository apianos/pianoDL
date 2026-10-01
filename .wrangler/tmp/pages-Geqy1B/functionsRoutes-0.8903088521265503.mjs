import { onRequest as __share_achievement_list__slug__js_onRequest } from "/Users/advikrai/pianoDL/functions/share/achievement-list/[slug].js"
import { onRequest as __achievement_list__slug__js_onRequest } from "/Users/advikrai/pianoDL/functions/achievement-list/[slug].js"

export const routes = [
    {
      routePath: "/share/achievement-list/:slug",
      mountPath: "/share/achievement-list",
      method: "",
      middlewares: [],
      modules: [__share_achievement_list__slug__js_onRequest],
    },
  {
      routePath: "/achievement-list/:slug",
      mountPath: "/achievement-list",
      method: "",
      middlewares: [],
      modules: [__achievement_list__slug__js_onRequest],
    },
  ]