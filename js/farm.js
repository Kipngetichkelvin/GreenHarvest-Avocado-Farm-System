/* =========================================================
   GREENHARVEST AVOCADO FARM SYSTEM
   FARM MANAGEMENT JAVASCRIPT
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    const farmForm =
        document.getElementById(
            "farmForm"
        );

    loadFarmData();

    if (farmForm) {

        farmForm.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();

                const formData =
                    new FormData(farmForm);

                const farm = {};

                formData.forEach(
                    function (value, key) {

                        farm[key] =
                            value;

                    }
                );

                farm.updatedAt =
                    new Date().toISOString();

                localStorage.setItem(
                    "greenHarvestFarm",
                    JSON.stringify(farm)
                );

                const message =
                    document.getElementById(
                        "farmMessage"
                    );

                if (message) {

                    message.textContent =
                        "Farm information saved successfully.";

                    message.className =
                        "form-message success";

                }

            }
        );

    }

    console.log(
        "GreenHarvest farm module loaded."
    );

});


/* =========================================================
   LOAD FARM DATA
   ========================================================= */

function loadFarmData() {

    const savedFarm =
        localStorage.getItem(
            "greenHarvestFarm"
        );

    if (!savedFarm) {
        return;
    }

    let farm;

    try {

        farm =
            JSON.parse(savedFarm);

    } catch (error) {

        return;

    }

    if (!farm || typeof farm !== "object") {
        return;
    }

    Object.keys(farm).forEach(
        function (key) {

            const field =
                document.querySelector(
                    `[name="${key}"]`
                );

            if (
                field &&
                key !== "updatedAt"
            ) {

                field.value =
                    farm[key];

            }

        }
    );

}