import { Suspense, useRef } from 'react';
import { useUIStore } from '../../store/ui-store';
import { useCardStore } from '../../store/card-store';
import { useEditorTabs, useAvailableTabIds } from '../../lib/registry/hooks';
import { EditorTabs } from './components/EditorTabs';
import { useAutoSnapshot } from '../../hooks/useAutoSnapshot';
import type { TabContext } from '../../lib/registry/types';

interface CardEditorProps {
  context?: TabContext;
}

/**
 * Determine tab context from card spec
 */
function getTabContext(spec?: string): TabContext {
  if (spec === 'lorebook') return 'lorebook';
  if (spec === 'collection') return 'collection';
  return 'card';
}

/**
 * Loading spinner for lazy-loaded tab components
 */
function TabLoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  );
}

// Tabs that should stay mounted (persistent) to preserve state like iframes
const PERSISTENT_TABS = ['comfyui'];

export function CardEditor({ context: contextProp }: CardEditorProps) {
  const activeTab = useUIStore((state) => state.activeTab);
  const currentCard = useCardStore((state) => state.currentCard);

  // Auto-detect context from card spec if not provided
  const context = contextProp ?? getTabContext(currentCard?.meta?.spec);

  const tabs = useEditorTabs(context);
  const availableTabIds = useAvailableTabIds(context);
  // Track which persistent tabs have been visited
  const visitedPersistentTabs = useRef<Set<string>>(new Set());

  // Enable auto-snapshot functionality
  useAutoSnapshot();

  // Find the effective active tab (fallback to first if current is not available)
  const effectiveActiveTab = availableTabIds.includes(activeTab)
    ? activeTab
    : availableTabIds[0] ?? 'edit';

  // Track visited persistent tabs
  if (PERSISTENT_TABS.includes(effectiveActiveTab)) {
    visitedPersistentTabs.current.add(effectiveActiveTab);
  }

  // Find the current tab definition (for non-persistent tabs)
  const currentTabDef = tabs.find((tab) => tab.id === effectiveActiveTab);
  const isPersistentTab = PERSISTENT_TABS.includes(effectiveActiveTab);

  // Get persistent tabs that should be rendered
  const persistentTabDefs = tabs.filter(
    (tab) => PERSISTENT_TABS.includes(tab.id) && visitedPersistentTabs.current.has(tab.id)
  );

  return (
    <div className="h-full flex flex-col">
      <EditorTabs context={context} />

      <div className="flex-1 overflow-auto relative">
        {/* Render persistent tabs - always mounted once visited, hidden when not active */}
        {persistentTabDefs.map((tabDef) => (
          <div
            key={tabDef.id}
            className="absolute inset-0"
            style={{ display: effectiveActiveTab === tabDef.id ? 'block' : 'none' }}
          >
            <Suspense fallback={<TabLoadingSpinner />}>
              <tabDef.component />
            </Suspense>
          </div>
        ))}

        {/* Render non-persistent tabs normally */}
        {!isPersistentTab && currentTabDef && (
          <Suspense fallback={<TabLoadingSpinner />}>
            <currentTabDef.component />
          </Suspense>
        )}
      </div>
    </div>
  );
}
