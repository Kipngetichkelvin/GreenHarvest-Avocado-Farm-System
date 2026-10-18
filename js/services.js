/* =========================================================
   GREENHARVEST AVOCADO FARM SYSTEM
   SERVICES JAVASCRIPT
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* =====================================================
       SERVICE ACTION BUTTONS
       ===================================================== */

    const serviceButtons =
        document.querySelectorAll(
            "[data-service]"
        );

    serviceButtons.forEach(function (button) {

        button.addEventListener(
            "click",
            function () {

                const serviceName =
                    button.getAttribute(
                        "data-service"
                    );

                if (!serviceName) {
                    return;
                }

                localStorage.setItem(
                    "greenHarvestSelectedService",
                    serviceName
                );

                const serviceForm =
                    document.querySelector(
                        ".service-form"
                    );

                if (serviceForm) {

                    serviceForm.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });

                    const serviceSelect =
                        serviceForm.querySelector(
                            "select"
                        );

                    if (serviceSelect) {

                        const options =
                            Array.from(
                                serviceSelect.options
                            );

                        const matchingOption =
                            options.find(
                                function (option) {

                                    return (
                                        option.textContent
                                            .trim()
                                            .toLowerCase() ===
                                        serviceName
                                            .trim()
                                            .toLowerCase()
                                    );

                                }
                            );

                        if (matchingOption) {

                            serviceSelect.value =
                                matchingOption.value;

                        }

                    }

                } else {

                    alert(
                        serviceName +
                        " selected. Please use the service request form to continue."
                    );

                }

            }
        );

    });


    /* =====================================================
       SERVICE REQUEST FORM
       ===================================================== */

    const serviceForms =
        document.querySelectorAll(
            ".service-form"
        );

    serviceForms.forEach(function (form) {

        form.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();

                const formData =
                    new FormData(form);

                const request = {};

                formData.forEach(
                    function (value, key) {

                        request[key] = value;

                    }
                );


                request.id =
                    "SR-" +
                    Date.now();

                request.status =
                    "Pending";

                request.createdAt =
                    new Date().toISOString();


                /* GET EXISTING REQUESTS */

                let requests =
                    JSON.parse(
                        localStorage.getItem(
                            "greenHarvestServiceRequests"
                        )
                    );

                if (!Array.isArray(requests)) {
                    requests = [];
                }


                /* SAVE REQUEST */

                requests.push(request);

                localStorage.setItem(
                    "greenHarvestServiceRequests",
                    JSON.stringify(requests)
                );


                /* SHOW SUCCESS */

                let message =
                    form.querySelector(
                        ".form-message"
                    );

                if (!message) {

                    message =
                        document.createElement(
                            "div"
                        );

                    message.className =
                        "form-message";

                    form.appendChild(message);

                }

                message.textContent =
                    "Your service request has been submitted successfully.";

                message.classList.add(
                    "success"
                );


                /* RESET FORM */

                form.reset();


                console.log(
                    "GreenHarvest service request created:",
                    request
                );

            }
        );

    });


    /* =====================================================
       SERVICE CARD HOVER ACCESSIBILITY
       ===================================================== */

    const serviceCards =
        document.querySelectorAll(
            ".service-card"
        );

    serviceCards.forEach(function (card) {

        card.addEventListener(
            "mouseenter",
            function () {

                card.classList.add(
                    "service-hover"
                );

            }
        );

        card.addEventListener(
            "mouseleave",
            function () {

                card.classList.remove(
                    "service-hover"
                );

            }
        );

    });


    /* =====================================================
       LOAD SELECTED SERVICE
       ===================================================== */

    const savedService =
        localStorage.getItem(
            "greenHarvestSelectedService"
        );

    if (savedService) {

        const serviceSelects =
            document.querySelectorAll(
                ".service-form select"
            );

        serviceSelects.forEach(
            function (select) {

                const options =
                    Array.from(
                        select.options
                    );

                const matchingOption =
                    options.find(
                        function (option) {

                            return (
                                option.textContent
                                    .trim()
                                    .toLowerCase() ===
                                savedService
                                    .trim()
                                    .toLowerCase()
                            );

                        }
                    );

                if (matchingOption) {

                    select.value =
                        matchingOption.value;

                }

            }
        );

    }


    /* =====================================================
       PAGE READY
       ===================================================== */

    console.log(
        "GreenHarvest services module loaded."
    );

});