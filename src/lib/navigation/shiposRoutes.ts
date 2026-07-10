export type ShipOSTab = 'today' | 'tasks' | 'focus' | 'review' | 'insights' | 'settings';

export const TAB_TO_PATH: Record<ShipOSTab, string> = {
  today: '/today',
  tasks: '/tasks',
  focus: '/focus',
  review: '/review',
  insights: '/insights',
  settings: '/settings',
};

export const PATH_TO_TAB: Record<string, ShipOSTab> = {
  '/today': 'today',
  '/tasks': 'tasks',
  '/focus': 'focus',
  '/review': 'review',
  '/insights': 'insights',
  '/settings': 'settings',
};

export function getTabFromPathname(pathname: string | null | undefined): ShipOSTab | undefined {
  if (!pathname) return undefined;
  return PATH_TO_TAB[pathname];
}

export function getPathForTab(tab: ShipOSTab): string {
  return TAB_TO_PATH[tab];
}

export const ALL_TABS: ShipOSTab[] = ['today', 'tasks', 'focus', 'review', 'insights', 'settings'];
