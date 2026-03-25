export const isMac = navigator.platform.toUpperCase().includes('MAC');

export interface ShortcutItem {
  description: string;
  keys: string[];
}

export interface ShortcutCategory {
  category: string;
  items: ShortcutItem[];
}

const modKey = isMac ? 'Cmd' : 'Ctrl';

export const shortcuts: ShortcutCategory[] = [
  {
    category: 'Navigation',
    items: [
      { description: 'Search resources', keys: [modKey, 'K'] },
      ...(isMac
        ? [
            { description: 'Go back', keys: ['Cmd', '['] },
            { description: 'Go forward', keys: ['Cmd', ']'] },
          ]
        : []),
      { description: 'Open shortcuts', keys: [modKey, '/'] },
    ],
  },
  {
    category: 'Editor',
    items: [
      { description: 'Open slash menu', keys: ['/'] },
      { description: 'Open link picker', keys: ['[', '['] },
      { description: 'Navigate menus', keys: ['Up', 'Down'] },
      { description: 'Confirm selection', keys: ['Enter'] },
      { description: 'Close active modal/menu', keys: ['Esc'] },
    ],
  },
];
