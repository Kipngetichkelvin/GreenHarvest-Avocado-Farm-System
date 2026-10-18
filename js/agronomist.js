/* =========================================================
   GREENHARVEST AVOCADO FARM SYSTEM
   AGRONOMIST DASHBOARD JAVASCRIPT
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    const user =
        getAgronomistCurrentUser();

    if (user) {

        document
            .querySelectorAll(
                ".agronomist-name, .current-user-name"
            )
            .forEach(function (element) {

                element.textContent =
                    user.name || "Agronomist";

            });

        document
            .querySelectorAll(
                ".agronomist-email, .current-user-email"
            )
            .forEach(function (element) {

                element.textContent =
                    user.email || "";

            });

    }

    updateAgronomistStatistics();

    console.log(
        "GreenHarvest agronomist module loaded."
    );

});


/* =========================================================
   AGRONOMIST STATISTICS
   ========================================================= */

function updateAgronomistStatistics() {

    const requests =
        JSON.parse(
            localStorage.getItem(
                "greenHarvestServiceRequests"
            )
        ) || [];

    const requestCount =
        document.getElementById(
            "agronomistRequestCount"
        );

    if (requestCount) {

        requestCount.textContent =
            requests.length;

    }

}


/* =========================================================
   GET CURRENT USER
   ========================================================= */

function getAgronomistCurrentUser() {

    const savedUser =
        localStorage.getItem(
            "greenHarvestCurrentUser"
        );

    if (!savedUser) {
        return null;
    }

    try {

        return JSON.parse(
            savedUser
        );

    } catch (error) {

        return null;

    }

}