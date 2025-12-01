// Login Page JavaScript
// Wait for DOM to be fully loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLoginPage);
} else {
  initLoginPage();
}

function initLoginPage() {
  console.log("=== LOGIN PAGE INITIALIZING ===");

  const loginSection = document.getElementById("login-section");
  const registerSection = document.getElementById("register-section");
  const passwordResetSection = document.getElementById(
    "password-reset-section"
  );
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const passwordResetForm = document.getElementById("password-reset-form");
  const showRegisterBtn = document.getElementById("show-register");
  const showLoginBtn = document.getElementById("show-login");

  console.log("Forms found:", {
    loginForm: !!loginForm,
    registerForm: !!registerForm,
    passwordResetForm: !!passwordResetForm,
  });

  let isDataLoaded = false;
  let currentUser = null; // Store user during password reset

  // Load user data first
  async function initializeData() {
    console.log("=== INITIALIZING DATA ===");
    console.log("Endpoint:", window.APP_STATE_ENDPOINT);

    try {
      // Show loading state
      if (loginForm) {
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          console.log("Login button disabled during load");
        }
      }
      if (registerForm) {
        const submitBtn = registerForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          console.log("Register button disabled during load");
        }
      }

      // Fetch data from server
      console.log("Fetching data from server...");
      const response = await fetch(
        window.APP_STATE_ENDPOINT || "http://localhost:5000/api/state"
      );

      console.log("Server response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        // Initialize appState globally
        window.appState = data;
        console.log("✅ Loaded users from server:", data.users?.length || 0);
        if (data.users && data.users.length > 0) {
          console.log("First user sample:", {
            email: data.users[0].email,
            role: data.users[0].role,
          });
        }
        isDataLoaded = true;
      } else {
        console.error(
          "❌ Failed to load user data from server - Status:",
          response.status
        );
        // Try to load from localStorage as fallback
        if (typeof loadState === "function") {
          window.appState = loadState();
          console.log(
            "Loaded from localStorage:",
            window.appState?.users?.length || 0,
            "users"
          );
          isDataLoaded = true;
        }
      }
    } catch (error) {
      console.error("❌ Error loading data:", error);
      // Fallback to localStorage
      if (typeof loadState === "function") {
        window.appState = loadState();
        console.log(
          "Fallback to localStorage:",
          window.appState?.users?.length || 0,
          "users"
        );
        isDataLoaded = true;
      }
    } finally {
      // Enable forms after data loads
      if (loginForm) {
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = false;
          console.log("Login button enabled");
        }
      }
      if (registerForm) {
        const submitBtn = registerForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = false;
          console.log("Register button enabled");
        }
      }
      console.log("=== DATA INITIALIZATION COMPLETE ===");
    }
  }

  // Initialize on page load
  console.log("Calling initializeData...");
  initializeData();

  // Toggle between login and register
  if (showRegisterBtn) {
    showRegisterBtn.addEventListener("click", (e) => {
      e.preventDefault();
      loginSection.style.display = "none";
      registerSection.style.display = "block";
      document.getElementById("register-error").textContent = "";
    });
  }

  if (showLoginBtn) {
    showLoginBtn.addEventListener("click", (e) => {
      e.preventDefault();
      registerSection.style.display = "none";
      loginSection.style.display = "block";
      document.getElementById("login-error").textContent = "";
    });
  }

  // Validation helper functions
  function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function validatePassword(password) {
    return password.length >= 6;
  }

  function showError(errorNode, message) {
    errorNode.textContent = message;
    errorNode.style.display = "block";
  }

  function clearError(errorNode) {
    errorNode.textContent = "";
    errorNode.style.display = "none";
  }

  // Add real-time validation for login form
  if (loginForm) {
    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");
    const errorNode = document.getElementById("login-error");

    // Real-time email validation
    emailInput.addEventListener("blur", () => {
      const email = emailInput.value.trim();
      if (email && !validateEmail(email)) {
        showError(errorNode, "Please enter a valid email address");
        emailInput.style.borderColor = "#f44336";
      } else {
        emailInput.style.borderColor = "";
      }
    });

    emailInput.addEventListener("input", () => {
      if (errorNode.textContent.includes("email")) {
        clearError(errorNode);
      }
      emailInput.style.borderColor = "";
    });

    // Real-time password validation
    passwordInput.addEventListener("input", () => {
      if (errorNode.textContent) {
        clearError(errorNode);
      }
      passwordInput.style.borderColor = "";
    });
  }

  // Handle Login
  if (loginForm) {
    console.log("✅ Login form event listener attached");
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      console.log("=== LOGIN ATTEMPT ===");

      const emailInput = document.getElementById("login-email");
      const passwordInput = document.getElementById("login-password");
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const errorNode = document.getElementById("login-error");

      // Clear previous errors
      clearError(errorNode);
      emailInput.style.borderColor = "";
      passwordInput.style.borderColor = "";

      console.log("Login attempt for:", email);
      console.log("Password length:", password.length);

      // Validation
      if (!email || !password) {
        showError(errorNode, "Please fill in all fields");
        if (!email) emailInput.style.borderColor = "#f44336";
        if (!password) passwordInput.style.borderColor = "#f44336";
        console.log("❌ Validation failed: empty fields");
        return;
      }

      if (!validateEmail(email)) {
        showError(errorNode, "Please enter a valid email address");
        emailInput.style.borderColor = "#f44336";
        console.log("❌ Validation failed: invalid email format");
        return;
      }

      if (!validatePassword(password)) {
        showError(errorNode, "Password must be at least 6 characters");
        passwordInput.style.borderColor = "#f44336";
        console.log("❌ Validation failed: password too short");
        return;
      }

      // Check if data is loaded
      console.log("Data loaded status:", isDataLoaded);
      console.log("appState exists:", typeof appState !== "undefined");
      console.log("appState.users exists:", appState?.users ? "yes" : "no");
      console.log("appState.users length:", appState?.users?.length || 0);

      if (!isDataLoaded || typeof appState === "undefined" || !appState.users) {
        errorNode.textContent = "System loading, please wait...";
        console.log("❌ System not ready");
        return;
      }

      console.log("Checking login against", appState.users.length, "users");

      // Debug: Show all user emails
      console.log(
        "Available user emails:",
        appState.users.map((u) => u.email)
      );

      const user = appState.users.find(
        (u) => u.email === email && u.password === password
      );

      if (!user) {
        errorNode.textContent = "Invalid email or password";
        console.log("❌ Login failed for:", email);
        // Try to find by email only to see if email exists
        const emailMatch = appState.users.find((u) => u.email === email);
        if (emailMatch) {
          console.log("Email found but password mismatch");
          console.log("Stored password:", emailMatch.password);
          console.log("Entered password:", password);
        } else {
          console.log("Email not found in database");
        }
        return;
      }

      console.log("✅ Login successful for:", user.name);

      // Check if this is first-time login (password needs to be reset)
      // Admin-created accounts have requirePasswordReset flag
      if (user.requirePasswordReset) {
        console.log("⚠️ First-time login - password reset required");
        currentUser = user;

        // Show password reset form
        loginSection.style.display = "none";
        passwordResetSection.style.display = "block";
        document.getElementById("reset-error").textContent = "";
        document.getElementById("reset-current-password").value = "";
        document.getElementById("reset-new-password").value = "";
        document.getElementById("reset-confirm-password").value = "";
        return;
      }

      // Set session
      if (typeof setSession === "function") {
        setSession(user.id);
        const landing = "index.html"; // Always go to dashboard
        console.log("Redirecting to:", landing);

        // Check if non-admin user hasn't clocked in today
        if (user.permission !== "admin") {
          const today = new Date().toISOString().split("T")[0];
          const todaysLogs = (appState.attendanceLogs || []).filter(
            (log) =>
              log.employeeId === user.id && log.timestamp.startsWith(today)
          );
          const hasClockedIn = todaysLogs.some((log) => log.action === "in");

          if (!hasClockedIn) {
            // Store flag to show clock-in prompt after redirect
            localStorage.setItem("show_clock_in_prompt", "true");
          }
        }

        window.location.href = landing;
      } else {
        errorNode.textContent = "Authentication system error";
        console.log("❌ setSession function not found");
      }
    });
  } else {
    console.log("❌ Login form not found!");
  }

  // Add real-time validation for register form
  if (registerForm) {
    const nameInput = document.getElementById("register-name");
    const emailInput = document.getElementById("register-email");
    const phoneInput = document.getElementById("register-phone");
    const passwordInput = document.getElementById("register-password");
    const confirmPasswordInput = document.getElementById(
      "register-password-confirm"
    );
    const errorNode = document.getElementById("register-error");

    // Name validation
    nameInput.addEventListener("blur", () => {
      const name = nameInput.value.trim();
      if (name && name.length < 2) {
        showError(errorNode, "Name must be at least 2 characters");
        nameInput.style.borderColor = "#f44336";
      } else {
        nameInput.style.borderColor = "";
      }
    });

    nameInput.addEventListener("input", () => {
      if (errorNode.textContent.includes("Name")) {
        clearError(errorNode);
      }
      nameInput.style.borderColor = "";
    });

    // Email validation
    emailInput.addEventListener("blur", () => {
      const email = emailInput.value.trim();
      if (email && !validateEmail(email)) {
        showError(errorNode, "Please enter a valid email address");
        emailInput.style.borderColor = "#f44336";
      } else if (email && appState?.users?.find((u) => u.email === email)) {
        showError(errorNode, "Email already registered");
        emailInput.style.borderColor = "#f44336";
      } else {
        emailInput.style.borderColor = "";
      }
    });

    emailInput.addEventListener("input", () => {
      if (errorNode.textContent.includes("email")) {
        clearError(errorNode);
      }
      emailInput.style.borderColor = "";
    });

    // Phone validation
    phoneInput.addEventListener("blur", () => {
      const phone = phoneInput.value.trim();
      if (phone && phone.length !== 11) {
        showError(errorNode, "Phone number must be exactly 11 digits");
        phoneInput.style.borderColor = "#f44336";
      } else if (phone && !/^\d{11}$/.test(phone)) {
        showError(errorNode, "Phone number must contain only digits");
        phoneInput.style.borderColor = "#f44336";
      } else {
        phoneInput.style.borderColor = "";
      }
    });

    phoneInput.addEventListener("input", () => {
      if (errorNode.textContent.includes("phone")) {
        clearError(errorNode);
      }
      phoneInput.style.borderColor = "";
    });

    // Password validation
    passwordInput.addEventListener("input", () => {
      const password = passwordInput.value;
      if (password && password.length < 6) {
        showError(errorNode, "Password must be at least 6 characters");
        passwordInput.style.borderColor = "#f44336";
      } else {
        passwordInput.style.borderColor = "";
        if (errorNode.textContent.includes("Password")) {
          clearError(errorNode);
        }
      }
    });

    // Confirm password validation
    confirmPasswordInput.addEventListener("input", () => {
      const password = passwordInput.value;
      const confirmPassword = confirmPasswordInput.value;
      if (confirmPassword && password !== confirmPassword) {
        showError(errorNode, "Passwords do not match");
        confirmPasswordInput.style.borderColor = "#f44336";
      } else {
        confirmPasswordInput.style.borderColor = "";
        if (errorNode.textContent.includes("match")) {
          clearError(errorNode);
        }
      }
    });
  }

  // Handle Registration
  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const nameInput = document.getElementById("register-name");
      const emailInput = document.getElementById("register-email");
      const phoneInput = document.getElementById("register-phone");
      const passwordInput = document.getElementById("register-password");
      const confirmPasswordInput = document.getElementById(
        "register-password-confirm"
      );
      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      const phone = phoneInput.value.trim();
      const password = passwordInput.value;
      const confirmPassword = confirmPasswordInput.value;
      const errorNode = document.getElementById("register-error");

      // Clear previous errors
      clearError(errorNode);
      nameInput.style.borderColor = "";
      emailInput.style.borderColor = "";
      phoneInput.style.borderColor = "";
      passwordInput.style.borderColor = "";
      confirmPasswordInput.style.borderColor = "";

      // Validation
      if (!name || !email || !phone || !password || !confirmPassword) {
        showError(errorNode, "Please fill in all fields");
        if (!name) nameInput.style.borderColor = "#f44336";
        if (!email) emailInput.style.borderColor = "#f44336";
        if (!phone) phoneInput.style.borderColor = "#f44336";
        if (!password) passwordInput.style.borderColor = "#f44336";
        if (!confirmPassword)
          confirmPasswordInput.style.borderColor = "#f44336";
        return;
      }

      if (name.length < 2) {
        showError(errorNode, "Name must be at least 2 characters");
        nameInput.style.borderColor = "#f44336";
        return;
      }

      if (!validateEmail(email)) {
        showError(errorNode, "Please enter a valid email address");
        emailInput.style.borderColor = "#f44336";
        return;
      }

      if (phone.length !== 11) {
        showError(errorNode, "Phone number must be exactly 11 digits");
        phoneInput.style.borderColor = "#f44336";
        return;
      }

      if (!/^\d{11}$/.test(phone)) {
        showError(errorNode, "Phone number must contain only digits");
        phoneInput.style.borderColor = "#f44336";
        return;
      }

      if (!validatePassword(password)) {
        showError(errorNode, "Password must be at least 6 characters");
        passwordInput.style.borderColor = "#f44336";
        return;
      }

      if (password !== confirmPassword) {
        showError(errorNode, "Passwords do not match");
        confirmPasswordInput.style.borderColor = "#f44336";
        return;
      }

      // Check if data is loaded
      if (!isDataLoaded || typeof appState === "undefined" || !appState.users) {
        errorNode.textContent = "System loading, please wait...";
        return;
      }

      // Check if email already exists
      if (appState.users.find((u) => u.email === email)) {
        errorNode.textContent = "Email already registered";
        return;
      }

      // Create new user with default role: front_staff
      const newUser = {
        id: "user-" + Date.now(),
        name: name,
        email: email,
        phone: phone,
        password: password, // In production, this should be hashed
        role: "staff",
        permission: "front_staff",
        status: "active",
        createdAt: new Date().toISOString(),
      };

      console.log("Creating new user:", newUser.email);

      // Disable submit button to prevent double submission
      const submitBtn = registerForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Creating Account...";
      }

      // Save to database via API
      try {
        const endpoint =
          window.APP_STATE_ENDPOINT || "http://localhost:5000/api/state";

        // Add new user to appState temporarily
        appState.users.push(newUser);

        // Send the entire state with the new user
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(appState),
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const result = await response.json();
        console.log("✅ User saved to database successfully:", result);

        // Auto login after registration
        if (typeof setSession === "function") {
          setSession(newUser.id);
          const landing =
            typeof getLandingPageForRole === "function"
              ? getLandingPageForRole(newUser.role)
              : "index.html";
          window.location.href = landing;
        }
      } catch (error) {
        console.error("❌ Error saving user:", error);
        showError(errorNode, "Failed to create account. Please try again.");
        // Remove user from array if save failed
        const index = appState.users.findIndex((u) => u.id === newUser.id);
        if (index > -1) {
          appState.users.splice(index, 1);
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Create Account";
        }
      }
    });
  }

  // Add real-time validation for password reset form
  if (passwordResetForm) {
    const currentPasswordInput = document.getElementById(
      "reset-current-password"
    );
    const newPasswordInput = document.getElementById("reset-new-password");
    const confirmPasswordInput = document.getElementById(
      "reset-confirm-password"
    );
    const errorNode = document.getElementById("reset-error");

    // New password validation
    newPasswordInput.addEventListener("input", () => {
      const newPassword = newPasswordInput.value;
      const currentPassword = currentPasswordInput.value;

      if (newPassword && newPassword.length < 6) {
        showError(errorNode, "Password must be at least 6 characters");
        newPasswordInput.style.borderColor = "#f44336";
      } else if (
        newPassword &&
        currentPassword &&
        newPassword === currentPassword
      ) {
        showError(
          errorNode,
          "New password must be different from current password"
        );
        newPasswordInput.style.borderColor = "#f44336";
      } else {
        newPasswordInput.style.borderColor = "";
        if (
          errorNode.textContent.includes("Password") ||
          errorNode.textContent.includes("different")
        ) {
          clearError(errorNode);
        }
      }
    });

    // Confirm password validation
    confirmPasswordInput.addEventListener("input", () => {
      const newPassword = newPasswordInput.value;
      const confirmPassword = confirmPasswordInput.value;

      if (confirmPassword && newPassword !== confirmPassword) {
        showError(errorNode, "New passwords do not match");
        confirmPasswordInput.style.borderColor = "#f44336";
      } else {
        confirmPasswordInput.style.borderColor = "";
        if (errorNode.textContent.includes("match")) {
          clearError(errorNode);
        }
      }
    });

    // Clear errors on input
    currentPasswordInput.addEventListener("input", () => {
      currentPasswordInput.style.borderColor = "";
      if (errorNode.textContent) {
        clearError(errorNode);
      }
    });
  }

  // Handle Password Reset (First-time login)
  if (passwordResetForm) {
    passwordResetForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const currentPasswordInput = document.getElementById(
        "reset-current-password"
      );
      const newPasswordInput = document.getElementById("reset-new-password");
      const confirmPasswordInput = document.getElementById(
        "reset-confirm-password"
      );
      const currentPassword = currentPasswordInput.value;
      const newPassword = newPasswordInput.value;
      const confirmPassword = confirmPasswordInput.value;
      const errorNode = document.getElementById("reset-error");

      // Clear previous errors
      clearError(errorNode);
      currentPasswordInput.style.borderColor = "";
      newPasswordInput.style.borderColor = "";
      confirmPasswordInput.style.borderColor = "";

      // Validation
      if (!currentPassword || !newPassword || !confirmPassword) {
        showError(errorNode, "Please fill in all fields");
        if (!currentPassword)
          currentPasswordInput.style.borderColor = "#f44336";
        if (!newPassword) newPasswordInput.style.borderColor = "#f44336";
        if (!confirmPassword)
          confirmPasswordInput.style.borderColor = "#f44336";
        return;
      }

      if (currentPassword !== currentUser.password) {
        showError(errorNode, "Current password is incorrect");
        currentPasswordInput.style.borderColor = "#f44336";
        return;
      }

      if (!validatePassword(newPassword)) {
        showError(errorNode, "Password must be at least 6 characters");
        newPasswordInput.style.borderColor = "#f44336";
        return;
      }

      if (newPassword !== confirmPassword) {
        showError(errorNode, "New passwords do not match");
        confirmPasswordInput.style.borderColor = "#f44336";
        return;
      }

      if (newPassword === currentPassword) {
        showError(
          errorNode,
          "New password must be different from current password"
        );
        newPasswordInput.style.borderColor = "#f44336";
        return;
      }

      // Update password in appState
      const userIndex = appState.users.findIndex(
        (u) => u.id === currentUser.id
      );
      if (userIndex === -1) {
        errorNode.textContent = "User not found";
        return;
      }

      appState.users[userIndex].password = newPassword;
      appState.users[userIndex].requirePasswordReset = false;

      console.log("✅ Password updated for:", currentUser.email);

      // Disable submit button
      const submitBtn = passwordResetForm.querySelector(
        'button[type="submit"]'
      );
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Updating...";
      }

      // Save to database
      try {
        await syncStateToDatabase();
        console.log("Password change saved to database");

        // Log in the user after password reset
        if (typeof setSession === "function") {
          setSession(currentUser.id);
          const landing =
            typeof getLandingPageForRole === "function"
              ? getLandingPageForRole(currentUser.role)
              : "index.html";
          console.log("Redirecting to:", landing);
          window.location.href = landing;
        }
      } catch (error) {
        console.error("Error saving password:", error);
        errorNode.textContent = "Failed to update password. Please try again.";

        // Revert changes
        appState.users[userIndex].password = currentPassword;
        appState.users[userIndex].requirePasswordReset = true;

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Update Password";
        }
      }
    });
  }

  console.log("=== LOGIN PAGE INITIALIZATION COMPLETE ===");
}
