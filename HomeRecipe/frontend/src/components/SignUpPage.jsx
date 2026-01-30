import React from "react";
import SignUp from "./SignUp";
import Logo from "../images/homerecipelogo1.png";
import { useNavigate } from "react-router-dom";
import "../styling/HomePage.css";

function SignUpPage() {
  const navigate = useNavigate();

  const handleSelectePage = () => {
    navigate("/login");
  };

  return (
    <div className="left-section">
      <div className="left-content">
        <div className="title-logo">
          <img src={Logo} alt="logo" className="logo" />
          <h1 className="title">HomeRecipe</h1>
        </div>

        <div className="centered-content">
          <h1 className="main-title">Create Your Account</h1>
          <p className="main-title-sub">Let’s get started!</p>

          <div className="login-signup-section">
            <SignUp />

            <p className="signup-text">
              Already have an account?{" "}
              <span onClick={() => handleSelectePage()}>Log In</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignUpPage;
