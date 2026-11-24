
// ==================================
// CHAOS CLUB - GESTION DU COMPTE
// ==================================

async function loadAccount() {

    const pseudoElement = document.getElementById("account-pseudo");
    const emailElement = document.getElementById("account-email");
    const messageElement = document.getElementById("account-message");

    try {
        const { data, error } = await supabaseClient.auth.getUser();

        if (error) throw error;

        const user = data.user;

        // Aucun utilisateur connecté
        if (!user) {
            window.location.href = "connexion.html";
            return;
        }

        // Récupération des informations
        const pseudo = user.user_metadata?.pseudo || "Membre CHAOS";

        pseudoElement.textContent = pseudo;
        emailElement.textContent = user.email;

    } catch (error) {
        console.error("Erreur du compte :", error);
        messageElement.style.color = "#ff4d6d";
        messageElement.textContent =
            "Impossible de charger ton compte. Réessaie plus tard.";
    }
}

// ==================================
// DÉCONNEXION
// ==================================

document.getElementById("logout-button").addEventListener("click", async () => {

    const button = document.getElementById("logout-button");
    const message = document.getElementById("account-message");

    button.disabled = true;
    button.textContent = "DÉCONNEXION...";

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        message.style.color = "#ff4d6d";
        message.textContent = error.message;

        button.disabled = false;
        button.textContent = "SE DÉCONNECTER ↗";
        return;
    }

    window.location.href = "index.html";
});

// Chargement du compte
loadAccount();
