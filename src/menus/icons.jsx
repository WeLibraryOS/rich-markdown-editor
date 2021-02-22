import React, { useState, useEffect } from 'react';
import OutsideClickHandler from 'react-outside-click-handler';
import { constant } from 'lodash';




const MenuButton = ({ command, title, isEnabled, isActive, label, hideLabel, className }) => {
    let baseClassname = className || 'button-reset editor-menubar-button';
    if (isEnabled === false) {
        baseClassname = `${baseClassname} is-disabled`;
    }

    if (isActive) {
        baseClassname = `${baseClassname} is-active`;
    }
    const buttonText = !hideLabel ? label : null;
    return (
        <button
            type="button"
            className={baseClassname}
            title={title}
            disabled={isEnabled === false}
            onMouseDown={event => {
                event.preventDefault();
                command();
            }}
        >
            {buttonText}
        </button>
    );
};

export default MenuButton;

export const BoldIcon = props => {
    return <div className="wysiwyg-menu-bar option-bold" />;
};

export const StrikeThroughIcon = props => {
    return <div className="wysiwyg-menu-bar option-strike" />;
};

export const HeadingsIcon = props => {
    return <div className="wysiwyg-menu-bar option-heading" />;
};

export const HeadingsDropdown = ({
    className,
    setActiveHeading,
    isBlockActive,
    nodes,
    isEnabled=true,
}) => {
    handleSelect = level => {
        // setActiveHeading(level);
    };

    let baseClassname = className || 'button-reset editor-menubar-button';
    if (isEnabled === false) {
        baseClassname = `${baseClassname} is-disabled`;
    }

    const [show, setShow] = useState(false);
    const headings = [1, 2, 3, 4];
    const headingOptions = headings.map(level => {
        // const isEnabled = !isBlockActive(nodes.heading, { level });
        return (
            <MenuButton
                key={`h${level}`}
                isEnabled
                value={level}
                title={`Heading ${level}`}
                label={`H${level}`}
                command={() => handleSelect(level)}
            />
        );
    });

    handleShow = e => {
        setShow(!show);
    };

    return (
        <button
            type="button"
            className="menu-icon option-heading"
            onMouseDown={event => {
                event.preventDefault();
                handleShow(event);
            }}
        >
            {show && (
                <OutsideClickHandler onOutsideClick={() => setShow(false)}>
                    <div className="heading-options">{headingOptions}</div>
                </OutsideClickHandler>
            )}
        </button>
    );
};
