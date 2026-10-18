/* =========================================================
   GREENHARVEST AVOCADO FARM SYSTEM
   MAIN JAVASCRIPT
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* =====================================================
       ACTIVE NAVIGATION
       ===================================================== */

    const currentPage =
        window.location.pathname
            .split("/")
            .pop()
            .toLowerCase();

    const navLinks =
        document.querySelectorAll(".nav-links a");

    navLinks.forEach(function (link) {

        const linkPage =
            link.getAttribute("href");

        if (!linkPage) {
            return;
        }

        const cleanLinkPage =
            linkPage.split("#")[0].toLowerCase();

        if (
            cleanLinkPage === currentPage ||
            (
                currentPage === "" &&
                cleanLinkPage === "index.html"
            )
        ) {

            link.classList.add("active");

        } else {

            link.classList.remove("active");

        }

    });


    /* =====================================================
       SMOOTH SCROLLING
       ===================================================== */

    const anchorLinks =
        document.querySelectorAll('a[href^="#"]');

    anchorLinks.forEach(function (link) {

        link.addEventListener(
            "click",
            function (event) {

                const targetId =
                    link.getAttribute("href");

                if (
                    !targetId ||
                    targetId === "#"
                ) {
                    return;
                }

                const target =
                    document.querySelector(targetId);

                if (!target) {
                    return;
                }

                event.preventDefault();

                target.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

            }
        );

    });


    /* =====================================================
       CURRENT YEAR
       ===================================================== */

    const yearElements =
        document.querySelectorAll(
            ".current-year"
        );

    const currentYear =
        new Date().getFullYear();

    yearElements.forEach(function (element) {

        element.textContent =
            currentYear;

    });


    /* =====================================================
       SCROLL TO TOP BUTTON
       ===================================================== */

    const scrollTopButton =
        document.getElementById(
            "scrollTopBtn"
        );

    if (scrollTopButton) {

        window.addEventListener(
            "scroll",
            function () {

                if (window.scrollY > 400) {

                    scrollTopButton.classList.add(
                        "show"
                    );

                } else {

                    scrollTopButton.classList.remove(
                        "show"
                    );

                }

            }
        );


        scrollTopButton.addEventListener(
            "click",
            function () {

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

            }
        );

    }


    /* =====================================================
       MOBILE NAVIGATION
       ===================================================== */

    const menuToggle =
        document.getElementById(
            "menuToggle"
        );

    const mobileMenu =
        document.getElementById(
            "mobileMenu"
        );

    if (
        menuToggle &&
        mobileMenu
    ) {

        menuToggle.addEventListener(
            "click",
            function () {

                mobileMenu.classList.toggle(
                    "open"
                );

                const isOpen =
                    mobileMenu.classList.contains(
                        "open"
                    );

                menuToggle.setAttribute(
                    "aria-expanded",
                    isOpen
                );

            }
        );

    }


    /* =====================================================
       CLOSE MOBILE MENU AFTER CLICK
       ===================================================== */

    const mobileLinks =
        document.querySelectorAll(
            "#mobileMenu a"
        );

    mobileLinks.forEach(function (link) {

        link.addEventListener(
            "click",
            function () {

                if (mobileMenu) {

                    mobileMenu.classList.remove(
                        "open"
                    );

                }

                if (menuToggle) {

                    menuToggle.setAttribute(
                        "aria-expanded",
                        "false"
                    );

                }

            }
        );

    });


    /* =====================================================
       BACK TO TOP LINK
       ===================================================== */

    const backToTopLinks =
        document.querySelectorAll(
            ".back-to-top"
        );

    backToTopLinks.forEach(function (link) {

        link.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

            }
        );

    });


    /* =====================================================
       BASIC BUTTON FEEDBACK
       ===================================================== */

    const actionButtons =
        document.querySelectorAll(
            "[data-action]"
        );

    actionButtons.forEach(function (button) {

        button.addEventListener(
            "click",
            function () {

                const action =
                    button.getAttribute(
                        "data-action"
                    );

                if (!action) {
                    return;
                }

                console.log(
                    "GreenHarvest action:",
                    action
                );

            }
        );

    });


    /* =====================================================
       PAGE READY MESSAGE
       ===================================================== */

    console.log(
        "GreenHarvest Avocado Farm System loaded successfully."
    );

});