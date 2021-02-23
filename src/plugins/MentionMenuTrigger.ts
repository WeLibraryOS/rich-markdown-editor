import { Plugin, PluginKey } from "prosemirror-state";
import { InputRule } from "prosemirror-inputrules";
import { Decoration, DecorationSet } from "prosemirror-view";
import { findParentNode } from "prosemirror-utils";
import Extension from "../lib/Extension";
const allowSpaceInQuery = true;
const escapedTriggerChar = "@";

const MAX_MATCH = 50;

const OPEN_REGEX = new RegExp(
  `(?:^|\\s)(${escapedTriggerChar}([^${
    allowSpaceInQuery ? "" : "\\s"
  }${escapedTriggerChar}]*))$`
);

export function triggerCharacter(char) {
  /**
   * @param {ResolvedPos} $position
   */
  return ($position) => {
    // Matching expressions used for later

    const suffix = new RegExp(`\\s${char}$`);
    const regexp = new RegExp(`${char}.*?(?=\\s${char}|$)`, "g");
    const allowSpaces = true;
    // Lookup the boundaries of the current node
    const textFrom = $position.before();
    const textTo = $position.end();

    const text = $position.doc.textBetween(textFrom, textTo, "\0", "\0");

    let match;

    while ((match = regexp.exec(text))) {
      // Javascript doesn't have lookbehinds; this hacks a check that first character is " " or the line beginning
      const prefix = match.input.slice(
        Math.max(0, match.index - 1),
        match.index
      );
      if (!/^[\s\0]?$/.test(prefix)) {
        continue;
      }

      // The absolute position of the match in the document
      const from = match.index + $position.start();
      let to = from + match[0].length;

      // Edge case handling; if spaces are allowed and we're directly in between two triggers
      if (allowSpaces && suffix.test(text.slice(to - 1, to + 1))) {
        match[0] += " ";
        to++;
      }

      // If the $position is located within the matched substring, return that range
      if (from < $position.pos && to >= $position.pos) {
        return { range: { from, to }, text: match[0] };
      }
    }
  };
}

// based on the input rules code in Prosemirror, here:
// https://github.com/ProseMirror/prosemirror-inputrules/blob/master/src/inputrules.js
function run(view, from, to, regex, handler, ignoreComposing = false) {
  if (view.composing && !ignoreComposing) {
    return false;
  }
  const state = view.state;
  const $from = state.doc.resolve(from);

  if ($from.parent.type.spec.code) {
    return false;
  }

  const textBefore = $from.parent.textBetween(
    Math.max(0, $from.parentOffset - MAX_MATCH),
    $from.parentOffset,
    null,
    "\ufffc"
  );

  const match = regex.exec(textBefore);

  const tr = handler(state, match, match ? from - match[0].length : from, to);
  if (!tr) return false;
  return true;
}

export default class MentionMenuTrigger extends Extension {
  get name() {
    return "mentionsmenu";
  }

  get plugins() {
    return [
      new Plugin({
        key: new PluginKey("mentionsmenu"),
        view() {
          return {
            update: (view, prevState) => {
              const prev = this.key.getState(prevState);
              const next = this.key.getState(view.state);

              // See how the state changed
              const moved =
                prev.active &&
                next.active &&
                prev.range.from !== next.range.from;
              const started = !prev.active && next.active;
              const stopped = prev.active && !next.active;
              const changed = !started && !stopped && prev.text !== next.text;

              // Trigger the hooks when necessary
              // if (stopped || moved) this.options.onExit();
              // if (changed && !moved) this.options.onChange();
              // if (started || moved) this.options.onEnter();
            },
          };
        },

        state: {
          /**
           * Initialize the plugin's internal state.
           *
           * @returns {Object}
           */
          init() {
            return {
              active: false,
              range: {},
              text: null,
            };
          },

          /**
           * Apply changes to the plugin state from a view transaction.
           *
           * @param {Transaction} tr
           * @param {Object} prev
           *
           * @returns {Object}
           */
          apply(tr, prev) {
            const { selection } = tr;
            const next = { ...prev };
            const matcher = triggerCharacter("@");

            // We can only be suggesting if there is no selection
            if (selection.from === selection.to) {
              // Reset active state if we just left the previous suggestion range
              if (
                selection.from < prev.range.from ||
                selection.from > prev.range.to
              ) {
                next.active = false;
              }

              // Try to match against where our cursor currently is
              const $position = selection.$from;
              const match = matcher($position);

              // If we found a match, update the current state to show it
              if (match) {
                next.active = true;
                next.range = match.range;
                next.text = match.text;
              } else {
                next.active = false;
              }
            } else {
              next.active = false;
            }

            // Make sure to empty the range if suggestion is inactive
            if (!next.active) {
              next.range = {};
              next.text = null;
            }

            return next;
          },
        },
        props: {
          handleClick: () => {
            this.options.onClose();
            return false;
          },
          handleDOMEvents: {
            // Prosemirror input rules are not triggered on compositionupdate, this
            // mimics that behavior, fixing a weird bug on some Android phones.
            // setTimeout is necessary here to prevent onOpen from being called with
            // stale input
            compositionupdate: (view, event) => {
              setTimeout(() => {
                const { pos } = view.state.selection.$from;
                return run(
                  view,
                  pos,
                  pos,
                  OPEN_REGEX,
                  (state, match) => {
                    if (match) {
                      this.options.onOpen(match[2]);
                    } else {
                      this.options.onClose();
                    }
                    return null;
                  },
                  true
                );
              });
              return false;
            },
          },
          handleKeyDown: (view, event) => {
            // Prosemirror input rules are not triggered on backspace, however
            // we need them to be evaluted for the filter trigger to work
            // correctly. This additional handler adds inputrules-like handling.
            if (event.key === "Backspace") {
              // timeout ensures that the delete has been handled by prosemirror
              // and any characters removed, before we evaluate the rule.
              setTimeout(() => {
                const { pos } = view.state.selection.$from;
                return run(view, pos, pos, OPEN_REGEX, (state, match) => {
                  if (match) {
                    this.options.onOpen(match[2]);
                  } else {
                    this.options.onClose();
                  }
                  return null;
                });
              });
            }

            // If the query is active and we're navigating the block menu then
            // just ignore the key events in the editor itself until we're done
            if (
              event.key === "Enter" ||
              event.key === "ArrowUp" ||
              event.key === "ArrowDown" ||
              event.key === "Tab"
            ) {
              const { pos } = view.state.selection.$from;

              return run(view, pos, pos, OPEN_REGEX, (state, match) => {
                // just tell Prosemirror we handled it and not to do anything
                return match ? true : null;
              });
            }

            return false;
          },
          decorations: (state) => {
            const parent = findParentNode(
              (node) => node.type.name === "paragraph"
            )(state.selection);

            if (!parent) {
              return;
            }

            const decorations: Decoration[] = [];
            const isEmpty = parent && parent.node.content.size === 0;
            const isSlash = parent && parent.node.textContent === "@";
            const isTopLevel = state.selection.$from.depth === 1;
            const selection = state.selection;
            const resolved = state.doc.resolve(selection.from);

            decorations.push(
              Decoration.node(resolved.before(), resolved.after(), {
                class: "current-element",
              })
            );

            if (isTopLevel) {
              return DecorationSet.create(state.doc, decorations);
            }

            return;
          },
        },
      }),
    ];
  }

  inputRules() {
    return [
      // match
      // @word
      new InputRule(OPEN_REGEX, (state, match) => {
        if (match && state.selection.$from.parent.type.name === "paragraph") {
          this.options.onOpen(match[2]);
        } else {
          this.options.onClose();
        }
        return null;
      }),
    ];
  }
}
