import React from 'react';

import {
    getRandomDefaultUserImage,
    getBackgroundImageSetForUrl,
    StyledBackgroundImage,
} from '/imports/wl-core/utilities/constants/defaults.js';

export const CustomSuggestion = ({ entry, onClick, isSelected }) => {
    const [src, srcSet] = getBackgroundImageSetForUrl(
        entry?.userThumb || getRandomDefaultUserImage(),
        { width: '75' },
        true
    );
    const suggestionClassName = isSelected
        ? 'mention-suggestion-user-container active'
        : 'mention-suggestion-user-container';

    const thumbStyle = { backgroundImage: `url(${src})` };

    return (
        <div key={entry?.id} onClick={onClick} className={suggestionClassName}>
            <div
                className="thumbnail comment-thumb mention-thumb"
                style={thumbStyle}
                // src={src}
                // srcSet={srcSet}
            >
                <div className="square-spacer" />
            </div>
            <div>{entry.display}</div>
        </div>
    );
};
