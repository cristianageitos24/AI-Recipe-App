import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { Navigate } from "react-router-dom";
import LoginPage from "./components/LoginPage";
import SignUpPage from "./components/SignUpPage";
import MainPageRightSection from "./components/MainPageRightSection";
import TabHome from "./components/TabHome";
import TabCalendar from "./components/TabCalendar";
import TabCookbook from "./components/TabCookbook";
import CookbookFolderPage from "./components/CookbookFolderPage";
import Nav from "./components/Nav";
import "./styling/Nav.css";
import "./styling/HomePage.css";

function ProtectedRoute({ children }) {
  if (!localStorage.getItem("token")) {
    return <Navigate to="/" />;
  }
  return children;
}

function CheckToken({ children }) {
  if (localStorage.getItem("token")) {
    return <Navigate to="/d/" />;
  }
  return children;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/*"
          element={
            <div className="landing-page">
              <CheckToken>
                <Routes>
                  <Route index element={<LoginPage />} />
                  <Route path="login" element={<LoginPage />} />
                  <Route path="signup" element={<SignUpPage />} />
                </Routes>
                <MainPageRightSection />
              </CheckToken>
            </div>
          }
        />

        <Route
          path="/d/*"
          element={
            <div className="dashboard-page">
              <ProtectedRoute>
                <Nav /> {/* Render Nav component for all /d/* routes */}
                <Routes>
                  {/* Render protected routes */}
                  <Route index element={<TabHome />} />
                  <Route path="home" element={<TabHome />} />
                  <Route path="calendar" element={<TabCalendar />} />
                  <Route path="cookbook" element={<TabCookbook />} />
                  <Route
                    path="cookbook/:folderName"
                    element={<CookbookFolderPage />}
                  />
                </Routes>
              </ProtectedRoute>
            </div>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
