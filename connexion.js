
const registerForm = document.getElementById("register-form");
const authMessage = document.getElementById("auth-message");

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const pseudo = document.getElementById("register-name").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;
    const confirmation = document.getElementById("register-confirm").value;

    const button = registerForm.querySelector(".auth-submit");

    // Vérification des champs
    if (password !== confirmation) {
        authMessage.textContent = "Les mots de passe ne correspondent pas !";
        authMessage.style.color = "#ff4d6d";
        return;
    }

    if (pseudo.length < 2) {
        authMessage.textContent = "Ton pseudo doit contenir au moins 2 caractères.";
        authMessage.style.color = "#ff4d6d";
        return;
    }

    button.disabled = true;
    button.textContent = "CRÉATION EN COURS...";
    authMessage.textContent = "";

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    pseudo: pseudo
                },
                emailRedirectTo:
                    "https://potatoflying.github.io/Chaos/connexion.html"
            }
        });

        if (error) throw error;

        authMessage.style.color = "#baff00";
        authMessage.textContent =
            "Compte créé ! Vérifie tes e-mails pour confirmer ton adresse.";

        registerForm.reset();

    } catch (error) {
        authMessage.style.color = "#ff4d6d";
        authMessage.textContent = error.message;

    } finally {
        button.disabled = false;
        button.textContent = "CRÉER MON COMPTE ↗";
    }
});
