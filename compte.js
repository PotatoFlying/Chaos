(() => {
    "use strict";

    // Éléments du profil
    const displayName = document.getElementById("profile-display-name");
    const emailLabel = document.getElementById("profile-email");
    const profileForm = document.getElementById("profile-form");
    const nameInput = document.getElementById("profile-name");
    const profileStatus = document.getElementById("profile-status");
    const saveButton = document.getElementById("profile-save");
    const logoutButton = document.getElementById("logout-button");
    const avatarImage = document.getElementById("profile-avatar-image");
    const avatarInitials = document.getElementById("profile-avatar-initials");
    const avatarFileInput = document.getElementById("avatar-file");
    const avatarUploadButton = document.getElementById("avatar-upload-button");

    // Éléments de la liste des commandes
    const ordersList = document.getElementById("orders-list");
    const ordersStatus = document.getElementById("orders-status");
    const refreshOrdersButton = document.getElementById("refresh-orders-button");
    const adminEntryLink = document.getElementById("admin-entry-link");

    function showProfileStatus(message, type = "info") {
        profileStatus.textContent = message;
        profileStatus.className = `account-status ${type}`;
    }

    function showOrdersStatus(message, type = "info") {
        ordersStatus.textContent = message;
        ordersStatus.className = `orders-status ${type}`;
        ordersStatus.hidden = !message;
    }

    if (typeof supabaseClient === "undefined") {
        showProfileStatus("Supabase n'est pas chargé. Vérifie les scripts de mon-compte.html.", "error");
        profileForm.hidden = true;
        logoutButton.disabled = true;
        showOrdersStatus("Impossible de charger tes commandes : Supabase n'est pas connecté.", "error");
        return;
    }

    let currentUser = null;
    let previewObjectUrl = null;
    let ordersLoading = false;

    function initialesPour(nom) {
        return (nom || "C!").trim().split(/\s+/).slice(0, 2)
            .map(part => part[0] || "").join("").toUpperCase() || "C!";
    }

    function afficherAvatar(url, nom) {
        avatarInitials.textContent = initialesPour(nom);
        if (url) {
            avatarImage.src = url;
            avatarImage.hidden = false;
            avatarInitials.hidden = true;
            avatarImage.onerror = () => {
                avatarImage.hidden = true;
                avatarInitials.hidden = false;
            };
        } else {
            avatarImage.removeAttribute("src");
            avatarImage.hidden = true;
            avatarInitials.hidden = false;
        }
    }

    function formatDate(dateValue) {
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) return "Date inconnue";
        return new Intl.DateTimeFormat("fr-FR", {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(date);
    }

    function statusInfo(status) {
        const statuses = {
            pending: {
                label: "En attente",
                className: "pending",
                message: "Ta demande a bien été reçue. L'équipe CHAOS! doit encore l'examiner."
            },
            accepted: {
                label: "Acceptée",
                className: "accepted",
                message: "Bonne nouvelle ! Ta demande a été acceptée. L'équipe reviendra vers toi pour finaliser les détails."
            },
            declined: {
                label: "Refusée",
                className: "declined",
                message: "Cette demande n'a pas pu être acceptée. Tu peux contacter l'équipe CHAOS! pour en discuter."
            },
            completed: {
                label: "Terminée",
                className: "completed",
                message: "Cette commande est marquée comme terminée. Merci d'avoir choisi CHAOS!"
            }
        };
        return statuses[status] || {
            label: status || "Inconnu",
            className: "unknown",
            message: "Le statut de cette commande n'est pas disponible."
        };
    }

    function createOrderElement(order) {
        const article = document.createElement("article");
        article.className = "order-item";

        const top = document.createElement("div");
        top.className = "order-item-top";

        const reference = document.createElement("span");
        reference.className = "order-reference";
        reference.textContent = `COMMANDE #${String(order.id || "").slice(0, 8).toUpperCase()}`;

        const badge = document.createElement("span");
        const state = statusInfo(order.status);
        badge.className = `order-status-badge ${state.className}`;
        badge.textContent = state.label;

        top.append(reference, badge);

        const stateMessage = document.createElement("p");
        stateMessage.className = `order-status-message ${state.className}`;
        stateMessage.textContent = state.message;

        const date = document.createElement("p");
        date.className = "order-date";
        date.textContent = `Envoyée le ${formatDate(order.created_at)}`;

        const title = document.createElement("h3");
        title.className = "order-title";
        title.textContent = `${order.style || "Dessin"} · Format ${order.format || "non précisé"}`;

        const details = document.createElement("p");
        details.className = "order-details";
        details.textContent = `${order.quantity || 1} dessin${Number(order.quantity) > 1 ? "s" : ""} · ${Number(order.unit_price || 0)} € / dessin`;

        const description = document.createElement("p");
        description.className = "order-description";
        description.textContent = order.description || "Aucune description fournie.";

        const bottom = document.createElement("div");
        bottom.className = "order-item-bottom";

        const totalLabel = document.createElement("span");
        totalLabel.className = "order-total-label";
        totalLabel.textContent = "PRIX ESTIMÉ";

        const total = document.createElement("strong");
        total.className = "order-total";
        total.textContent = `${Number(order.total_price || 0)} €`;
        bottom.append(totalLabel, total);

        article.append(top, stateMessage, date, title, details, description, bottom);

        const chatButton = document.createElement("button");
        chatButton.type = "button";
        chatButton.className = "order-chat-trigger";
        chatButton.dataset.chatOrderId = order.id;
        chatButton.dataset.chatOrderLabel = `COMMANDE #${String(order.id || "").slice(0, 8).toUpperCase()}`;
        chatButton.textContent = "PARLER À L'ÉQUIPE CHAOS! ↗";
        article.appendChild(chatButton);

        if (order.reference_url) {
            try {
                const referenceUrl = new URL(order.reference_url);
                if (referenceUrl.protocol === "http:" || referenceUrl.protocol === "https:") {
                    const link = document.createElement("a");
                    link.className = "order-reference-link";
                    link.href = referenceUrl.href;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                    link.textContent = "Voir l'image de référence ↗";
                    article.appendChild(link);
                }
            } catch (_error) {
                // Une URL invalide est simplement ignorée dans l'affichage.
            }
        }

        return article;
    }

    async function loadOrders() {
        if (!currentUser || ordersLoading) return;

        ordersLoading = true;
        refreshOrdersButton.disabled = true;
        ordersList.replaceChildren();
        showOrdersStatus("Chargement de tes commandes...", "loading");

        try {
            // RLS Supabase limite déjà les résultats à l'utilisateur connecté.
            // Le filtre explicite ajoute une seconde précaution côté requête.
            const { data: orders, error } = await supabaseClient
                .from("orders")
                .select("id, created_at, description, reference_url, quantity, format, style, unit_price, total_price, status")
                .eq("user_id", currentUser.id)
                .order("created_at", { ascending: false });

            if (error) throw error;

            if (!orders || orders.length === 0) {
                showOrdersStatus("Tu n'as pas encore passé de commande.", "empty");
                return;
            }

            const checkedAt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
            showOrdersStatus(`${orders.length} commande${orders.length > 1 ? "s" : ""} retrouvée${orders.length > 1 ? "s" : ""}. Statuts actualisés à ${checkedAt}.`, "success");
            const fragment = document.createDocumentFragment();
            orders.forEach(order => fragment.appendChild(createOrderElement(order)));
            ordersList.appendChild(fragment);
        } catch (error) {
            console.error("Erreur de chargement des commandes :", error);
            showOrdersStatus(
                "Impossible de charger tes commandes. Vérifie que la table orders existe et que les règles RLS autorisent la lecture de tes propres commandes.",
                "error"
            );
        } finally {
            ordersLoading = false;
            refreshOrdersButton.disabled = false;
        }
    }

    async function checkAdminAccess() {
        if (!adminEntryLink) return;

        // Le rôle est vérifié côté Supabase : le lien reste caché par défaut.
        try {
            const { data, error } = await supabaseClient.rpc("is_chaos_admin");
            if (error) throw error;
            adminEntryLink.hidden = data !== true;
        } catch (error) {
            adminEntryLink.hidden = true;
            console.warn("Impossible de vérifier le rôle administrateur :", error);
        }
    }

    async function loadAccount() {
        try {
            const { data, error } = await supabaseClient.auth.getUser();
            if (error) throw error;

            if (!data.user) {
                window.location.replace("connexion.html?next=mon-compte.html");
                return;
            }

            currentUser = data.user;
            const name = currentUser.user_metadata?.display_name || currentUser.email?.split("@")[0] || "Membre CHAOS!";
            displayName.textContent = name;
            emailLabel.textContent = currentUser.email || "";
            nameInput.value = currentUser.user_metadata?.display_name || "";
            afficherAvatar(currentUser.user_metadata?.avatar_url, name);

            await Promise.all([checkAdminAccess(), loadOrders()]);
        } catch (error) {
            console.error("Erreur de chargement du compte :", error);
            showProfileStatus("Impossible de charger ton compte. Réessaie ou reconnecte-toi.", "error");
            showOrdersStatus("Tes commandes ne peuvent pas être chargées sans session active.", "error");
        }
    }

    profileForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!profileForm.reportValidity() || !currentUser) return;

        const newName = nameInput.value.trim();
        if (newName.length < 2) {
            showProfileStatus("Le pseudo doit contenir au moins 2 caractères.", "error");
            return;
        }

        saveButton.disabled = true;
        saveButton.textContent = "ENREGISTREMENT...";
        showProfileStatus("Mise à jour du profil...", "loading");

        try {
            const { data, error } = await supabaseClient.auth.updateUser({
                data: { display_name: newName }
            });
            if (error) throw error;
            currentUser = data.user;
            displayName.textContent = newName;
            showProfileStatus("Ton pseudo a bien été mis à jour !", "success");
        } catch (error) {
            console.error("Erreur de mise à jour du profil :", error);
            showProfileStatus(error.message || "Impossible de mettre à jour ton pseudo.", "error");
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = "ENREGISTRER LE PSEUDO ↗";
        }
    });

    avatarFileInput.addEventListener("change", () => {
        const file = avatarFileInput.files?.[0];
        if (!file) return;

        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
            showProfileStatus("Choisis une image JPG, PNG ou WebP.", "error");
            avatarFileInput.value = "";
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            showProfileStatus("Ta photo dépasse 2 Mo. Choisis une image plus légère.", "error");
            avatarFileInput.value = "";
            return;
        }

        if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = URL.createObjectURL(file);
        avatarImage.src = previewObjectUrl;
        avatarImage.hidden = false;
        avatarInitials.hidden = true;
        showProfileStatus("Aperçu prêt. Clique sur ENREGISTRER LA PHOTO pour confirmer.", "info");
    });

    avatarUploadButton.addEventListener("click", async () => {
        const file = avatarFileInput.files?.[0];
        if (!currentUser) return;
        if (!file) {
            showProfileStatus("Choisis d'abord une photo de profil.", "error");
            return;
        }

        avatarUploadButton.disabled = true;
        avatarUploadButton.textContent = "ENVOI...";
        showProfileStatus("Envoi de ta photo de profil...", "loading");

        try {
            const { error: uploadError } = await supabaseClient.storage
                .from("avatars")
                .upload(`${currentUser.id}/avatar`, file, {
                    cacheControl: "0",
                    contentType: file.type,
                    upsert: true
                });
            if (uploadError) throw uploadError;

            const { data: publicData } = supabaseClient.storage
                .from("avatars")
                .getPublicUrl(`${currentUser.id}/avatar`);

            const avatarUrl = `${publicData.publicUrl}?v=${Date.now()}`;
            const { data, error: updateError } = await supabaseClient.auth.updateUser({
                data: { avatar_url: avatarUrl }
            });
            if (updateError) throw updateError;

            currentUser = data.user;
            afficherAvatar(avatarUrl, currentUser.user_metadata?.display_name || currentUser.email);
            avatarFileInput.value = "";
            if (previewObjectUrl) {
                URL.revokeObjectURL(previewObjectUrl);
                previewObjectUrl = null;
            }
            showProfileStatus("Ta photo de profil a bien été mise à jour !", "success");
        } catch (error) {
            console.error("Erreur d'envoi de la photo de profil :", error);
            showProfileStatus(error.message || "Impossible d'enregistrer ta photo. Vérifie la configuration du stockage Supabase.", "error");
        } finally {
            avatarUploadButton.disabled = false;
            avatarUploadButton.textContent = "ENREGISTRER LA PHOTO ↗";
        }
    });

    refreshOrdersButton.addEventListener("click", loadOrders);

    // Recharge les statuts quand le client revient sur son onglet profil.
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && currentUser) loadOrders();
    });
    window.addEventListener("focus", () => {
        if (currentUser) loadOrders();
    });

    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;
        logoutButton.textContent = "DÉCONNEXION...";
        try {
            const { error } = await supabaseClient.auth.signOut({ scope: "local" });
            if (error) throw error;
            window.location.replace("connexion.html");
        } catch (error) {
            console.error("Erreur de déconnexion :", error);
            showProfileStatus(error.message || "La déconnexion a échoué. Réessaie.", "error");
            logoutButton.disabled = false;
            logoutButton.textContent = "SE DÉCONNECTER";
        }
    });

    loadAccount();
})();
