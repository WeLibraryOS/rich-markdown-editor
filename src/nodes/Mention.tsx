import * as React from "react";
import Node from "./Node";

export default class Mention extends Node {
  get name() {
    return "mention";
  }

  get schema() {
    return {
      group: "inline",
      inline:true,
      selectable:true,
      atom: true,
      attrs: {
        id:"",
        display:"",
      },
      parseDOM: [{ tag: "span[data-mention-id][data-mention-display]" }],
      toDOM: node => [
        "span",
        { class:'mention-input-node', src: node.attrs.id, contentEditable: false },
        "@" + node.attrs.display,
      ],
    };
  }

  commands({ type }) {
    return attrs => (state, dispatch) => {
      // What this does: replace the current triggered mention input
      // with the mention node/or component
      // This logic shouldn't be in here but rather a separate plugin
      // such as the mentionMenuTrigger plugin, but is here for now
      // to get it to work. Curious why prosemirror plugin assigns
      // a seemingly random number to the plugin key
      // Also looked in the docs, but it wasn't clear how to access
      // a plugin's state...
      const mentionsMenuPlugin = Object.keys(state).filter(key => key.includes('mentionsmenu$'))[0];
      const stateMentionsPluginState = state[mentionsMenuPlugin];
      if(stateMentionsPluginState.active){
        const startPos =stateMentionsPluginState.range.from;
        const endPos = stateMentionsPluginState.range.to;
        const node = type.create(attrs);
        // transforms transactions
        let trx = state.tr;
        trx = trx.replaceWith(startPos, endPos,type.create(attrs));
        trx = trx.insertText('\u00a0');
        // Replace the suggestion trigger text with the mention text
        dispatch(trx);
      }
      return true;
    };
  }

  toMarkdown(state, node) {
    state.write(
      "[" + state.esc(`@${node.attrs.display}`) + "](" + state.esc(`wl:userMention:${node.attrs.id}`) + ")"
    );
  }

  parseMarkdown() {
    return {
      node: "mention",
      getAttrs: token => ({
        id: token.attrGet("id"),
        matches: token.attrGet("matches"),
        component: token.attrGet("component"),
      }),
    };
  }
}
