(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CCDevtoolsPanelViews = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const WORKBENCH_TABS = [
    { id: 'chat', label: 'Chat' },
    { id: 'evidence', label: 'Evidence' },
    { id: 'recorder', label: 'Recorder' },
    { id: 'visual', label: 'Visual' },
    { id: 'patch', label: 'Patch' },
    { id: 'tests', label: 'Tests' },
    { id: 'trust', label: 'Trust' },
    { id: 'recipes', label: 'Recipes' },
  ];

  function getWorkbenchTabs() {
    return WORKBENCH_TABS.map((tab) => ({ ...tab }));
  }

  function isWorkbenchTab(tabId) {
    return WORKBENCH_TABS.some((tab) => tab.id === tabId);
  }

  return {
    WORKBENCH_TABS,
    getWorkbenchTabs,
    isWorkbenchTab,
  };
});
