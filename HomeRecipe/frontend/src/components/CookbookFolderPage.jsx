import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import {
  handleDeleteFolderBackend,
  handleGetFoldersBackend,
  handleRenameFoldersBackend,
} from "./BackendMethods";

import "../styling/CookbookFolderPage.css";
import CookbookPageRecipeCard from "./CookbookPageRecipeCard";
import EmptyFolderSVG from "../images/emptycookbook.svg";

function CookbookFolderPage() {
  const navigate = useNavigate();
  const { folderName } = useParams();

  const [copyFolderName, setCopyFolderName] = useState(folderName);

  const [folderRecipes, setFolderRecipes] = useState([]);
  const [isFolderOptionsOpen, setIsFolderOptionsOpen] = useState(false);

  const [isRenameOptionOpen, setIsRenameOptionOpen] = useState(false);
  const [folderRename, setFolderRename] = useState("");

  const [isLoading, setIsLoading] = useState(true);

  /*
  useEffect(() => {
    handleGetFoldersBackend(copyFolderName)
      .then((data) => {
        setFolderRecipes(data.result[copyFolderName]);
        console.log(data.result[copyFolderName]);
      })
      .catch((error) => console.error(error));
  }, [copyFolderName]);
  */

  useEffect(() => {
    handleGetFoldersBackend(folderName)
      .then((data) => {
        setFolderRecipes(data.result[folderName]);
        setIsLoading(false);
      })
      .catch((error) => console.error(error));
  }, [folderName]);

  const handleGoToPrevPage = () => {
    navigate("/d/cookbook"); // Redirect to the home page
  };

  const handleKeyPress = (event) => {
    if (event.key === "Escape") {
      handleCancel();
    }
    if (event.key === "Enter") {
      handleConfirmFolderRename();
    }
  };

  const handleInputChange = (e) => {
    setFolderRename(e.target.value);
  };

  const handleFolderOption = (option) => {
    if (option === "rename") {
      setIsRenameOptionOpen(!isRenameOptionOpen);
    } else if (option === "trash") {
      handleDeleteFolderBackend(copyFolderName).then((data) => {
        if (data["success"]) {
          navigate("/d/cookbook");
        }
      });
    }

    setIsFolderOptionsOpen(false);
  };

  const handleCancel = () => {
    setIsRenameOptionOpen(false);
  };

  const handleConfirmFolderRename = () => {
    handleRenameFoldersBackend(copyFolderName, folderRename).then((data) => {
      if (data["success"]) {
        setIsRenameOptionOpen(false);
        window.history.replaceState({}, "", `/d/cookbook/${folderRename}`);
        setCopyFolderName(folderRename);
      }
    });
  };

  return (
    <div className="right-side-panel">
      <div className="bttn-titles">
        <button className="back-bttn" onClick={handleGoToPrevPage}>
          Cookbooks
        </button>

        <svg
          className="arrow-icon"
          width="8"
          height="14"
          viewBox="0 0 8 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1 1L7 7L1 13"
            stroke="black"
            strokeWidth="2"
            strokeMiterlimit="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <button
          className="folder-bttn"
          onClick={() => setIsFolderOptionsOpen(!isFolderOptionsOpen)}
          onBlur={() => setIsFolderOptionsOpen(false)}
          style={
            isFolderOptionsOpen
              ? {
                  backgroundColor: "#D2DCE1",
                  borderRadius: "10px 10px 0px 0px",
                }
              : {}
          }
        >
          {copyFolderName}
          {isFolderOptionsOpen && (
            <ul className="folder-options">
              <li onClick={() => handleFolderOption("rename")}>Rename</li>
              <hr
                style={{
                  height: "1px",
                  background: "#C8C8C8",
                  width: "100%",
                  border: "none",
                }}
              />
              <li onClick={() => handleFolderOption("trash")}>Move to trash</li>
            </ul>
          )}
        </button>
      </div>

      {isLoading ? (
        <p className="isLoading">Loading...</p>
      ) : folderRecipes.length === 0 ? (
        <div className="empty-folder-container">
          <img className="empty-folder-pic" src={EmptyFolderSVG} alt="SVG" />
          <p className="empty-folder-subtxt">
            It looks like you haven't saved a recipe to your folder yet
          </p>
        </div>
      ) : (
        <div className="cookbook-page-recipe-cards-container">
          {folderRecipes.map((recipe, index) => {
            return <CookbookPageRecipeCard key={index} recipeData={recipe} />;
          })}
        </div>
      )}

      {isRenameOptionOpen && (
        <div
          className="rename-popup-overlay"
          onClick={handleCancel}
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

export default CookbookFolderPage;
