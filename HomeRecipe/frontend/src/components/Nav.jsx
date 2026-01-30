import React from "react";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Squash as Hamburger } from "hamburger-react";
import Icon from "../images/homerecipelogo1.png";
import "../styling/Nav.css";
import { handleGetUsername } from "./BackendMethods";
import { motion } from "framer-motion";
import { useMediaQuery } from "react-responsive";

function Nav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentTab, setCurrentTab] = useState(1);

  const [isMenuClicked, setIsMenuClicked] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState("");

  const isSmallScreen = useMediaQuery({ maxWidth: 575 });

  useEffect(() => {
    handleGetUsername()
      .then((data) => {
        setLoggedInUser(data["success"]);
      })
      .catch((error) => {
        console.error("Error getting username:", error);
      });
  }, []);

  useEffect(() => {
    // Extract the current tab from the pathname
    const currentPath = location.pathname;
    if (currentPath === "/d/home") {
      setCurrentTab(1);
    } else if (
      currentPath === "/d/cookbook" ||
      currentPath.startsWith("/d/cookbook/")
    ) {
      setCurrentTab(2);
    } else if (currentPath === "/d/calendar") {
      setCurrentTab(3);
    }
  }, [location.pathname]);

  const handleLogOut = () => {
    console.log("Logging out");
    localStorage.removeItem("token"); // Remove the token from localStorage
    console.log(localStorage.getItem("token"));
    navigate("/"); // Redirect to the home page
  };

  const handleMenuResponsiveness = () => {
    setIsMenuClicked(!isMenuClicked);
  };

  const handleActiveLink = (index) => {
    if (index === 1) {
      navigate("/d/home");
      handleMenuResponsiveness();
    } else if (index === 2) {
      navigate("/d/cookbook");
      handleMenuResponsiveness();
    } else {
      navigate("/d/calendar");
      handleMenuResponsiveness();
    }
  };

  return (
    <div className="left-side-panel">
      <div className="top-title">
        <div className="icon-text-main" onClick={() => navigate("/d/home")}>
          <img className="web-icon" src={Icon} alt="Web Icon" />
          <p className="">HomeRecipe</p>
        </div>
        <div className="hamburger-icon">
          <Hamburger
            onToggle={handleMenuResponsiveness}
            toggle={setIsMenuClicked}
            toggled={isMenuClicked}
          />
        </div>
      </div>

      {/* Tab Menu */}
      <div className={isMenuClicked ? "menu-panel" : "menu-panel-closed"}>
        <motion.div
          initial={{ x: isSmallScreen ? 250 : 0 }} // Initial position based on screen size
          animate={{ x: isMenuClicked ? 0 : isSmallScreen ? 250 : 0 }} // Final position based on screen size and menu state
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          <ul className="side-tabs">
            <li
              className={currentTab === 1 ? "active" : ""}
              onClick={() => handleActiveLink(1)}
            >
              <svg
                width="500"
                height="500"
                viewBox="0 0 500 500"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M174.835 469.552V392.881C174.835 373.452 191.465 357.667 212.064 357.545H287.7C308.391 357.545 325.165 373.365 325.165 392.881V469.33C325.164 486.181 339.58 499.876 357.446 499.999H409.048C433.148 500.057 456.283 491.069 473.347 475.017C490.41 458.965 500 437.168 500 414.437V196.646C500 178.284 491.37 160.868 476.437 149.087L301.131 16.8567C270.487 -6.27193 226.72 -5.52479 196.984 18.6346L25.4477 149.087C9.80896 160.52 0.461902 177.989 0 196.646V414.215C0 461.592 40.7206 499.999 90.9519 499.999H141.376C149.978 500.058 158.25 496.876 164.355 491.16C170.459 485.444 173.893 477.666 173.893 469.552H174.835Z"
                  fill="black"
                />
              </svg>

              <p>Home</p>
            </li>
            <li
              className={currentTab === 2 ? "active" : ""}
              onClick={() => handleActiveLink(2)}
            >
              <svg
                width="500"
                height="500"
                viewBox="0 0 500 500"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M84.0333 500H399.2C408.041 500 416.519 496.708 422.77 490.847C429.021 484.987 432.533 477.038 432.533 468.75V140.625C432.533 136.481 430.777 132.507 427.652 129.576C424.526 126.646 420.287 125 415.867 125H133.333C132.5 125 130.867 125.125 129.3 125.219L84.0333 125C56.0667 125 33.3333 104.969 33.3333 78.7812C33.3333 52.5625 55.3667 31.25 83.3333 31.25H466.667V390.625C466.667 399.25 473.333 406.25 482.567 406.25C491.8 406.25 500 399.25 500 390.625V15.625C500 7 491.767 0 482.567 0H84.0333C61.9736 0.00632787 40.8033 8.15422 25.1021 22.6811C9.40091 37.208 0.4312 56.9459 0.133333 77.625L0 77.4688V421.219C0.00441869 442.112 8.85932 462.147 24.6177 476.921C40.376 491.694 61.7477 499.996 84.0333 500Z"
                  fill="black"
                />
              </svg>

              <p>Cookbooks</p>
            </li>
            <li
              className={currentTab === 3 ? "active" : ""}
              onClick={() => handleActiveLink(3)}
            >
              <svg
                width="500"
                height="500"
                viewBox="0 0 500 500"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M425 50H400V25C400 10 390 0 375 0C360 0 350 10 350 25V50H150V25C150 10 140 0 125 0C110 0 100 10 100 25V50H75C32.5 50 0 82.5 0 125V150H500V125C500 82.5 467.5 50 425 50ZM0 425C0 467.5 32.5 500 75 500H425C467.5 500 500 467.5 500 425V200H0V425ZM375 250C390 250 400 260 400 275C400 290 390 300 375 300C360 300 350 290 350 275C350 260 360 250 375 250ZM375 350C390 350 400 360 400 375C400 390 390 400 375 400C360 400 350 390 350 375C350 360 360 350 375 350ZM250 250C265 250 275 260 275 275C275 290 265 300 250 300C235 300 225 290 225 275C225 260 235 250 250 250ZM250 350C265 350 275 360 275 375C275 390 265 400 250 400C235 400 225 390 225 375C225 360 235 350 250 350ZM125 250C140 250 150 260 150 275C150 290 140 300 125 300C110 300 100 290 100 275C100 260 110 250 125 250ZM125 350C140 350 150 360 150 375C150 390 140 400 125 400C110 400 100 390 100 375C100 360 110 350 125 350Z"
                  fill="black"
                />
              </svg>

              <p>Meal Calendar</p>
            </li>
          </ul>
        </motion.div>

        {/* Logout Button */}
        <div className="bottom-nav-content">
          <div className="loggedin-username-label">
            <div className="signedin-label">Signed in as</div>
            <div className="username-tag">{loggedInUser}</div>
          </div>
          <button className="logout-button" onClick={handleLogOut}>
            <svg
              className="logout-icon"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M7 19H3C2.46957 19 1.96086 18.7893 1.58579 18.4142C1.21071 18.0391 1 17.5304 1 17V3C1 2.46957 1.21071 1.96086 1.58579 1.58579C1.96086 1.21071 2.46957 1 3 1H7"
                stroke="#ABABAB"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 15L19 10L14 5"
                stroke="#ABABAB"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M19 10H7"
                stroke="#ABABAB"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h1>Logout</h1>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Nav;
