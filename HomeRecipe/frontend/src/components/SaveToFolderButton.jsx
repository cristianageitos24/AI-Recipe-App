import React, { useState } from "react";
import "../styling/SaveToFolderButton.css";
import { handlePostToFolderBackend } from "./BackendMethods";

function SaveToFolderButton({ folders, recipeData }) {
  const [isOpen, setIsOpen] = useState(false);

  const truncateString = (inputString, maxCharacters) => {
    if (inputString.length > maxCharacters) {
      const truncatedString = inputString.slice(0, maxCharacters);
      // Check if the last character of the truncated string is a space or punctuation
      if (/\s|\W/.test(inputString[maxCharacters - 1])) {
        return truncatedString.trim() + "...";
      } else {
        // Find the last space or punctuation within the truncated string
        const lastSpaceOrPunctuation = truncatedString
          .split("")
          .reverse()
          .join("")
          .search(/\s|\W/);

        // Return truncated string up to the last space or punctuation found
        return (
          truncatedString
            .slice(0, maxCharacters - lastSpaceOrPunctuation)
            .trim() + "..."
        );
      }
    }

    return inputString;
  };

  const handleButtonToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleCookbookClick = (cookbookName) => {
    handlePostToFolderBackend(cookbookName, recipeData);
    // Close the dropdown
    setIsOpen(false);
  };

  return (
    <div className="result-saveto-cookbook-container">
      <button
        className={`result-saveto-cookbook-card-btn ${
          isOpen ? "dropdown-active" : ""
        }`}
        onClick={handleButtonToggle}
      >
        <svg viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M20 9.36364C20 9.59849 19.89 9.84849 19.67 10.1136L16.0937 14.6136C15.7885 15 15.361 15.3277 14.8111 15.5966C14.2611 15.8655 13.752 16 13.2837 16H1.70304C1.46177 16 1.24712 15.9508 1.05907 15.8523C0.87103 15.7538 0.777009 15.5909 0.777009 15.3636C0.777009 15.1288 0.886998 14.8788 1.10698 14.6136L4.68334 10.1136C4.98847 9.72728 5.416 9.39962 5.96594 9.13069C6.51588 8.86175 7.02501 8.72728 7.49335 8.72728H19.074C19.3152 8.72728 19.5299 8.77652 19.7179 8.87501C19.906 8.97349 20 9.13637 20 9.36364ZM16.3491 5.45456V7.27273H7.49335C6.82632 7.27273 6.12737 7.45266 5.39648 7.81251C4.66561 8.17235 4.08374 8.625 3.65088 9.17046L0.0638616 13.6705L0.0106473 13.7386C0.0106473 13.7083 0.00887277 13.661 0.00532366 13.5966C0.00177455 13.5322 0 13.4849 0 13.4546V2.54546C0 1.84849 0.234167 1.25 0.7025 0.749998C1.17083 0.25 1.73142 0 2.38425 0H5.79031C6.44314 0 7.00372 0.25 7.47207 0.749998C7.9404 1.25 8.17456 1.84848 8.17456 2.54546V2.90909H13.9649C14.6177 2.90909 15.1783 3.15909 15.6466 3.65909C16.115 4.15909 16.3491 4.75757 16.3491 5.45455V5.45456Z"
            fill="#ABABAB"
          />
        </svg>
      </button>
      <div
        className={
          isOpen
            ? "saveto-dropdown-options-open"
            : "saveto-dropdown-options-close"
        }
        onMouseLeave={handleButtonToggle}
      >
        {folders.length > 0 ? (
          folders.map((folder, index) => (
            <button
              className="saveto-dropdown-option-folder"
              key={index}
              onClick={() => handleCookbookClick(folder)}
            >
              {truncateString(folder, 20)}
            </button>
          ))
        ) : (
          <div>No folders available</div>
        )}
      </div>
    </div>
  );
}

export default SaveToFolderButton;
