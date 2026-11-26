(() => {
    "use strict";

    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const statusBox = document.getElementById("auth-status");
    const loginButton = document.getElementById("login-submit");
    const registerButton = document.getElementById("register-submit");

    const loginEmail = document.getElementById("login-email");
    const loginPassword = document.getElementById("login-password");
    const registerName = document.getElementById("register-name");
    const registerEmail = document.getElementById("register-email");
    const registerPassword = document.getElementById("register-password");
    const registerPasswordConfirm = document.getElementById("register-password-confirm");

    function destinationAfterLogin() {
        const requested = new URLSearchParams(window.location.search).get("next");
        const allowed = ["mon-compte.html", "boutique.html", "index.html"];
        return allowed.includes(requested) ? requested : "mon-compte.html";
    }

    function showStatus(message, type = "info") {
        statusBox.textContent = message;
        statusBox.className = `account-status ${type}`;
    }

    function setBusy(button, busy, label) {
        button.disabled = busy;
        button.textContent = busy ? "PATIENTE UN INSTANT..." : label;
    }

    function friendlyError(error) {
        const message = (error?.message || "").toLowerCase();
        if (message.includes("invalid login credentials")) return "Adresse e-mail ou mot de passe incorrect.";
        if (message.includes("email not confirmed")) return "Ton adresse e-mail n'est pas encore confirmée. Vérifie ta boîte mail.";
        if (message.includes("already registered") || message.includes("already been registered")) return "Cette adresse semble déjà utilisée. Essaie de te connecter.";
        if (message.includes("password should be at least") || message.includes("password is too short")) return "Le mot de passe doit contenir au moins 6 caractères.";
        if (message.includes("rate limit") || message.includes("too many requests")) return "Trop de tentatives. Attends un peu avant de réessayer.";
        if (message.includes("network") || message.includes("fetch")) return "Impossible de joindre Supabase. Vérifie ta connexion Internet.";
        return error?.message || "Une erreur est survenue. Réessaie.";
    }

    function switchTab(tab) {
        const registering = tab === "register";
        loginForm.hidden = registering;
        registerForm.hidden = !registering;
        tabLogin.classList.toggle("active", !registering);
        tabRegister.classList.toggle("active", registering);
        tabLogin.setAttribute("aria-selected", String(!registering));
        tabRegister.setAttribute("aria-selected", String(registering));
        showStatus("");
    }

    tabLogin.addEventListener("click", () => switchTab("login"));
    tabRegister.addEventListener("click", () => switchTab("register"));

    if (typeof supabaseClient === "undefined") {
        showStatus("Supabase n'est pas chargé. Vérifie l'ordre des scripts dans connexion.html et le contenu de supabase.js.", "error");
        return;
    }

    // Si une session existe déjà, éviter de demander une nouvelle connexion.
    (async () => {
        try {
            const { data, error } = await supabaseClient.auth.getSession();
            if (error) throw error;
            if (data.session) window.location.replace(destinationAfterLogin());
        } catch (error) {
            console.error("Erreur de lecture de session :", error);
            showStatus("Impossible de vérifier ta session. Actualise la page puis réessaie.", "error");
        }
    })();

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!loginForm.reportValidity()) return;

        setBusy(loginButton, true, "SE CONNECTER ↗");
        showStatus("Connexion en cours...", "loading");

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: loginEmail.value.trim(),
                password: loginPassword.value
            });
            if (error) throw error;
            if (!data.session) throw new Error("Connexion effectuée, mais aucune session n'a été créée. Réessaie.");

            showStatus("Connexion réussie ! Redirection...", "success");
            window.location.replace(destinationAfterLogin());
        } catch (error) {
            console.error("Erreur de connexion :", error);
            showStatus(friendlyError(error), "error");
            setBusy(loginButton, false, "SE CONNECTER ↗");
        }
    });

    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!registerForm.reportValidity()) return;

        const name = registerName.value.trim();
        const email = registerEmail.value.trim();
        const password = registerPassword.value;

        if (name.length < 2) {
            showStatus("Ton pseudo doit contenir au moins 2 caractères.", "error");
            return;
        }
        if (password !== registerPasswordConfirm.value) {
            showStatus("Les deux mots de passe ne correspondent pas.", "error");
            registerPasswordConfirm.focus();
            return;
        }

        setBusy(registerButton, true, "CRÉER MON COMPTE ↗");
        showStatus("Création du compte en cours...", "loading");

        try {
            const emailRedirectTo = new URL("mon-compte.html", window.location.href).href;
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: { display_name: name },
                    emailRedirectTo
                }
            });
            if (error) throw error;

            if (data.session) {
                showStatus("Ton compte est créé ! Redirection...", "success");
                window.location.replace("mon-compte.html");
            } else {
                registerForm.reset();
                switchTab("login");
                showStatus("Compte créé ! Vérifie ta boîte mail (et tes courriers indésirables) pour confirmer ton adresse. Tu pourras ensuite te connecter.", "success");
            }
        } catch (error) {
            console.error("Erreur de création du compte :", error);
            showStatus(friendlyError(error), "error");
        } finally {
            setBusy(registerButton, false, "CRÉER MON COMPTE ↗");
        }
    });
})();
