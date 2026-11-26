// CHAOS! — Remplace le lien Register / Sign in par l'avatar du compte connecté.
(() => {
    "use strict";

    const accountLinks = Array.from(document.querySelectorAll('a[href]')).filter(link => {
        const href = link.getAttribute("href") || "";
        return /(^|\/)connexion\.html(?:[?#].*)?$/.test(href);
    });

    if (!accountLinks.length) return;

    if (typeof supabaseClient === "undefined") {
        console.warn("CHAOS! : auth-nav.js doit être chargé après supabase.js.");
        return;
    }

    accountLinks.forEach(link => {
        if (!link.dataset.signedOutLabel) {
            link.dataset.signedOutLabel = link.textContent.trim() || "REGISTER / SIGN IN ↗";
        }
    });

    function initials(name, email) {
        const source = (name || email || "C!").trim();
        const parts = source.includes("@") ? [source.split("@")[0]] : source.split(/\s+/);
        return parts.slice(0, 2).map(part => part.charAt(0)).join("").toUpperCase() || "C!";
    }

    function renderAccountLink(link, user) {
        if (!user) {
            link.href = "connexion.html";
            link.classList.remove("site-account-avatar-link");
            link.removeAttribute("aria-label");
            link.removeAttribute("title");
            link.replaceChildren(document.createTextNode(link.dataset.signedOutLabel));
            return;
        }

        const displayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "Membre CHAOS!";
        const avatarUrl = user.user_metadata?.avatar_url;
        link.href = "mon-compte.html";
        link.classList.add("site-account-avatar-link");
        link.setAttribute("aria-label", `Ouvrir le compte de ${displayName}`);
        link.title = `${displayName} — Mon compte`;
        link.replaceChildren();

        const fallback = document.createElement("span");
        fallback.className = "site-account-avatar-initials";
        fallback.textContent = initials(displayName, user.email);
        link.appendChild(fallback);

        if (avatarUrl) {
            const image = document.createElement("img");
            image.className = "site-account-avatar-image";
            image.src = avatarUrl;
            image.alt = "";
            image.loading = "lazy";
            image.addEventListener("load", () => { fallback.hidden = true; });
            image.addEventListener("error", () => { image.remove(); fallback.hidden = false; });
            link.appendChild(image);
        }
    }

    function renderAll(user) {
        accountLinks.forEach(link => renderAccountLink(link, user));
    }

    supabaseClient.auth.getSession()
        .then(({ data, error }) => {
            if (error) throw error;
            renderAll(data.session?.user || null);
        })
        .catch(error => {
            console.error("CHAOS! : impossible de lire la session du menu.", error);
            renderAll(null);
        });

    supabaseClient.auth.onAuthStateChange((_event, session) => {
        renderAll(session?.user || null);
    });
})();
