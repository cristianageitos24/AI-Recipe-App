import React, { useState } from "react";
import { ReactComponent as CookbookIcon } from "../images/dashboard/cookbook-icon.svg";
import { useNavigate } from "react-router-dom";
import "../styling/FolderTemplate.css";
import "../styling/EtcButton.css";

import { useDrop } from "react-dnd";
import {
  handlePostToFolderBackend,
  handleDeleteFolderBackend,
  handleRenameFoldersBackend,
} from "./BackendMethods";

function FolderTemplate({ folderData: initialFolderData }) {
  // Make a copy of folderData using the spread operator
  const [folderData, setFolderData] = useState({ ...initialFolderData });
  const [isMouseHoveringTitle, setisMouseHoveringTitle] = useState(false);

  const [isRenameOptionOpen, setIsRenameOptionOpen] = useState(false);
  const [copyFolderName, setCopyFolderName] = useState(folderData.folderName);
  const [folderRename, setFolderRename] = useState("");

  const [isFolderDeleted, setIsFolderDeleted] = useState(false);

  const [isEtcActive, setIsEtcActive] = useState(false);

  const navigate = useNavigate();

  const [{ isHovering }, drop] = useDrop({
    accept: "RECIPE CARD",
    collect: (monitor) => ({
      isHovering: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
    drop: (item) => {
      // Handle the drop event, and access the recipeID from the dragged item
      const droppedRecipeID = item.id;
      const droppedFolder = copyFolderName;

      handlePostToFolderBackend(droppedFolder, droppedRecipeID)
        .then((data) => {
          console.log(data);
          if (data["success"]) {
            //if drop is successful
            setFolderData({
              ...folderData,
              folderLength: folderData.folderLength + 1,
            });
          }
        })
        .catch((error) => {
          console.log(error);
        });
    },
  });

  const handleFolderOpen = (folderName) => {
    navigate(`/d/cookbook/${folderName}`);
  };

  let timeoutId;
  const handleMouseEnter = () => {
    timeoutId = setTimeout(() => {
      setisMouseHoveringTitle(true);
    }, 500); // 1000 milliseconds = 1 second
  };

  const handleMouseLeave = () => {
    clearTimeout(timeoutId);
    setisMouseHoveringTitle(false);
  };

  const handleEtcShowOptions = (e) => {
    e.stopPropagation();

    setIsEtcActive(!isEtcActive);
  };

  const handleKeyPress = (event) => {
    if (event.key === "Escape") {
      setIsRenameOptionOpen(false);
    }
    if (event.key === "Enter") {
      handleConfirmFolderRename();
    }
  };

  const handleInputChange = (e) => {
    setFolderRename(e.target.value);
  };

  const handleFolderOption = (option) => {
    if (option === "Rename") {
      setIsRenameOptionOpen(!isRenameOptionOpen);
    } else if (option === "Move to trash") {
      handleDeleteFolderBackend(copyFolderName).then((data) => {
        if (data["success"]) {
          setIsFolderDeleted(true);
        }
      });
    }

    setIsEtcActive(false);
  };

  const handleCancel = (e) => {
    e.stopPropagation();
    setIsRenameOptionOpen(false);
  };

  const handleConfirmFolderRename = () => {
    handleRenameFoldersBackend(copyFolderName, folderRename).then((data) => {
      if (data["success"]) {
        setIsRenameOptionOpen(false);
        // window.history.replaceState({}, "", `/d/cookbook/${folderRename}`);
        setCopyFolderName(folderRename);
      }
    });
  };

  return (
    <div
      className={"cookbook-user-folder"}
      onClick={() => handleFolderOpen(copyFolderName)}
      ref={drop}
      style={
        isFolderDeleted
          ? { display: "none" }
          : {
              backgroundColor: isHovering
                ? "rgba(103, 180, 219, 0.4)"
                : "#e7ecef",
              transition: "background-color 0.2s ease",
            }
      }
    >
      <div className="cookbook-active-content">
        <CookbookIcon className="cookbook-icon" />

        <p
          className="cookbook-user-foldername"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {copyFolderName}
        </p>
        {/* HOVER LABEL */}
        {isMouseHoveringTitle && (
          <p className="cookbook-user-complete-foldername">{copyFolderName}</p>
        )}
        <h1 className="cookbook-user-items-count">{folderData.folderLength}</h1>

        <div className="etc-content">
          <button
            className="etc-button"
            onClick={handleEtcShowOptions}
            onBlur={() => setIsEtcActive(false)}
          >
            <svg
              viewBox="0 0 5 19"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2.201 7C1.91196 7 1.62575 7.05693 1.35871 7.16754C1.09168 7.27815 0.84904 7.44028 0.644658 7.64466C0.440277 7.84904 0.278152 8.09168 0.167541 8.35871C0.0569306 8.62575 2.27602e-07 8.91196 2.27602e-07 9.201C2.27602e-07 9.49004 0.0569306 9.77625 0.167541 10.0433C0.278152 10.3103 0.440277 10.553 0.644658 10.7573C0.84904 10.9617 1.09168 11.1238 1.35871 11.2345C1.62575 11.3451 1.91196 11.402 2.201 11.402C2.78474 11.4019 3.34452 11.1698 3.7572 10.757C4.16987 10.3441 4.40163 9.78424 4.4015 9.2005C4.40137 8.61676 4.16935 8.05698 3.75649 7.6443C3.34363 7.23163 2.78374 6.99987 2.2 7H2.201ZM2.201 4.4C2.48991 4.39987 2.77596 4.34283 3.04283 4.23215C3.30969 4.12147 3.55215 3.95931 3.75634 3.75493C3.96054 3.55055 4.12248 3.30795 4.23292 3.04098C4.34336 2.77401 4.40013 2.48791 4.4 2.199C4.39987 1.91009 4.34283 1.62404 4.23215 1.35717C4.12147 1.09031 3.95931 0.847854 3.75493 0.643658C3.55055 0.439462 3.30795 0.277522 3.04098 0.167083C2.77401 0.0566435 2.48791 -0.000131095 2.199 2.27294e-07C1.61552 0.000265452 1.05605 0.232305 0.643658 0.645072C0.231265 1.05784 -0.000264989 1.61752 2.27602e-07 2.201C0.000265444 2.78448 0.232305 3.34395 0.645072 3.75634C1.05784 4.16873 1.61752 4.40027 2.201 4.4ZM2.201 14C1.61726 14 1.05743 14.2319 0.644658 14.6447C0.231891 15.0574 2.27602e-07 15.6173 2.27602e-07 16.201C2.27602e-07 16.7847 0.231891 17.3446 0.644658 17.7573C1.05743 18.1701 1.61726 18.402 2.201 18.402C2.78474 18.402 3.34457 18.1701 3.75734 17.7573C4.17011 17.3446 4.402 16.7847 4.402 16.201C4.402 15.6173 4.17011 15.0574 3.75734 14.6447C3.34457 14.2319 2.78474 14 2.201 14Z"
                fill="black"
              />
            </svg>
            {isEtcActive && (
              <ul className="etc-options">
                <li onClick={() => handleFolderOption("Rename")}>Rename</li>
                <hr
                  style={{
                    height: "1px",
                    background: "#D2DCE1",
                    border: "none",
                    width: "100%",
                  }}
                />
                <li onClick={() => handleFolderOption("Move to trash")}>
                  Move to trash
                </li>
              </ul>
            )}
          </button>
        </div>
      </div>
      {isRenameOptionOpen && (
        <div
          className="rename-popup-overlay"
          onClick={(e) => handleCancel(e)}
          onKeyDown={handleKeyPress}
        >
          <div
            className="rename-folder-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <h1 className="rename-popup-title">Rename</h1>

            <input
              type="text"
              placeholder="Enter new folder name"
              value={folderRename}
              onChange={handleInputChange}
              className="rename-input"
              autoFocus
            />

            <div className="rename-popup-bttns">
              <button className="cancel" onClick={handleCancel}>
                Cancel
              </button>
              <button className="confirm" onClick={handleConfirmFolderRename}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FolderTemplate;
