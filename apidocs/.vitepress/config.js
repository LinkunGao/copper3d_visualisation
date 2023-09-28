// docs/.vitepress/config.js
import apidocConfig from "../apidocConfig.json";

export default {
  title: "Copper3d API",
  themeConfig: {
    sidebar: {
      "/dist/": apidocConfig,
    },
  },
};
