/**
 * nav.js — Shared top navigation bar for all Circus Racing pages.
 *
 * Usage: <script src="/shared/nav.js"></script>
 * Optional: set window.crCustomLogout before user clicks sign out
 *           (used by dashboard to show its login overlay instead of redirecting).
 */
(function () {
    "use strict";

    var NAV_ITEMS = [
        {
            icon: "dashboard",
            label: "Dashboard",
            href: "/dashboard/",
            roles: ["ADMIN", "MODERATOR"],
        },
        {
            icon: "person",
            label: "My profile",
            href: "/pilot-app/profile.html",
            roles: ["ADMIN", "MODERATOR", "PILOT"],
        },
        {
            icon: "leaderboard",
            label: "Leaderboard",
            href: "/overlays/leaderboard/",
            target: "_blank",
            roles: ["ADMIN", "MODERATOR", "PILOT"],
        },
        {
            icon: "notifications",
            label: "Race alert",
            href: "/overlays/race-alert/",
            target: "_blank",
            roles: ["ADMIN", "MODERATOR"],
        },
    ];

    function getPilot() {
        try {
            return JSON.parse(localStorage.getItem("cr_pilot") || "null");
        } catch (_) {
            return null;
        }
    }

    function isActive(href) {
        var p = window.location.pathname;
        // Exact match or sub-path (for directory hrefs like /dashboard/)
        return p === href || p === href.replace(/\/$/, "") || p.startsWith(href.replace(/\/$/, "") + "/");
    }

    function esc(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function injectStyles() {
        if (document.querySelector('link[data-cr-nav]')) return;
        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "/shared/nav.css";
        link.dataset.crNav = "";
        document.head.appendChild(link);
    }

    function buildNavHTML(pilot) {
        // ── Brand ────────────────────────────────────────────────────────────
        var brandHref = pilot
            ? pilot.role === "PILOT"
                ? "/pilot-app/profile.html"
                : "/dashboard/"
            : "/pilot-app/login.html";

        var start =
            '<a class="cr-topbar-brand" href="' + brandHref + '">' +
            '<span class="cr-topbar-logo" aria-hidden="true">🏁</span>' +
            '<span class="cr-topbar-title">Circus Racing</span>' +
            '</a>';

        // ── Nav items (only when logged in) ──────────────────────────────────
        var items = "";
        if (pilot) {
            NAV_ITEMS.forEach(function (item) {
                if (!item.roles.includes(pilot.role)) return;
                var active = isActive(item.href) ? " cr-nav-item--active" : "";
                var target = item.target ? ' target="' + item.target + '" rel="noopener"' : "";
                items +=
                    '<a class="cr-nav-item' + active + '" href="' + item.href + '"' + target + ">" +
                    '<span class="material-symbols-outlined" aria-hidden="true">' + item.icon + "</span>" +
                    "<span>" + item.label + "</span>" +
                    "</a>";
            });
        }

        var nav = '<nav class="cr-topbar-nav">' + items + "</nav>";

        // ── Right section: user chip + logout / sign-in link ─────────────────
        var end = "";
        if (pilot) {
            var name = esc(pilot.displayName || pilot.name || "Pilot");
            var initial = name.charAt(0).toUpperCase();
            var avatarInner = pilot.avatarUrl
                ? '<img src="' + esc(pilot.avatarUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover;" />'
                : initial;

            end =
                '<div class="cr-topbar-end">' +
                '<div class="cr-topbar-user">' +
                '<span id="header-avatar" class="cr-topbar-avatar" aria-hidden="true">' + avatarInner + "</span>" +
                '<span id="header-displayName" class="cr-topbar-username">' + name + "</span>" +
                "</div>" +
                '<button class="cr-topbar-logout md-typescale-label-large" onclick="crNavLogout()" title="Sign out" aria-label="Sign out">' +
                '<span class="material-symbols-outlined" aria-hidden="true">logout</span>' +
                "</button>" +
                "</div>";
        } else {
            // Unauthenticated: show contextual link (register ↔ login)
            var path = window.location.pathname;
            var isLogin    = path.includes("login");
            var isRegister = path.includes("register");
            var linkHref  = isLogin ? "register.html" : isRegister ? "login.html" : "/pilot-app/login.html";
            var linkLabel = isLogin ? "Create account" : "Sign in";
            end =
                '<div class="cr-topbar-end">' +
                '<a class="cr-topbar-action-link" href="' + linkHref + '">' + linkLabel + "</a>" +
                "</div>";
        }

        return start + nav + end;
    }

    function render() {
        if (document.getElementById("cr-topbar")) return; // already rendered

        injectStyles();

        var pilot = getPilot();
        var header = document.createElement("header");
        header.id = "cr-topbar";
        header.className = "cr-topbar";
        header.innerHTML = buildNavHTML(pilot);

        // Insert as first child of <body>
        document.body.insertAdjacentElement("afterbegin", header);
    }

    // ── Global refresh (re-renders nav with current localStorage state) ───────
    window.crNavRefresh = function () {
        var existing = document.getElementById("cr-topbar");
        if (existing) existing.remove();
        render();
    };

    // ── Global logout ─────────────────────────────────────────────────────────
    window.crNavLogout = function () {
        if (typeof window.crCustomLogout === "function") {
            window.crCustomLogout();
            return;
        }
        localStorage.removeItem("cr_jwt");
        localStorage.removeItem("cr_pilot");
        window.location.href = "/pilot-app/login.html";
    };

    // Run as soon as the body is available
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", render);
    } else {
        render();
    }
})();
