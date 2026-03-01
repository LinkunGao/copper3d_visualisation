// docs/.vitepress/config.js
import apidocConfig from "../apidocConfig.json";

export default {
  ignoreDeadLinks: true,
  title: "Copper3d API",
  base: "/copper3d_visualisation/",
  locales: {
    root: {
      label: 'English',
      lang: 'en',
    },
    zh: {
      label: '简体中文',
      lang: 'zh',
      link: '/zh/',
      themeConfig: {
        nav: [
          { text: "指南", link: "/zh/guide/nrrd-tools" },
          { text: "API", link: "/apidist/modules" },
        ],
        sidebar: {
          "/zh/guide/": [
            {
              text: "使用指南",
              items: [
                { text: "NrrdTools 使用指南", link: "/zh/guide/nrrd-tools" },
              ],
            },
            {
              text: "架构",
              items: [
                { text: "分割模块", link: "/zh/guide/segmentation-module" },
              ],
            },
          ],
          "/apidist/": apidocConfig,
        },
      },
    },
  },
  themeConfig: {
    repo: "LinkunGao/copper3d_visualisation",
    nav: [
      { text: "Guide", link: "/guide/nrrd-tools" },
      { text: "API", link: "/apidist/modules" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Usage Guide",
          items: [
            { text: "NrrdTools Usage Guide", link: "/guide/nrrd-tools" },
          ],
        },
        {
          text: "Architecture",
          items: [
            { text: "Segmentation Module", link: "/guide/segmentation-module" },
          ],
        },
      ],
      "/apidist/": apidocConfig,
    },
    search: {
      provider: "algolia",
      options: {
        appId: "T4ABFE0UY4",
        apiKey: "10d8841459f0b508e1394464b203cb63",
        indexName: "copper3d-visualisation",
        locales: {
          zh: {
            placeholder: "搜索文档",
            translations: {
              button: {
                buttonText: "搜索文档",
                buttonAriaLabel: "搜索文档",
              },
              modal: {
                searchBox: {
                  resetButtonTitle: "清除查询条件",
                  resetButtonAriaLabel: "清除查询条件",
                  cancelButtonText: "取消",
                  cancelButtonAriaLabel: "取消",
                },
                startScreen: {
                  recentSearchesTitle: "搜索历史",
                  noRecentSearchesText: "没有搜索历史",
                  saveRecentSearchButtonTitle: "保存至搜索历史",
                  removeRecentSearchButtonTitle: "从搜索历史中移除",
                  favoriteSearchesTitle: "收藏",
                  removeFavoriteSearchButtonTitle: "从收藏中移除",
                },
                errorScreen: {
                  titleText: "无法获取结果",
                  helpText: "你可能需要检查你的网络连接",
                },
                footer: {
                  selectText: "选择",
                  navigateText: "切换",
                  closeText: "关闭",
                  searchByText: "搜索提供者",
                },
                noResultsScreen: {
                  noResultsText: "无法找到相关结果",
                  suggestedQueryText: "你可以尝试查询",
                  reportMissingResultsText: "你认为该查询应该有结果？",
                  reportMissingResultsLinkText: "点击反馈",
                },
              },
            },
          },
        },
      },
    },
  },
};
