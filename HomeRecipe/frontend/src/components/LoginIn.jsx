import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styling/LoginSignForm.css";

function LoginIn() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleKeyPress = (event) => {
    if (event.key === "Enter") {
      handleLogin();
    }
  };

  const handleLogin = async () => {
    if (username === "" || password === "") {
      setError("Please enter both username and password.");
      return;
    }
    // Make API call for login, handle incorrect credentials error

    try {
      const API_URL = process.env.REACT_APP_API_URL + "/api/login/";
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username,
          password: password,
        }),
      });

      if (response && (response.status === 201 || response.status === 200)) {
        const responseData = await response.json(); // Parse response to JSON
        if (responseData.token) {
          // Check for token in responseData
          localStorage.setItem("token", JSON.stringify(responseData));
          navigate("/d/");
        } else {
          console.log("Login failed:", responseData.error);
        }
      } else if (response && response.status === 401) {
        // unauthorized data ie incorrect username or password
        console.log("Incorrect username or password");
        setError("Incorrect username or password. Please try again.");
      } else {
        console.error("Invalid response received");
        console.error(response);
        setError("Incorrect username or password. Please try again.");
      }
    } catch (error) {
      if (error.response && error.response.data) {
        console.error(error.response.data); // Handle the error response here
      } else {
        console.error("An error occurred while processing the request");
      }
      setError("Server error, please try again later");
    }
  };

  return (
    <div className="login-sign-form-section" onKeyDown={handleKeyPress}>
      <h1>Username</h1>
      <input
        type="text"
        placeholder="Enter your username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <h1>Password</h1>
      <input
        type="password"
        placeholder="Enter your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="error-message">{error}</p>}

      <button type="submit" className="login-button" onClick={handleLogin}>
        Login
      </button>
    </div>
  );
}

export default LoginIn;
