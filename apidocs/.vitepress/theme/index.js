import DefaultTheme from "vitepress/theme";
import CopperHero from "./CopperHero.vue";

// Only the landing pages use CopperHero; everything else keeps the stock theme.
export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("CopperHero", CopperHero);
  },
};
