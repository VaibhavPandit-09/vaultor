import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DecorationSet } from '@tiptap/pm/view';

export interface SlashCommandState {
  active: boolean;
  query: string;
  range: { from: number; to: number } | null;
  decorationSet: DecorationSet;
}

const slashCommandPluginKey = new PluginKey('slashCommand');

export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {


    return [
      new Plugin({
        key: slashCommandPluginKey,

        state: {
          init(): SlashCommandState {
            return { active: false, query: '', range: null, decorationSet: DecorationSet.empty };
          },

          apply(tr, prev, _oldState, newState): SlashCommandState {
            const meta = tr.getMeta(slashCommandPluginKey);
            if (meta) return meta;

            if (!prev.active) return prev;

            // Check if the slash is still there
            const { from } = newState.selection;
            const resolved = newState.doc.resolve(from);
            const textBefore = resolved.parent.textContent.slice(0, resolved.parentOffset);
            const slashIndex = textBefore.lastIndexOf('/');

            if (slashIndex === -1) {
              return { active: false, query: '', range: null, decorationSet: DecorationSet.empty };
            }

            const query = textBefore.slice(slashIndex + 1);
            const absoluteFrom = resolved.start() + slashIndex;
            const absoluteTo = resolved.start() + resolved.parentOffset;

            return {
              active: true,
              query,
              range: { from: absoluteFrom, to: absoluteTo },
              decorationSet: DecorationSet.empty,
            };
          },
        },

        props: {
          handleKeyDown(view, event) {
            if (event.key === '/') {
              const { from } = view.state.selection;

              setTimeout(() => {
                const tr = view.state.tr;
                tr.setMeta(slashCommandPluginKey, {
                  active: true,
                  query: '',
                  range: { from, to: from + 1 },
                  decorationSet: DecorationSet.empty,
                });
                view.dispatch(tr);
              }, 0);
            }

            if (event.key === 'Escape') {
              const state = slashCommandPluginKey.getState(view.state) as SlashCommandState;
              if (state?.active) {
                const tr = view.state.tr;
                tr.setMeta(slashCommandPluginKey, {
                  active: false,
                  query: '',
                  range: null,
                  decorationSet: DecorationSet.empty,
                });
                view.dispatch(tr);
                return true;
              }
            }

            return false;
          },
        },
      }),
    ];
  },
});

export { slashCommandPluginKey };
