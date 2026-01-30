import React, { useState, useEffect, useCallback } from "react";
import {
  handlePostFolderBackend,
  handleGetFoldersBackend,
} from "./BackendMethods";
import FolderTemplate from "./FolderTemplate";
import "../styling/Cookbooks.css";

function Cookbooks() {
  const [showModal, setShowModal] = useState(false);
  const [folderName, setFolderName] = useState("");

  const [folders, setFolders] = useState([]);

  const fetchFolders = useCallback(() => {
    handleGetFoldersBackend("ALL")
      .then((data) => {
        // Update the folders state with the new data
        setFolders(getFolderAndLengths(data));
        // console.log("folders:: ", getFolderAndLengths(data));
      })
      .catch((error) => {
        console.error("Error fetching folders:", error);
      });
  }, []); // No dependencies, as useCallback memoizes the function

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const getFolderAndLengths = (data) => {
    const { folders, results } = data;

    // Create an array of objects with folderName and folderLength
    const folderData = folders.map((folderName) => ({
      folderName,
      folderLength: results[folderName].length,
    }));

    return folderData;
  };

  const closeModal = () => {
    setShowModal(false);
    setFolderName("");
  };

  const handleCancel = () => {
    closeModal();
  };

  //handle key presses on the modal when open
  const handleKeyPress = (event) => {
    if (event.key === "Escape") {
      handleCancel();
    }
    if (event.key === "Enter") {
      handleCreateFolder();
    }
  };

  const handleInputChange = (e) => {
    setFolderName(e.target.value);
  };

  const handleCreateFolder = () => {
    if (folderName.trim().length > 0 && folderName !== null) {
      handlePostFolderBackend(folderName.trim())
        .then((data) => {
          if (data) {
            // Update the folders state with the new data
            fetchFolders();
          }
        })
        .catch((error) => {
          console.error("Error posting folder:", error);
        })
        .finally(() => {
          closeModal(); // Close modal
        });
    } else {
      // Show error if folderName is empty or null
      // You should implement your error handling here
      console.error("Folder name is empty or null");
    }
    fetchFolders();
  };

  return (
    <div className="tabcookbook-cookbooks-section">
      <h1 className="cookbook-subtitle">Personalized Cookbooks</h1>

      <div className="cookbook-folders-content-container">
        {folders.map((folder, index) => (
          <FolderTemplate folderData={folder} key={index} />
        ))}

        <button
          className={`add-new-folder-btn ${
            showModal ? "new-folder-btn-active" : ""
          }`}
          onClick={() => setShowModal(true)}
        >
          + Add new cookbook
        </button>

        {showModal && (
          <div
            className="new-folder-modal-overlay"
            onClick={handleCancel}
            onKeyDown={handleKeyPress}
          >
            <div
              className="new-folder-info-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <h1 className="new-folder-title">New Folder</h1>
              <input
                className="new-folder-input"
                placeholder="Enter folder name"
                type="text"
                value={folderName}
                onChange={handleInputChange}
                autoFocus
              />
              <div className="modal-folder-action-btns">
                <button
                  className="new-folder-cancel-btn"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                <button
                  className="new-folder-create-btn"
                  onClick={handleCreateFolder}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Cookbooks;
