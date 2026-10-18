/* =========================================================
   GREENHARVEST AVOCADO FARM SYSTEM
   PAYMENTS JAVASCRIPT
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    const paymentForm =
        document.getElementById(
            "paymentForm"
        );

    if (paymentForm) {

        paymentForm.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();

                const formData =
                    new FormData(paymentForm);

                const payment = {};

                formData.forEach(
                    function (value, key) {

                        payment[key] =
                            value;

                    }
                );

                payment.id =
                    "PAY-" + Date.now();

                payment.status =
                    "Pending";

                payment.createdAt =
                    new Date().toISOString();

                let payments =
                    JSON.parse(
                        localStorage.getItem(
                            "greenHarvestPayments"
                        )
                    );

                if (!Array.isArray(payments)) {
                    payments = [];
                }

                payments.push(payment);

                localStorage.setItem(
                    "greenHarvestPayments",
                    JSON.stringify(payments)
                );

                const message =
                    document.getElementById(
                        "paymentMessage"
                    );

                if (message) {

                    message.textContent =
                        "Payment request submitted successfully.";

                    message.className =
                        "auth-message success";

                }

                paymentForm.reset();

                console.log(
                    "Payment recorded:",
                    payment
                );

            }
        );

    }

    console.log(
        "GreenHarvest payments module loaded."
    );

});


/* =========================================================
   GET PAYMENTS
   ========================================================= */

function getGreenHarvestPayments() {

    const payments =
        JSON.parse(
            localStorage.getItem(
                "greenHarvestPayments"
            )
        );

    return Array.isArray(payments)
        ? payments
        : [];

}