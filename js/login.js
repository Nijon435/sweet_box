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

  // Handle Login
  if (loginForm) {
    console.log("✅ Login form event listener attached");
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      console.log("=== LOGIN ATTEMPT ===");

      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;
      const errorNode = document.getElementById("login-error");

      console.log("Login attempt for:", email);
      console.log("Password length:", password.length);

      if (!email || !password) {
        errorNode.textContent = "Please fill in all fields";
        console.log("❌ Validation failed: empty fields");
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

  // Handle Registration
  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = document.getElementById("register-name").value.trim();
      const email = document.getElementById("register-email").value.trim();
      const phone = document.getElementById("register-phone").value.trim();
      const password = document.getElementById("register-password").value;
      const confirmPassword = document.getElementById(
        "register-password-confirm"
      ).value;
      const errorNode = document.getElementById("register-error");

      // Validation
      if (!name || !email || !phone || !password || !confirmPassword) {
        errorNode.textContent = "Please fill in all fields";
        return;
      }

      if (password !== confirmPassword) {
        errorNode.textContent = "Passwords do not match";
        return;
      }

      if (password.length < 6) {
        errorNode.textContent = "Password must be at least 6 characters";
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

      appState.users.push(newUser);
      console.log("New user created:", newUser.email);

      // Disable submit button to prevent double submission
      const submitBtn = registerForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Creating Account...";
      }

      // Save to database
      try {
        // Force immediate sync to database
        await syncStateToDatabase();
        console.log("User saved to database successfully");

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
        console.error("Error saving user:", error);
        errorNode.textContent = "Failed to create account. Please try again.";
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

  // Handle Password Reset (First-time login)
  if (passwordResetForm) {
    passwordResetForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const currentPassword = document.getElementById(
        "reset-current-password"
      ).value;
      const newPassword = document.getElementById("reset-new-password").value;
      const confirmPassword = document.getElementById(
        "reset-confirm-password"
      ).value;
      const errorNode = document.getElementById("reset-error");

      // Validation
      if (!currentPassword || !newPassword || !confirmPassword) {
        errorNode.textContent = "Please fill in all fields";
        return;
      }

      if (currentPassword !== currentUser.password) {
        errorNode.textContent = "Current password is incorrect";
        return;
      }

      if (newPassword !== confirmPassword) {
        errorNode.textContent = "New passwords do not match";
        return;
      }

      if (newPassword.length < 6) {
        errorNode.textContent = "Password must be at least 6 characters";
        return;
      }

      if (newPassword === currentPassword) {
        errorNode.textContent =
          "New password must be different from current password";
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
