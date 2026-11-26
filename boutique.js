// =========================================
// CHAOS! - CALCULATEUR ET ENVOI DES COMMANDES
// =========================================

const tarifs = [
    [5, 8, 12],    // Sketch
    [10, 15, 20],  // Illustration simple
    [15, 25, 35]   // Illustration détaillée
];

const formats = ["Petit", "Moyen", "Grand"];
const styles = ["Sketch", "Simple", "Détaillée"];
const MAX_QUANTITE = 10;

let quantite = 1;
let formatSelectionne = 0;
let styleSelectionne = 0;

// Éléments du calculateur
const affichageQuantite = document.getElementById("quantity");
const affichagePrix = document.getElementById("estimated-price");
const boutonsQuantite = document.querySelectorAll(".quantity-button");
const boutonsFormat = document.querySelectorAll(".size-grid .choice-card");
const boutonsStyle = document.querySelectorAll(".style-grid .choice-card");
const boutonCommande = document.querySelector(".order-button");
const messageConnexion = document.getElementById("order-auth-message");

// Éléments du formulaire
const modal = document.getElementById("order-modal");
const formulaire = document.getElementById("order-form");
const champNom = document.getElementById("customer-name");
const champEmail = document.getElementById("customer-email");
const champDescription = document.getElementById("order-description");
const champReference = document.getElementById("reference-url");
const statutFormulaire = document.getElementById("order-form-status");
const boutonEnvoi = document.getElementById("submit-order-button");

const resumeStyle = document.getElementById("summary-style");
const resumeFormat = document.getElementById("summary-format");
const resumeQuantite = document.getElementById("summary-quantity");
const resumeTotal = document.getElementById("summary-total");

function prixUnitaireActuel() {
    return tarifs[styleSelectionne][formatSelectionne];
}

function prixTotalActuel() {
    return prixUnitaireActuel() * quantite;
}

function actualiserCalculateur() {
    affichageQuantite.textContent = quantite;
    // Le symbole € est déjà écrit dans le HTML après le span.
    affichagePrix.textContent = prixTotalActuel();

    if (boutonsQuantite.length >= 2) {
        boutonsQuantite[0].disabled = quantite <= 1;
        boutonsQuantite[1].disabled = quantite >= MAX_QUANTITE;
    }
}

function actualiserResume() {
    resumeStyle.textContent = styles[styleSelectionne];
    resumeFormat.textContent = formats[formatSelectionne];
    resumeQuantite.textContent = String(quantite);
    resumeTotal.textContent = `${prixTotalActuel()} €`;
}

// Boutons + et -
boutonsQuantite.forEach((bouton, index) => {
    bouton.addEventListener("click", () => {
        if (index === 0) {
            quantite = Math.max(1, quantite - 1);
        } else {
            quantite = Math.min(MAX_QUANTITE, quantite + 1);
        }
        actualiserCalculateur();
    });
});

// Sélection du format
boutonsFormat.forEach((bouton, index) => {
    bouton.addEventListener("click", () => {
        formatSelectionne = index;
        boutonsFormat.forEach(element => element.classList.remove("active"));
        bouton.classList.add("active");
        actualiserCalculateur();
    });
});

// Sélection du style
boutonsStyle.forEach((bouton, index) => {
    bouton.addEventListener("click", () => {
        styleSelectionne = index;
        boutonsStyle.forEach(element => element.classList.remove("active"));
        bouton.classList.add("active");
        actualiserCalculateur();
    });
});

function afficherStatut(message, type = "error") {
    statutFormulaire.textContent = message;
    statutFormulaire.className = `order-form-status ${type}`;
}

function ouvrirModal() {
    actualiserResume();
    statutFormulaire.textContent = "";
    statutFormulaire.className = "order-form-status";
    boutonEnvoi.disabled = false;
    boutonEnvoi.textContent = "ENVOYER MA DEMANDE ↗";
    modal.hidden = false;
    document.body.classList.add("order-modal-open");
    champNom.focus();
}

function fermerModal() {
    modal.hidden = true;
    document.body.classList.remove("order-modal-open");
    boutonCommande.focus();
}

// Le client doit être connecté pour que la demande soit liée à son compte.
boutonCommande.addEventListener("click", async () => {
    messageConnexion.hidden = true;

    if (typeof supabaseClient === "undefined") {
        messageConnexion.textContent = "La connexion à Supabase n'est pas chargée. Vérifie les scripts de boutique.html.";
        messageConnexion.hidden = false;
        return;
    }

    boutonCommande.disabled = true;
    try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) throw error;

        if (!data.session) {
            messageConnexion.innerHTML = 'Pour envoyer une demande, connecte-toi d’abord à ton compte. <a href="connexion.html">Se connecter / créer un compte ↗</a>';
            messageConnexion.hidden = false;
            return;
        }

        // Préremplit l'adresse du compte ; le client peut la modifier.
        champEmail.value = data.session.user.email || "";
        ouvrirModal();
    } catch (error) {
        console.error("Erreur de vérification de session :", error);
        messageConnexion.textContent = "Impossible de vérifier ta connexion. Réessaie dans un instant.";
        messageConnexion.hidden = false;
    } finally {
        boutonCommande.disabled = false;
    }
});

// Fermeture du formulaire
modal.querySelectorAll("[data-close-order]").forEach(element => {
    element.addEventListener("click", fermerModal);
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden) {
        fermerModal();
    }
});

// Enregistrement de la demande dans Supabase
formulaire.addEventListener("submit", async event => {
    event.preventDefault();

    if (!formulaire.reportValidity()) return;

    if (typeof supabaseClient === "undefined") {
        afficherStatut("La connexion à Supabase n'est pas chargée. Vérifie les scripts de la page.");
        return;
    }

    boutonEnvoi.disabled = true;
    boutonEnvoi.textContent = "ENVOI EN COURS...";
    afficherStatut("Enregistrement de ta demande...", "loading");

    try {
        const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError) throw sessionError;

        const session = sessionData.session;
        if (!session) {
            afficherStatut("Ta session a expiré. Connecte-toi à nouveau avant d'envoyer ta demande.");
            boutonEnvoi.disabled = false;
            boutonEnvoi.textContent = "ENVOYER MA DEMANDE ↗";
            return;
        }

        const commande = {
            user_id: session.user.id,
            customer_name: champNom.value.trim(),
            customer_email: champEmail.value.trim(),
            description: champDescription.value.trim(),
            reference_url: champReference.value.trim() || null,
            quantity: quantite,
            format: formats[formatSelectionne],
            style: styles[styleSelectionne]
        };

        // Les prix sont calculés par un trigger SQL dans Supabase,
        // et non acceptés depuis le navigateur.
        const { data: commandeEnregistree, error } = await supabaseClient
            .from("orders")
            .insert(commande)
            .select("id, unit_price, total_price, created_at")
            .single();

        if (error) throw error;

        afficherStatut(
            `Demande envoyée ! Référence : ${commandeEnregistree.id.slice(0, 8).toUpperCase()}. L'artiste devra confirmer le prix final et le délai.`,
            "success"
        );
        boutonEnvoi.textContent = "DEMANDE ENREGISTRÉE ✓";
        formulaire.reset();
        champEmail.value = session.user.email || commande.customer_email;

    } catch (error) {
        console.error("Erreur lors de l'enregistrement de la commande :", error);
        afficherStatut("L'envoi a échoué. Vérifie que la table orders et ses règles de sécurité ont bien été créées dans Supabase, puis réessaie.");
        boutonEnvoi.disabled = false;
        boutonEnvoi.textContent = "RÉESSAYER ↗";
    }
});

// Calcul initial
actualiserCalculateur();
