import React, { useEffect, useState } from 'react';
import capitalize from "lodash/capitalize";
import { Portal } from "react-portal";
import { EditorView } from "prosemirror-view";
import { findParentNode } from "prosemirror-utils";
import styled from "styled-components";
import { EmbedDescriptor, MenuItem, ToastType } from "../types";
import BlockMenuItem from "./BlockMenuItem";
import Input from "./Input";
import baseDictionary from "../dictionary";
import {CustomSuggestion} from './CustomSuggestionRow';
const SSR = typeof window === "undefined";

type Props = {
  isActive: boolean;
  commands: Record<string, any>;
  dictionary: typeof baseDictionary;
  view: EditorView;
  search: string;
  userList?: Array<any>;
  uploadImage?: (file: File) => Promise<string>;
  onImageUploadStart?: () => void;
  onImageUploadStop?: () => void;
  onShowToast?: (message: string, id: string) => void;
  onLinkToolbarOpen: () => void;
  onClose: () => void;
  participants: Array<any>;
  mentionsLoading?: boolean;
  embeds: EmbedDescriptor[];
};

type State = {
  insertItem?: EmbedDescriptor;
  left?: number;
  top?: number;
  bottom?: number;
  isAbove: boolean;
  selectedIndex: number;
  showMenu?: boolean;
  searchResults?: Array<any>;
};


const MentionsMenuContainer= props => {
  const {participants} = props;
 

  return <MentionsMenu {...props}  userList={participants} />
}
class MentionsMenu extends React.Component<Props, State> {
  menuRef = React.createRef<HTMLDivElement>();
  inputRef = React.createRef<HTMLInputElement>();

  state: State = {
    left: -1000,
    top: undefined,
    bottom: undefined,
    isAbove: false,
    selectedIndex: 0,
    insertItem: undefined,
    showMenu: false,
  };

  componentDidMount() {
    if (!SSR) {
      window.addEventListener("keydown", this.handleKeyDown);
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return (
      nextProps.userList ||
      nextProps.isActive !== this.props.isActive ||
      nextState !== this.state
    );
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.isActive && this.props.isActive) {
      const position = this.calculatePosition(this.props);
      this.setState({
        insertItem: undefined,
        selectedIndex: 0,
        ...position,
      });
    } else if (prevProps.search !== this.props.search) {
      this.setState({ selectedIndex: 0 });
    }
  }

  componentWillUnmount() {
    if (!SSR) {
      window.removeEventListener("keydown", this.handleKeyDown);
    }
  }

  handleKeyDown = (event: KeyboardEvent) => {
    const { userList } = this.props;
    if (!this.props.isActive) return;

    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();

      const item = userList && userList[this.state.selectedIndex];

      if (item) {
        this.insertItem(item);
      } else {
        this.props.onClose();
      }
    }

    if (event.key === "ArrowUp" || (event.ctrlKey && event.key === "p")) {
      event.preventDefault();
      event.stopPropagation();

      if (userList?.length) {
        const prevIndex = this.state.selectedIndex - 1;
        const prev = userList && userList[prevIndex];

        this.setState({
          selectedIndex: Math.max(
            0,
            prev && prev.name === "separator" ? prevIndex - 1 : prevIndex
          ),
        });
      } else {
        this.close();
      }
    }

    if (
      event.key === "ArrowDown" ||
      event.key === "Tab" ||
      (event.ctrlKey && event.key === "n")
    ) {
      event.preventDefault();
      event.stopPropagation();
    
      if (userList?.length) {
        const total = userList?.length - 1;
        const nextIndex = this.state.selectedIndex + 1;
        const next = userList[nextIndex];

        this.setState({
          selectedIndex: Math.min(
            next && next.name === "separator" ? nextIndex + 1 : nextIndex,
            total
          ),
        });
      } else {
        this.close();
      }
    }

    if (event.key === "Escape") {
      this.close();
    }
  };

  insertItem = item => {
    switch (item.name) {
      default:
        this.insertBlock(item);
    }
  };

  close = () => {
    this.props.onClose();
    this.props.view.focus();
  };

  handleLinkInputKeydown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!this.props.isActive) return;
    if (!this.state.insertItem) return;

    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();

      const href = event.currentTarget.value;
      const matches = this.state.insertItem.matcher(href);

      if (!matches && this.props.onShowToast) {
        this.props.onShowToast(
          this.props.dictionary.embedInvalidLink,
          ToastType.Error
        );
        return;
      }

      this.insertBlock({
        name: "embed",
        attrs: {
          href,
          component: this.state.insertItem.component,
          matches,
        },
      });
    }

    if (event.key === "Escape") {
      this.props.onClose();
      this.props.view.focus();
    }
  };

  handleLinkInputPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    if (!this.props.isActive) return;
    if (!this.state.insertItem) return;

    const href = event.clipboardData.getData("text/plain");
    const matches = this.state.insertItem.matcher(href);

    if (matches) {
      event.preventDefault();
      event.stopPropagation();

      this.insertBlock({
        name: "embed",
        attrs: {
          href,
          component: this.state.insertItem.component,
          matches,
        },
      });
    }
  };

  triggerImagePick = () => {
    if (this.inputRef.current) {
      this.inputRef.current.click();
    }
  };

  triggerLinkInput = item => {
    this.setState({ insertItem: item });
  };

  clearSearch() {
    const { state, dispatch } = this.props.view;
    const parent = findParentNode(node => !!node)(state.selection);
  }

  insertBlock(item) {
    const _tempItem = {
      name:'mention',
      attrs:{
        id: item.id,
        display: item.display,
      }
    }
    const command = this.props.commands[_tempItem.name];
    if (command) {
      command(_tempItem.attrs);
    } else {
      this.props.commands[`create${capitalize(item.name)}`](item.attrs);
    }
    this.clearSearch();
    this.props.onClose();
  }

  calculatePosition(props) {
    const { view } = props;
    const { selection } = view.state;
    const startPos = view.coordsAtPos(selection.$from.pos);
    const ref = this.menuRef.current;
    const offsetHeight = ref ? ref.offsetHeight : 0;
    const paragraph = view.domAtPos(selection.$from.pos);
 
    if (
      !props.isActive ||
      !paragraph.node ||
      !paragraph.node.getBoundingClientRect ||
      SSR
    ) {
      return {
        left: -1000,
        top: 0,
        bottom: undefined,
        isAbove: false,
      };
    }

    const margin = 24;

    if(window?.innerWidth < 479){
      const parentNode = paragraph.node.parentElement;
      const { top, left, bottom } = parentNode.getBoundingClientRect();
      const topOffset = 10;
      return {
        left: 0,
        top: undefined,
        bottom: window.innerHeight - top + topOffset,
        isAbove: true,
      };
    } 

    const { top, left, bottom } = paragraph.node.getBoundingClientRect();
    if (startPos.top - offsetHeight > margin) {
      return {
        left: startPos.left + window.scrollX,
        top: undefined,
        bottom: window.innerHeight - top - window.scrollY,
        isAbove: false,
      };
    } else {
      return {
        left: startPos.left + window.scrollX,
        top: bottom + window.scrollY,
        bottom: undefined,
        isAbove: true,
      };
    }
  }



  render() {
    const { dictionary, isActive, uploadImage, userList } = this.props;
    const {selectedIndex} = this.state;
    const renderUserList = userList?.map((user,index) => {
      const isSelected = index == selectedIndex;
      return <CustomSuggestion isSelected={isSelected} key={user.id} onClick={() => this.insertItem(user)} entry={user} />
    })
    const { insertItem, ...positioning } = this.state;
    const isMobileWidth = window?.innerWidth < 479;
    return (
      <Portal>
        <Wrapper
          id="block-menu-container"
          active={isActive}
          isMobileWidth={isMobileWidth}
          ref={this.menuRef}
          {...positioning}
        >
          {renderUserList}
        </Wrapper>
      </Portal>
    );
  }
}

const LinkInputWrapper = styled.div`
  margin: 8px;
`;

const LinkInput = styled(Input)`
  height: 36px;
  width: 100%;
  color: ${props => props.theme.blockToolbarText};
`;

const List = styled.ol`
  list-style: none;
  text-align: left;
  height: 100%;
  padding: 8px 0;
  margin: 0;
`;

const ListItem = styled.li`
  padding: 0;
  margin: 0;
`;

const Empty = styled.div`
  display: flex;
  align-items: center;
  color: ${props => props.theme.textSecondary};
  font-weight: 500;
  font-size: 14px;
  height: 36px;
  padding: 0 16px;
`;

export const Wrapper = styled.div<{
  active: boolean;
  top?: number;
  bottom?: number;
  left?: number;
  isMobileWidth?:boolean;
  isAbove: boolean;
}>`
  color: ${props => props.theme.text};
  font-family: ${props => props.theme.fontFamily};
  position: absolute;
  z-index: ${props => {
    return props.theme.zIndex + 100;
  }};
  ${props => props.top && `top: ${props.top}px`};
  ${props => props.bottom && `bottom: ${props.bottom}px`};
  left: ${props => props.left}px;
  background-color: ${props => props.theme.blockToolbarBackground};
  border-radius: 4px;
  box-shadow: rgba(0, 0, 0, 0.05) 0px 0px 0px 1px,
    rgba(0, 0, 0, 0) 0px 4px 8px, rgba(0, 0, 0, 0.08) 0px 2px 4px;
  opacity: 0;
  transform: scale(0.95);
  transition: opacity 150ms cubic-bezier(0.175, 0.885, 0.32, 1.275),
    transform 150ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
  transition-delay: 150ms;
  line-height: 0;
  box-sizing: border-box;
  pointer-events: none;
  white-space: nowrap;
  width: ${props => props.isMobileWidth ? `100%` : `300px`};
  max-height: 160px;
  overflow: hidden;
  overflow-y: auto;

  * {
    box-sizing: border-box;
  }

  hr {
    border: 0;
    height: 0;
    border-top: 1px solid ${props => props.theme.blockToolbarDivider};
  }

  ${({ active, isAbove }) =>
    active &&
    `
    transform: translateY(${isAbove ? "6px" : "-6px"}) scale(1);
    pointer-events: all;
    opacity: 1;
  `};

  @media print {
    display: none;
  }
`;

export default MentionsMenuContainer;
