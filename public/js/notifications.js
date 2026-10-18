/* =========================================================
   GREENHARVEST AVOCADO FARM SYSTEM
   NOTIFICATIONS JAVASCRIPT
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    displayGreenHarvestNotifications();

    const notificationButton =
        document.getElementById(
            "notificationButton"
        );

    const notificationPanel =
        document.getElementById(
            "notificationPanel"
        );

    if (
        notificationButton &&
        notificationPanel
    ) {

        notificationButton.addEventListener(
            "click",
            function () {

                notificationPanel.classList.toggle(
                    "open"
                );

            }
        );

    }

    console.log(
        "GreenHarvest notifications module loaded."
    );

});


/* =========================================================
   CREATE NOTIFICATION
   ========================================================= */

function createGreenHarvestNotification(
    message,
    type = "info"
) {

    if (!message) {
        return null;
    }

    let notifications =
        JSON.parse(
            localStorage.getItem(
                "greenHarvestNotifications"
            )
        );

    if (!Array.isArray(notifications)) {
        notifications = [];
    }

    const notification = {

        id:
            "NOT-" + Date.now(),

        message:
            String(message),

        type:
            type,

        read:
            false,

        createdAt:
            new Date().toISOString()

    };

    notifications.unshift(
        notification
    );

    localStorage.setItem(
        "greenHarvestNotifications",
        JSON.stringify(notifications)
    );

    return notification;
}


/* =========================================================
   GET NOTIFICATIONS
   ========================================================= */

function getGreenHarvestNotifications() {

    const notifications =
        JSON.parse(
            localStorage.getItem(
                "greenHarvestNotifications"
            )
        );

    return Array.isArray(notifications)
        ? notifications
        : [];

}


/* =========================================================
   DISPLAY NOTIFICATIONS
   ========================================================= */

function displayGreenHarvestNotifications() {

    const container =
        document.getElementById(
            "notificationPanel"
        );

    if (!container) {
        return;
    }

    const notifications =
        getGreenHarvestNotifications();

    if (notifications.length === 0) {

        container.innerHTML =
            "<p>No notifications.</p>";

        return;
    }

    container.innerHTML = "";

    notifications.forEach(
        function (notification) {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "notification-item";

            if (!notification.read) {

                item.classList.add(
                    "unread"
                );

            }

            item.textContent =
                notification.message;

            container.appendChild(
                item
            );

        }
    );

}