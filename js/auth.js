/* =========================================================
   GREENHARVEST AVOCADO FARM SYSTEM
   AUTHENTICATION JAVASCRIPT
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* =====================================================
       PASSWORD SHOW / HIDE
       ===================================================== */

    const passwordToggles =
        document.querySelectorAll(".password-toggle");

    passwordToggles.forEach(function (button) {

        button.addEventListener("click", function () {

            const targetId = button.getAttribute("data-target");

            let passwordInput = null;

            if (targetId) {
                passwordInput =
                    document.getElementById(targetId);
            }

            if (!passwordInput) {

                const wrapper =
                    button.closest(".input-wrapper");

                if (wrapper) {
                    passwordInput =
                        wrapper.querySelector("input");
                }
            }

            if (!passwordInput) {
                return;
            }

            if (passwordInput.type === "password") {

                passwordInput.type = "text";

                button.textContent = "🙈";

                button.setAttribute(
                    "aria-label",
                    "Hide password"
                );

            } else {

                passwordInput.type = "password";

                button.textContent = "👁️";

                button.setAttribute(
                    "aria-label",
                    "Show password"
                );
            }
        });

    });


    /* =====================================================
       LOGIN
       ===================================================== */

    const loginForm =
        document.getElementById("loginForm");

    if (loginForm) {

        loginForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();

                const emailInput =
                    document.getElementById("loginEmail");

                const passwordInput =
                    document.getElementById("loginPassword");

                const message =
                    document.getElementById("loginMessage");

                if (!emailInput || !passwordInput) {
                    return;
                }

                const email =
                    emailInput.value.trim().toLowerCase();

                const password =
                    passwordInput.value;

                if (!email || !password) {

                    showAuthMessage(
                        message,
                        "Please enter your email and password.",
                        "error"
                    );

                    return;
                }

                if (!window.GreenHarvestAPI) {

                    showAuthMessage(
                        message,
                        "The API client failed to load. Refresh the page and try again.",
                        "error"
                    );

                    return;
                }

                const submitButton =
                    loginForm.querySelector(
                        'button[type="submit"]'
                    );

                if (submitButton) {
                    submitButton.disabled = true;
                }

                let result = null;

                try {

                    result =
                        await window.GreenHarvestAPI.login(
                            email,
                            password
                        );

                } catch (error) {

                    if (submitButton) {
                        submitButton.disabled = false;
                    }

                    showAuthMessage(
                        message,
                        (error && error.message) ||
                            "Unable to sign in right now.",
                        "error"
                    );

                    return;
                }

                if (submitButton) {
                    submitButton.disabled = false;
                }

                const signedInUser =
                    (result && result.user) || {};

                showAuthMessage(
                    message,
                    "Login successful. Redirecting...",
                    "success"
                );

                setTimeout(function () {

                    const role = signedInUser.role;

                    if (role === "admin") {

                        window.location.href =
                            "admin-dashboard.html";

                    } else if (role === "agronomist") {

                        window.location.href =
                            "agronomist-dashboard.html";

                    } else if (role === "buyer") {

                        window.location.href =
                            "buyer-dashboard.html";

                    } else {

                        window.location.href =
                            "farmer-dashboard.html";
                    }

                }, 1000);

            }
        );

    }


    /* =====================================================
       REGISTER
       ===================================================== */

    const registerForm =
        document.getElementById("registerForm");

    if (registerForm) {

        registerForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();

                const nameInput =
                    document.getElementById("registerName");

                const emailInput =
                    document.getElementById("registerEmail");

                const phoneInput =
                    document.getElementById("registerPhone");

                const roleInput =
                    document.getElementById("registerRole");

                const passwordInput =
                    document.getElementById("registerPassword");

                const confirmInput =
                    document.getElementById("confirmPassword");

                const message =
                    document.getElementById("registerMessage");

                if (
                    !nameInput ||
                    !emailInput ||
                    !passwordInput ||
                    !confirmInput
                ) {
                    return;
                }

                const name =
                    nameInput.value.trim();

                const email =
                    emailInput.value.trim().toLowerCase();

                const phone =
                    phoneInput ?
                    phoneInput.value.trim() :
                    "";

                const role =
                    roleInput ?
                    roleInput.value :
                    "farmer";

                const password =
                    passwordInput.value;

                const confirmPassword =
                    confirmInput.value;


                /* CHECK NAME */

                if (name.length < 2) {

                    showAuthMessage(
                        message,
                        "Please enter your full name.",
                        "error"
                    );

                    return;
                }


                /* CHECK EMAIL */

                const emailPattern =
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

                if (!emailPattern.test(email)) {

                    showAuthMessage(
                        message,
                        "Please enter a valid email address.",
                        "error"
                    );

                    return;
                }


                /* CHECK PASSWORD */

                if (password.length < 6) {

                    showAuthMessage(
                        message,
                        "Password must contain at least 6 characters.",
                        "error"
                    );

                    return;
                }


                /* CHECK PASSWORD MATCH */

                if (password !== confirmPassword) {

                    showAuthMessage(
                        message,
                        "Passwords do not match.",
                        "error"
                    );

                    return;
                }


                /* CREATE ACCOUNT */

                if (!window.GreenHarvestAPI) {

                    showAuthMessage(
                        message,
                        "The API client failed to load. Refresh the page and try again.",
                        "error"
                    );

                    return;
                }

                const details = {

                    name: name,

                    email: email,

                    password: password

                };

                if (phone) {

                    details.phone = phone;

                }

                /*
                 * Only forward role values the API accepts for
                 * self-registration. Anything else is left out so the
                 * server applies its own safe default instead of
                 * silently downgrading an unexpected value.
                 */

                if (role === "farmer" || role === "buyer") {

                    details.role = role;

                }

                const submitButton =
                    registerForm.querySelector('button[type="submit"]');

                if (submitButton) { submitButton.disabled = true; }

                try {

                    await window.GreenHarvestAPI.register(details);

                } catch (error) {

                    if (submitButton) { submitButton.disabled = false; }

                    showAuthMessage(
                        message,
                        (error && error.message) ||
                        "Unable to create the account right now.",
                        "error"
                    );

                    return;
                }

                if (submitButton) { submitButton.disabled = false; }

                /* Force an explicit sign-in with the new credentials. */

                window.GreenHarvestAPI.clearSession();


                showAuthMessage(
                    message,
                    "Account created successfully. Redirecting to login...",
                    "success"
                );


                setTimeout(function () {

                    window.location.href =
                        "login.html";

                }, 1200);

            }
        );

    }


    /* =====================================================
       FORGOT PASSWORD
       ===================================================== */

    const forgotPassword =
        document.querySelector(".forgot-password");

    if (forgotPassword) {

        forgotPassword.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                alert(
                    "Password recovery will be connected to the backend later."
                );

            }
        );

    }


    /* =====================================================
       LOGOUT
       ===================================================== */

    const logoutButtons =
        document.querySelectorAll(".logout-btn");

    logoutButtons.forEach(function (button) {

        button.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                const goToLogin = function () {

                    window.location.href =
                        "login.html";

                };

                if (window.GreenHarvestAPI) {

                    window.GreenHarvestAPI
                        .logout()
                        .then(goToLogin)
                        .catch(goToLogin);

                } else {

                    goToLogin();

                }

            }
        );

    });


    /* =====================================================
       DISPLAY CURRENT USER
       ===================================================== */

    const renderCurrentUser = function (user) {

        if (!user) {
            return;
        }

        document.querySelectorAll(
            ".current-user-name"
        ).forEach(function (element) {

            element.textContent =
                user.name || "";

        });

        document.querySelectorAll(
            ".current-user-email"
        ).forEach(function (element) {

            element.textContent =
                user.email || "";

        });

    };

    if (window.GreenHarvestAPI) {

        const cachedUser =
            window.GreenHarvestAPI.getStoredUser();

        renderCurrentUser(cachedUser);

        if (cachedUser && window.GreenHarvestAPI.getToken()) {

            window.GreenHarvestAPI
                .fetchCurrentUser()
                .then(function (session) {

                    if (session && session.user) {
                        renderCurrentUser(session.user);
                    }

                })
                .catch(function () {

                    /* Offline or server unreachable: keep cached profile. */

                });

        }

    }

});


/* =========================================================
   AUTH MESSAGE FUNCTION
   ========================================================= */

function showAuthMessage(
    element,
    message,
    type
) {

    if (!element) {
        return;
    }

    element.textContent = message;

    element.className =
        "auth-message " + type;

}


/* =========================================================
   CHECK LOGIN STATUS
   ========================================================= */

function isGreenHarvestLoggedIn() {

    if (typeof window.GreenHarvestAPI === "undefined") {
        return false;
    }

    return Boolean(window.GreenHarvestAPI.getToken());

}


/* =========================================================
   GET CURRENT USER
   ========================================================= */

function getGreenHarvestCurrentUser() {

    if (typeof window.GreenHarvestAPI === "undefined") {
        return null;
    }

    return window.GreenHarvestAPI.getStoredUser();

}


/* =========================================================
   VALIDATE SESSION AGAINST THE API
   ========================================================= */

async function validateGreenHarvestSession() {

    if (typeof window.GreenHarvestAPI === "undefined") {
        return null;
    }

    try {

        const session =
            await window.GreenHarvestAPI.fetchCurrentUser();

        return session && session.user ?
            session.user :
            null;

    } catch (error) {

        return getGreenHarvestCurrentUser();

    }

}